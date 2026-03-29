// ============================================================================
// prompts.js — System prompts and scoring logic for resume generation
// ============================================================================

const config = require("./config");

function buildSystemPrompt() {
  return `You are a resume generator that creates ATS-optimized, human-readable resumes.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations, no extra text
2. Use the exact JSON schema provided below
3. Generate realistic work history with 3-4 companies over 6-7 years
4. Use strong, direct action verbs: Built, Designed, Developed, Led, Reduced, Improved, Architected, Deployed, Automated, Migrated, Optimized, Created
5. NEVER use weak/passive verbs: Assisted, Helped, Participated, Supported, Maintained, Wrote, Served, Completed, Handled, Utilized, Worked, Collaborated, Contributed, Stood
6. Include specific technologies and quantifiable results where natural
7. NEVER mention a technology in a role dated BEFORE that technology existed (see TECHNOLOGY TIMELINE below). This is a HARD CONSTRAINT.

Use these SHORT KEYS in your JSON response (saves tokens):
{
  "jd": {
    "rt": "role title",
    "ind": "industry",
    "cp": "aws|azure|gcp",
    "kt": ["tech1", "tech2"],
    "rs": ["skill1", "skill2"]
  },
  "ps": "2-3 sentence summary highlighting relevant experience",
  "ts": {
    "lang": "comma-separated list",
    "fw": "comma-separated list",
    "cloud": "comma-separated list",
    "db": "comma-separated list",
    "tools": "comma-separated list"
  },
  "exp": [
    {
      "co": "Company Name",
      "ti": "Job Title",
      "loc": "City, State",
      "sd": "MMM YYYY",
      "ed": "MMM YYYY",
      "b": [
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
- Each role should have 6-8 bullets
- The resume can span up to 2 pages
- Timeline must be realistic (no gaps, no overlaps)

BULLET REQUIREMENTS:
- Start with a strong, past-tense action verb (Built, Designed, Developed, Led, Reduced, Improved, Architected, Deployed, Automated, Migrated, Optimized, Created)
- NEVER start with weak/passive verbs: Assisted, Helped, Participated, Supported, Maintained, Wrote, Served, Completed, Handled, Utilized, Worked, Collaborated, Contributed
- Include specific technologies mentioned in JD
- Do NOT end bullet points with periods
- Keep bullets to 1-2 lines (under 200 characters)
- Focus on achievements, not responsibilities
- Use digits instead of spelling out numbers (8 not "eight")
${buildAntiSlopPromptSection("standard")}
BULLET ORDERING (CRITICAL FOR SKIMMABILITY):
Hiring managers spend 6 seconds scanning a resume. The first 2 bullets of each role are the ONLY ones most will read.
- Bullet 1 MUST answer "what is the biggest thing this person did here?" — show SCOPE (how many users/systems/teams), IMPACT (business outcome), and LEADERSHIP
- Bullet 2 MUST answer "what business problem did they solve?" — compliance, cost savings, reliability, customer satisfaction
- Bullets 3-4: technical depth — architecture decisions, technology migrations, performance gains
- Remaining bullets: supporting achievements, tooling, mentoring, process improvements

BUSINESS VALUE MIX (per role):
- 2-3 bullets: Business impact — scale served, revenue influenced, compliance achieved, customer outcomes (e.g., "serving 4.2M residents", "achieving FedRAMP compliance across 12 departments")
- 2-3 bullets: Technical achievement — performance gains, architecture, system design (e.g., "reducing latency from 6.2s to 1.4s")
- 1-2 bullets: Leadership/collaboration — team size, cross-functional work, stakeholder management (e.g., "partnering with VP of Engineering", "leading a team of 8")

COMPANY & DOMAIN CONTEXT:
- When specific companies are provided, use your knowledge of that company to generate
  domain-appropriate bullet points. This means:
  - Use industry-specific terminology (e.g., "clinical trials" for pharma, "capital allocation" for fintech)
  - Reference domain-specific tools and platforms (e.g., Veeva CRM for pharma, Basel III for banking)
  - Create realistic project scenarios that someone at that company would actually work on
  - The JD's requirements determine WHICH aspects of the domain to emphasize
- When a domain keyword is provided instead of a company name (e.g., "Fintech" instead of "Capital One"),
  generate domain-appropriate content without referencing a specific employer
- If the user provides a description of what they did at a company, use it to anchor the bullet points
  in realistic scenarios. Embellish with metrics and JD keywords, but keep the core work accurate.

TECHNOLOGY TIMELINE (HARD CONSTRAINT — violations are unacceptable):
${Object.entries(config.TECH_TIMELINE).map(([tech, t]) => `- ${tech}: not before ${t.earliest}`).join("\n")}

CRITICAL: Check EVERY bullet against this timeline. If a role starts before the year listed, do NOT mention that technology. Use older equivalent technologies instead (e.g., "NLP pipeline" instead of "RAG" for pre-2023 roles).`;
}

function buildSystemPromptXL() {
  return `You are a resume generator that creates keyword-heavy, ATS-optimized resumes using the Google XYZ formula. Your goal is to produce a dense, 3-page resume where EVERY bullet scores 5+ out of 7 on quality.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations, no extra text
2. Use the exact JSON schema provided below
3. Generate realistic work history with 3-4 companies over 6-7 years
4. Use strong, direct action verbs: Built, Designed, Developed, Led, Reduced, Improved. NEVER use weak/passive verbs (Assisted, Helped, Participated, Supported, Maintained, Wrote, Served, Completed, Handled, Utilized, Worked, Collaborated, Contributed, Stood)
5. EVERY bullet MUST include: (a) strong action verb, (b) specific technology/framework name
6. Most bullets should include a quantifiable metric, but not ALL — see WRITING STYLE below
7. NEVER mention a technology in a role if the role's dates are BEFORE the technology existed. This is a HARD CONSTRAINT that overrides keyword density. See TECHNOLOGY TIMELINE below.

Use these SHORT KEYS in your JSON response (saves tokens):
{
  "jd": {
    "rt": "role title",
    "ind": "industry",
    "cp": "aws|azure|gcp",
    "kt": ["tech1", "tech2"],
    "rs": ["skill1", "skill2"]
  },
  "ps": "5-8 sentence summary packed with technologies, methodologies, and domain keywords from the JD",
  "ts": {
    "lang": "comma-separated list",
    "fw": "comma-separated list",
    "cloud": "comma-separated list",
    "db": "comma-separated list",
    "tools": "comma-separated list"
  },
  "exp": [
    {
      "co": "Company Name",
      "ti": "Job Title",
      "loc": "City, State",
      "sd": "MMM YYYY",
      "ed": "MMM YYYY",
      "b": [
        "XYZ formula bullet with technology name AND metric",
        "Another XYZ bullet with specific framework AND percentage"
      ]
    }
  ]
}

WORK HISTORY GUIDELINES:
- Current role: 18-28 months
- Previous roles: 18-28 months each
- Include 1-2 IT services companies (${config.IT_SERVICES_FIRMS.slice(0, 3).join(", ")})
- Use competitor companies from the target industry
- Each role should have 10-15 detailed bullets
- The resume should span approximately 3 pages
- Timeline must be realistic (no gaps, no overlaps)

BULLET REQUIREMENTS:
- Start with a strong, past-tense action verb (Built, Designed, Developed, Led, Reduced, Improved)
- Include specific technologies mentioned in JD
- Do NOT end bullet points with periods
- Keep bullets to 1-2 lines (under 250 characters for XL mode)
- Focus on achievements, not responsibilities
- Use digits instead of spelling out numbers
- NEVER use a technology before its introduction year (see TECHNOLOGY TIMELINE below)
${buildAntiSlopPromptSection("xl")}
BULLET ORDERING (CRITICAL FOR SKIMMABILITY):
The first 3 bullets of each role are the ONLY ones most hiring managers will read.
- Bullets 1-2 MUST be the strongest: show SCOPE, IMPACT, and LEADERSHIP
- Bullet 1 answers "what is the biggest thing this person did here?" — scale, transformation, revenue
- Bullet 2 answers "what business problem did they solve?" — compliance, cost, reliability, customer satisfaction
- Bullet 3: a strong technical achievement with clear metrics
- Bullets 4+: technical depth, architecture, tooling, mentoring, process improvements

BUSINESS VALUE MIX (per role):
With 10-15 bullets, mix these types:
- 3-4 bullets: Business impact — scale served, revenue influenced, compliance achieved, customer outcomes
- 4-5 bullets: Technical achievement — performance gains, architecture, system design, migrations
- 2-3 bullets: Leadership/collaboration — team size, cross-functional work, stakeholder management

PROFESSIONAL SUMMARY REQUIREMENTS:
- Write 5-8 sentences covering experience breadth, key technologies, cloud platforms, methodologies, and domain expertise
- Pack with keywords: programming languages, frameworks, cloud services, databases, and methodologies from the JD
- Include years of experience, scale of systems worked on, and industry context

COMPANY & DOMAIN CONTEXT:
- When specific companies are provided, use your knowledge of that company to generate
  domain-appropriate bullet points. This means:
  - Use industry-specific terminology (e.g., "clinical trials" for pharma, "capital allocation" for fintech)
  - Reference domain-specific tools and platforms (e.g., Veeva CRM for pharma, Basel III for banking)
  - Create realistic project scenarios that someone at that company would actually work on
  - The JD's requirements determine WHICH aspects of the domain to emphasize
- When a domain keyword is provided instead of a company name (e.g., "Fintech" instead of "Capital One"),
  generate domain-appropriate content without referencing a specific employer
- If the user provides a description of what they did at a company, use it to anchor the bullet points
  in realistic scenarios. Embellish with metrics and JD keywords, but keep the core work accurate.

TECHNOLOGY TIMELINE (HARD CONSTRAINT — violations are unacceptable):
${Object.entries(config.TECH_TIMELINE).map(([tech, t]) => `- ${tech}: not before ${t.earliest}`).join("\n")}

CRITICAL: Check EVERY bullet against this timeline. If a role starts in 2022 or earlier, do NOT mention RAG, LangChain, or other post-2022 technologies in that role's bullets. Use older equivalent technologies instead (e.g., use "NLP pipeline" or "information retrieval" instead of "RAG" for pre-2023 roles). This constraint takes PRIORITY over keyword density.`;
}

function buildUserMessage(jd, customer, context, companies) {
  let message = `Generate a resume for this job description:\n\n${jd}`;

  if (customer) {
    message += `\n\nTarget company (the company being applied to): ${customer}`;
  }

  if (companies && companies.length > 0) {
    message += `\n\nWORK HISTORY COMPANIES (use these as the candidate's past employers, in order from most recent to earliest):`;
    companies.forEach((c, i) => {
      message += `\n\nCompany ${i + 1}: ${c.name}`;
      if (c.title) message += `\n  Title: ${c.title}`;
      if (c.description) message += `\n  What they did: ${c.description}`;
    });

    if (companies.length < 3) {
      message += `\n\nNote: Only ${companies.length} company${companies.length === 1 ? '' : 'ies'} provided. Fill remaining roles to reach 3-4 total companies over 6-7 years. Use one IT services firm (e.g., ${config.IT_SERVICES_FIRMS.slice(0, 3).join(", ")}) as the earliest role, and fill any other gaps with a relevant competitor company from the target industry.`;
    }
  } else {
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

    // Role-level penalty: if every bullet in a role has a number, penalize all of them
    const rolePenalties = config.QUALITY_SCORING.role_level_penalties;
    if (rolePenalties && companyResult.bullets.length >= 3) {
      const hasNumber = /\d/;
      const allHaveMetrics = companyResult.bullets.every(b => hasNumber.test(b.text));
      if (allHaveMetrics) {
        for (const b of companyResult.bullets) {
          b.score = Math.max(0, b.score + rolePenalties.all_metrics_penalty_per_bullet);
          b.breakdown.push(rolePenalties.all_metrics_label);
          totalScore += rolePenalties.all_metrics_penalty_per_bullet;
        }
      }
    }

    // Check if first 2 bullets are strong (skimmability warning)
    const firstTwo = companyResult.bullets.slice(0, 2);
    const weakLeaders = firstTwo.filter(b => b.score < config.QUALITY_SCORING.thresholds.good);
    if (weakLeaders.length > 0) {
      companyResult.ordering_warning = `First ${weakLeaders.length} bullet(s) score below "Good" — consider reordering to put your strongest achievements first`;
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
  let bizScore = 0;
  const breakdown = [];

  // Check for action verb at start
  const firstWord = bullet.split(/\s+/)[0].toLowerCase();
  const isWeakVerb = config.WEAK_VERBS.some(v => firstWord === v.toLowerCase());
  const startsWithActionVerb = Object.values(config.ACTION_VERBS)
    .flat()
    .some(verb => bullet.toLowerCase().startsWith(verb.toLowerCase()));

  if (isWeakVerb) {
    score -= 1;
    breakdown.push("Weak action verb (penalty)");
  } else if (startsWithActionVerb) {
    score += config.QUALITY_SCORING.verb_check_points;
    breakdown.push("Strong action verb");
  }

  // Check scoring rules — separate business group
  for (const rule of config.QUALITY_SCORING.rules) {
    if (rule.pattern.test(bullet)) {
      if (rule.group === "business") {
        bizScore += rule.points;
      } else {
        score += rule.points;
      }
      breakdown.push(rule.label);
    }
  }

  // Apply business group cap to prevent inflation
  const cap = config.QUALITY_SCORING.business_group_cap || 3;
  const cappedBiz = Math.min(bizScore, cap);
  score += cappedBiz;

  // Note: no penalty for missing metrics — not every bullet needs numbers

  if (bullet.length > 220) {
    score += config.QUALITY_SCORING.over_200_chars_penalty;
    breakdown.push("Too long (penalty)");
  }

  // Anti-slop penalties
  if (config.QUALITY_SCORING.slop_penalties) {
    for (const rule of config.QUALITY_SCORING.slop_penalties) {
      if (rule.pattern.test(bullet)) {
        score += rule.points;
        breakdown.push(rule.label);
      }
    }
  }

  // Authenticity bonuses
  if (config.QUALITY_SCORING.authenticity_bonuses) {
    for (const rule of config.QUALITY_SCORING.authenticity_bonuses) {
      if (rule.pattern.test(bullet)) {
        score += rule.points;
        breakdown.push(rule.label);
      }
    }
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
7. REWRITE bullet points to highlight achievements — mix XYZ, CAR, and natural sentence structures
8. ADD quantifiable metrics to most bullets, but not ALL — see WRITING STYLE below
9. WEAVE IN missing keywords and technologies from the job description naturally into bullets
10. OPTIMIZE the professional summary for the target role
11. REORDER technical skills to prioritize what the JD asks for
12. Use strong, direct action verbs: Built, Designed, Developed, Led, Reduced, Improved. NEVER use weak/passive verbs (Assisted, Helped, Participated, Supported, Maintained, Wrote, Served, Completed, Handled, Utilized, Worked, Collaborated, Contributed, Stood)
13. NEVER mention a technology in a role dated BEFORE that technology existed (see TECHNOLOGY TIMELINE below). This is a HARD CONSTRAINT.

Use these SHORT KEYS in your JSON response (saves tokens):
{
  "jd": {
    "rt": "role title",
    "ind": "industry",
    "cp": "aws|azure|gcp",
    "kt": ["tech1", "tech2"],
    "rs": ["skill1", "skill2"]
  },
  "ct": {
    "n": "extracted from resume",
    "em": "extracted from resume",
    "ph": "extracted from resume",
    "li": "extracted from resume or empty string",
    "gh": "extracted from resume or empty string"
  },
  "edu": [
    {
      "sc": "University Name",
      "dg": "Degree Name",
      "loc": "City, State",
      "sd": "MMM YYYY",
      "ed": "MMM YYYY"
    }
  ],
  "ps": "2-3 sentence summary optimized for the target role",
  "ts": {
    "lang": "comma-separated, prioritized by JD relevance",
    "fw": "comma-separated",
    "cloud": "comma-separated",
    "db": "comma-separated",
    "tools": "comma-separated"
  },
  "exp": [
    {
      "co": "EXACT company name from resume",
      "ti": "EXACT title from resume",
      "loc": "City, State from resume",
      "sd": "MMM YYYY from resume",
      "ed": "MMM YYYY from resume",
      "b": [
        "Rewritten XYZ formula bullet with metrics and JD keywords",
        "Another rewritten bullet with specific quantified results"
      ]
    }
  ]
}

OPTIMIZATION RULES:
- Keep the SAME number of jobs and same career structure
- Each role should have 6-8 bullets
- Do NOT end bullet points with periods
- Keep bullets to 1-2 lines (under 200 characters)
- If the original bullet lacks a metric, add a realistic one based on context — but NOT every bullet needs a number
- Prioritize technologies mentioned in the JD
- For skills section: include ALL technologies from the original resume, but list JD-relevant ones first
- If contact fields are not found in the resume, use empty strings
- NEVER use weak/passive verbs (Assisted, Helped, Participated, Supported, Maintained, Wrote, Served, Completed, Handled, Utilized, Worked, Collaborated, Contributed, Stood). Use direct verbs (Built, Designed, Developed, Led, Reduced, Improved)
${buildAntiSlopPromptSection("optimize")}
BULLET ORDERING (CRITICAL FOR SKIMMABILITY):
When rewriting bullets, place the strongest rewritten bullets FIRST in each role.
- Bullet 1 MUST answer "what is the biggest thing this person did here?" — show SCOPE, IMPACT, and LEADERSHIP
- Bullet 2 MUST answer "what business problem did they solve?" — compliance, cost savings, reliability, customer satisfaction
- Bullets 3-4: technical depth — architecture decisions, technology migrations, performance gains
- Remaining bullets: supporting achievements, tooling, mentoring, process improvements

BUSINESS VALUE MIX (per role):
- 2-3 bullets: Business impact — scale served, revenue influenced, compliance achieved, customer outcomes
- 2-3 bullets: Technical achievement — performance gains, architecture, system design
- 1-2 bullets: Leadership/collaboration — team size, cross-functional work, stakeholder management

TECHNOLOGY TIMELINE (HARD CONSTRAINT — violations are unacceptable):
${Object.entries(config.TECH_TIMELINE).map(([tech, t]) => `- ${tech}: not before ${t.earliest}`).join("\n")}

CRITICAL: Check EVERY bullet against this timeline. If a role starts before the year listed, do NOT mention that technology. Use older equivalent technologies instead (e.g., "NLP pipeline" instead of "RAG" for pre-2023 roles).`;
}

function buildOptimizeSystemPromptXL() {
  return `You are a resume optimizer that rewrites existing resumes to be keyword-heavy, ATS-optimized for a specific job description using the Google XYZ formula. Your goal is a dense 3-page resume where EVERY bullet scores 5+ out of 7 on quality.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no explanations, no extra text
2. Use the exact JSON schema provided below
3. PRESERVE the candidate's real companies, job titles, dates, and locations EXACTLY as they appear
4. Do NOT invent new companies, roles, or change employment dates
5. EXTRACT contact info (name, email, phone, linkedin, github) from the resume
6. EXTRACT education details (schools, degrees, dates, locations) from the resume
7. REWRITE bullet points to highlight achievements — mix XYZ, CAR, and natural sentence structures
8. ADD quantifiable metrics to most bullets, but not ALL — see WRITING STYLE below
9. WEAVE IN missing keywords and technologies from the job description naturally into bullets
10. OPTIMIZE the professional summary for the target role — make it 5-8 sentences packed with keywords
11. REORDER technical skills to prioritize what the JD asks for
12. Use strong, direct action verbs: Built, Designed, Developed, Led, Reduced, Improved. NEVER use weak/passive verbs (Assisted, Helped, Participated, Supported, Maintained, Wrote, Served, Completed, Handled, Utilized, Worked, Collaborated, Contributed, Stood)
13. NEVER mention a technology in a role if the role's dates are BEFORE the technology existed. This is a HARD CONSTRAINT. See TECHNOLOGY TIMELINE below.

Use these SHORT KEYS in your JSON response (saves tokens):
{
  "jd": {
    "rt": "role title",
    "ind": "industry",
    "cp": "aws|azure|gcp",
    "kt": ["tech1", "tech2"],
    "rs": ["skill1", "skill2"]
  },
  "ct": {
    "n": "extracted from resume",
    "em": "extracted from resume",
    "ph": "extracted from resume",
    "li": "extracted from resume or empty string",
    "gh": "extracted from resume or empty string"
  },
  "edu": [
    {
      "sc": "University Name",
      "dg": "Degree Name",
      "loc": "City, State",
      "sd": "MMM YYYY",
      "ed": "MMM YYYY"
    }
  ],
  "ps": "5-8 sentence summary packed with technologies, methodologies, and domain keywords",
  "ts": {
    "lang": "comma-separated, prioritized by JD relevance",
    "fw": "comma-separated",
    "cloud": "comma-separated",
    "db": "comma-separated",
    "tools": "comma-separated"
  },
  "exp": [
    {
      "co": "EXACT company name from resume",
      "ti": "EXACT title from resume",
      "loc": "City, State from resume",
      "sd": "MMM YYYY from resume",
      "ed": "MMM YYYY from resume",
      "b": [
        "Rewritten XYZ bullet with technology name AND metric scoring 5+/7",
        "Another rewritten bullet with specific framework AND percentage"
      ]
    }
  ]
}

OPTIMIZATION RULES:
- Keep the SAME number of jobs and same career structure
- Each role should have 10-15 detailed bullets
- If original has fewer than 10 bullets per role, ADD more bullets with JD keywords
- Do NOT end bullet points with periods
- Keep bullets under 250 characters
- Prioritize technologies mentioned in the JD
- For skills section: include ALL technologies from the original resume, but list JD-relevant ones first
- If contact fields are not found in the resume, use empty strings
- PROFESSIONAL SUMMARY must be 5-8 sentences packed with keywords from the JD
${buildAntiSlopPromptSection("optimize-xl")}
BULLET ORDERING (CRITICAL FOR SKIMMABILITY):
Place the strongest rewritten bullets FIRST in each role.
- Bullets 1-2 MUST be the strongest: show SCOPE, IMPACT, and LEADERSHIP
- Bullet 1 answers "what is the biggest thing this person did here?" — scale, transformation, revenue
- Bullet 2 answers "what business problem did they solve?" — compliance, cost, reliability, customer satisfaction
- Bullet 3: a strong technical achievement with clear metrics
- Bullets 4+: technical depth, architecture, tooling, mentoring, process improvements

BUSINESS VALUE MIX (per role):
With 10-15 bullets, mix these types:
- 3-4 bullets: Business impact — scale served, revenue influenced, compliance achieved, customer outcomes
- 4-5 bullets: Technical achievement — performance gains, architecture, system design, migrations
- 2-3 bullets: Leadership/collaboration — team size, cross-functional work, stakeholder management

TECHNOLOGY TIMELINE (HARD CONSTRAINT — violations are unacceptable):
${Object.entries(config.TECH_TIMELINE).map(([tech, t]) => `- ${tech}: not before ${t.earliest}`).join("\n")}

CRITICAL: Check EVERY bullet against this timeline. If a role starts before the year listed, do NOT mention that technology. This constraint takes PRIORITY over keyword density. Use older equivalent technologies instead (e.g., "NLP pipeline" instead of "RAG" for pre-2023 roles).`;
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

function buildAntiSlopPromptSection(mode) {
  const slop = config.ANTI_SLOP;

  const hardWords = slop.banned_words.filter(w => w.severity === "hard").map(w => w.word);
  const softWords = slop.banned_words.filter(w => w.severity === "soft").map(w => w.word);
  const hardPhrases = slop.banned_phrases.filter(p => p.severity === "hard").map(p => p.phrase);
  const softPhrases = slop.banned_phrases.filter(p => p.severity === "soft").map(p => p.phrase);

  const ratio = slop.max_metric_ratio[mode] || slop.max_metric_ratio.standard;

  let section = `\nWRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:\n`;
  section += slop.tone + "\n";

  section += `\nNEVER use these words — they are the #1 signal of AI-generated writing:\n`;
  section += hardWords.join(", ") + "\n";

  section += `\nAvoid these words when possible:\n`;
  section += softWords.join(", ") + "\n";

  section += `\nNEVER use these phrase patterns:\n`;
  section += hardPhrases.map(p => `- "${p}"`).join("\n") + "\n";

  if (softPhrases.length > 0) {
    section += `\nAvoid these phrases when possible:\n`;
    section += softPhrases.map(p => `- "${p}"`).join("\n") + "\n";
  }

  section += `\nSTRUCTURAL ANTI-PATTERNS TO AVOID:\n`;
  for (const pat of slop.structural_patterns) {
    const verb = pat.severity === "hard" ? "NEVER" : "Avoid";
    section += `\n${verb}: ${pat.description}\n`;
    section += `  BAD: "${pat.example_bad}"\n`;
    section += `  GOOD: "${pat.example_good}"\n`;
  }

  section += `\nMETRIC RATIO (STRICTLY ENFORCED): ${ratio.description}.\n`;
  section += `HARD RULE: For each role, at least 2 bullets MUST contain ZERO numbers, ZERO percentages, ZERO dollar amounts, ZERO "X to Y" comparisons.\n`;
  section += `These no-metric bullets should describe WHAT you built, HOW it worked, or WHY it mattered — in plain words only.\n`;
  section += `Example no-metric bullet: "Owned the on-call rotation for the payments team — wrote the runbook that new engineers still use"\n`;

  // Verb overuse
  if (slop.verb_overuse) {
    section += `\nVERB VARIETY (STRICTLY ENFORCED): ${slop.verb_overuse.description}\n`;
    section += `Maximum ${slop.verb_overuse.max_per_verb} bullets across the ENTIRE resume may start with the same verb.\n`;
  }

  // Summary rules
  if (slop.summary_rules) {
    section += `\nPROFESSIONAL SUMMARY RULES:\n`;
    section += slop.summary_rules.description + "\n";
    section += `NEVER start with these patterns:\n`;
    section += slop.summary_rules.banned_patterns.map(p => `- "${p}"`).join("\n") + "\n";
    section += `  BAD: "${slop.summary_rules.example_bad}"\n`;
    section += `  GOOD: "${slop.summary_rules.example_good}"\n`;
  }

  section += `\nEXAMPLES — LEARN THE DIFFERENCE:\n`;
  for (const ex of slop.examples) {
    section += `\n  BAD: "${ex.bad}"\n`;
    section += `  GOOD: "${ex.good}"\n`;
    section += `  WHY: ${ex.why}\n`;
  }

  section += `\nMix sentence structures naturally — do NOT write every bullet in the same pattern:\n`;
  section += `- Some bullets: "Accomplished [X] by doing [Y], resulting in [Z]" (XYZ)\n`;
  section += `- Some bullets: "Faced [challenge], took [action], achieved [result]" (CAR)\n`;
  section += `- Some bullets: Start with the impact/scale, then explain how\n`;
  section += `- Some bullets: Lead with the technology choice, then show the outcome\n`;
  section += `- Some bullets: End with a period after the main clause. Do NOT tack on a trailing participial phrase.\n`;

  return section;
}

module.exports = {
  buildSystemPrompt,
  buildSystemPromptXL,
  buildUserMessage,
  buildOptimizeSystemPrompt,
  buildOptimizeSystemPromptXL,
  buildOptimizeUserMessage,
  buildAntiSlopPromptSection,
  scoreResume,
  validateTimeline
};