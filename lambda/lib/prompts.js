// ============================================================================
// prompts.js — System prompts and scoring logic for resume generation
// ============================================================================

const config = require("./config");

function buildSystemPrompt() {
  return `You are a resume generator that creates ATS-optimized resumes using the Google XYZ formula.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations, no extra text
2. Use the exact JSON schema provided below
3. Generate realistic work history with 3-4 companies over 6-7 years
4. Each bullet must follow Google XYZ formula: "Accomplished [X] by doing [Y], resulting in [Z]"
5. Include specific metrics, technologies, and quantifiable results
6. Use strong action verbs: ${config.ACTION_VERBS.technical.slice(0, 10).join(", ")}

JSON SCHEMA:
{
  "parsed_jd": {
    "role_title": "string",
    "industry": "string", 
    "cloud_platform": "aws|azure|gcp",
    "key_technologies": ["tech1", "tech2"],
    "required_skills": ["skill1", "skill2"]
  },
  "professional_summary": "2-3 sentence summary highlighting relevant experience",
  "technical_skills": {
    "Languages": "comma-separated list",
    "Frameworks & Libraries": "comma-separated list", 
    "Cloud & DevOps": "comma-separated list",
    "Databases": "comma-separated list",
    "Tools & Practices": "comma-separated list"
  },
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "location": "City, State",
      "start_date": "MMM YYYY",
      "end_date": "MMM YYYY",
      "bullets": [
        "XYZ formula bullet with metrics",
        "Another XYZ bullet with specific results"
      ]
    }
  ]
}

WORK HISTORY GUIDELINES:
- Current role: 18-28 months
- Previous roles: 18-28 months each
- Include 1-2 IT services companies (${config.IT_SERVICES_FIRMS.slice(0, 3).join(", ")})
- Use competitor companies from the target industry
- Each role should have 3-4 bullets maximum
- Timeline must be realistic (no gaps, no overlaps)

BULLET REQUIREMENTS:
- Start with strong action verb
- Include specific technologies mentioned in JD
- Add quantifiable metrics (%, $, time saved, team size)
- Keep under 200 characters
- Focus on achievements, not responsibilities

TECHNOLOGY TIMELINE — DO NOT use these technologies in roles dated BEFORE their introduction year:
${Object.entries(config.TECH_TIMELINE).map(([tech, t]) => `- ${tech}: not before ${t.earliest}`).join("\n")}
Only mention a technology in a role if the role's start date is on or after the year listed above. For example, do NOT put "RAG" in a role starting before 2023.`;
}

function buildUserMessage(jd, customer, context) {
  let message = `Generate a resume for this job description:\n\n${jd}`;
  
  if (customer) {
    message += `\n\nTarget company: ${customer}`;
    message += `\nUse competitor companies in work history where relevant.`;
  }
  
  if (context) {
    message += `\n\nAdditional context: ${context}`;
  }
  
  message += `\n\nReturn ONLY the JSON response with no additional text or formatting.`;
  
  return message;
}

function scoreResume(resumeData) {
  if (!resumeData.experience) {
    return { average: 0, bulletCount: 0, results: [] };
  }

  const results = [];
  let totalScore = 0;
  let bulletCount = 0;

  for (const exp of resumeData.experience) {
    const companyResult = {
      company: exp.company,
      bullets: []
    };

    const bullets = exp.bullets || [];
    for (const bullet of bullets) {
      const score = scoreBullet(bullet);
      companyResult.bullets.push({
        text: bullet,
        score: score.total,
        grade: score.grade,
        breakdown: score.breakdown
      });
      
      totalScore += score.total;
      bulletCount++;
    }

    results.push(companyResult);
  }

  const average = bulletCount > 0 ? Math.round(totalScore / bulletCount * 10) / 10 : 0;

  return {
    average,
    bulletCount,
    results
  };
}

function scoreBullet(bullet) {
  let score = 0;
  const breakdown = [];

  // Check for action verb at start
  const startsWithActionVerb = Object.values(config.ACTION_VERBS)
    .flat()
    .some(verb => bullet.toLowerCase().startsWith(verb.toLowerCase()));
  
  if (startsWithActionVerb) {
    score += config.QUALITY_SCORING.verb_check_points;
    breakdown.push("Strong action verb");
  }

  // Check scoring rules
  for (const rule of config.QUALITY_SCORING.rules) {
    if (rule.pattern.test(bullet)) {
      score += rule.points;
      breakdown.push(rule.label);
    }
  }

  // Penalties
  if (!/\d/.test(bullet)) {
    score += config.QUALITY_SCORING.no_metric_penalty;
    breakdown.push("No metrics (penalty)");
  }

  if (bullet.length > 200) {
    score += config.QUALITY_SCORING.over_200_chars_penalty;
    breakdown.push("Too long (penalty)");
  }

  // Determine grade
  let grade;
  if (score >= config.QUALITY_SCORING.thresholds.excellent) {
    grade = "Excellent";
  } else if (score >= config.QUALITY_SCORING.thresholds.good) {
    grade = "Good";
  } else if (score >= config.QUALITY_SCORING.thresholds.needs_improvement) {
    grade = "Needs improvement";
  } else {
    grade = "Rewrite required";
  }

  return {
    total: Math.max(0, score),
    grade,
    breakdown
  };
}

function validateTimeline(resumeData) {
  const warnings = [];
  
  if (!resumeData.experience || resumeData.experience.length === 0) {
    return warnings;
  }

  // Check for timeline gaps or overlaps
  const sortedExperience = resumeData.experience
    .map(exp => ({
      ...exp,
      startDate: parseDate(exp.start_date),
      endDate: parseDate(exp.end_date)
    }))
    .sort((a, b) => b.endDate - a.endDate); // Most recent first

  for (let i = 0; i < sortedExperience.length - 1; i++) {
    const current = sortedExperience[i];
    const next = sortedExperience[i + 1];
    
    const gap = (current.startDate - next.endDate) / (1000 * 60 * 60 * 24 * 30); // Gap in months
    
    if (gap > 2) {
      warnings.push(`Gap of ${Math.round(gap)} months between ${next.company} and ${current.company}`);
    } else if (gap < -1) {
      warnings.push(`Overlap between ${next.company} and ${current.company}`);
    }
  }

  // Check for unrealistic technology timeline
  // Use word boundary regex to avoid false positives (e.g. "rag" matching "storage")
  for (const exp of resumeData.experience) {
    const expYear = parseDate(exp.start_date).getFullYear();

    for (const bullet of exp.bullets || []) {
      const lowerBullet = bullet.toLowerCase();
      for (const [tech, timeline] of Object.entries(config.TECH_TIMELINE)) {
        const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`);
        if (regex.test(lowerBullet) && expYear < timeline.earliest) {
          warnings.push(`${tech} mentioned in ${exp.company} (${exp.start_date}) but technology wasn't available until ${timeline.earliest}`);
        }
      }
    }
  }

  return warnings;
}

function parseDate(dateStr) {
  // Parse "MMM YYYY" format
  const [month, year] = dateStr.split(" ");
  const monthMap = {
    "Jan": 0, "Feb": 1, "Mar": 2, "Apr": 3, "May": 4, "Jun": 5,
    "Jul": 6, "Aug": 7, "Sep": 8, "Oct": 9, "Nov": 10, "Dec": 11
  };
  
  return new Date(parseInt(year), monthMap[month] || 0, 1);
}

// ── Optimize mode prompts ──

function buildOptimizeSystemPrompt() {
  return `You are a resume optimizer that rewrites existing resumes to be ATS-optimized for a specific job description using the Google XYZ formula.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations, no extra text
2. Use the exact JSON schema provided below
3. PRESERVE the candidate's real companies, job titles, dates, and locations EXACTLY as they appear
4. Do NOT invent new companies, roles, or change employment dates
5. EXTRACT contact info (name, email, phone, linkedin, github) from the resume
6. EXTRACT education details (schools, degrees, dates, locations) from the resume
7. REWRITE bullet points using Google XYZ formula: "Accomplished [X] by doing [Y], resulting in [Z]"
8. ADD quantifiable metrics to every bullet (%, $, time saved, team size, scale)
9. WEAVE IN missing keywords and technologies from the job description naturally into bullets
10. OPTIMIZE the professional summary for the target role
11. REORDER technical skills to prioritize what the JD asks for
12. Use strong action verbs: ${config.ACTION_VERBS.technical.slice(0, 10).join(", ")}

JSON SCHEMA:
{
  "parsed_jd": {
    "role_title": "string",
    "industry": "string",
    "cloud_platform": "aws|azure|gcp",
    "key_technologies": ["tech1", "tech2"],
    "required_skills": ["skill1", "skill2"]
  },
  "contact": {
    "name": "extracted from resume",
    "email": "extracted from resume",
    "phone": "extracted from resume",
    "linkedin": "extracted from resume or empty string",
    "github": "extracted from resume or empty string"
  },
  "education": [
    {
      "school": "University Name",
      "degree": "Degree Name",
      "location": "City, State",
      "start_date": "MMM YYYY",
      "end_date": "MMM YYYY"
    }
  ],
  "professional_summary": "2-3 sentence summary optimized for the target role",
  "technical_skills": {
    "Languages": "comma-separated, prioritized by JD relevance",
    "Frameworks & Libraries": "comma-separated",
    "Cloud & DevOps": "comma-separated",
    "Databases": "comma-separated",
    "Tools & Practices": "comma-separated"
  },
  "experience": [
    {
      "company": "EXACT company name from resume",
      "title": "EXACT title from resume",
      "location": "City, State from resume",
      "start_date": "MMM YYYY from resume",
      "end_date": "MMM YYYY from resume",
      "bullets": [
        "Rewritten XYZ formula bullet with metrics and JD keywords",
        "Another rewritten bullet with specific quantified results"
      ]
    }
  ]
}

OPTIMIZATION RULES:
- Keep the SAME number of jobs and same career structure
- Each role should have 3-4 bullets maximum
- Each bullet must include at least one quantifiable metric
- Keep bullets under 200 characters
- If the original bullet lacks a metric, add a realistic one based on context
- Prioritize technologies mentioned in the JD
- For skills section: include ALL technologies from the original resume, but list JD-relevant ones first
- If contact fields are not found in the resume, use empty strings

TECHNOLOGY TIMELINE — DO NOT use these technologies in roles dated BEFORE their introduction year:
${Object.entries(config.TECH_TIMELINE).map(([tech, t]) => `- ${tech}: not before ${t.earliest}`).join("\n")}
Only mention a technology in a role if the role's start date is on or after the year listed above. For example, do NOT put "RAG" in a role starting before 2023.`;
}

function buildOptimizeUserMessage(resume, jd, context) {
  let message = `Here is the candidate's current resume:\n\n${resume}`;
  message += `\n\n---\n\nHere is the target job description:\n\n${jd}`;

  if (context) {
    message += `\n\nAdditional instructions: ${context}`;
  }

  message += `\n\nOptimize the resume for this job description. Preserve all real companies, titles, and dates. Rewrite bullets with metrics and JD keywords. Return ONLY the JSON response.`;

  return message;
}

module.exports = {
  buildSystemPrompt,
  buildUserMessage,
  buildOptimizeSystemPrompt,
  buildOptimizeUserMessage,
  scoreResume,
  validateTimeline
};