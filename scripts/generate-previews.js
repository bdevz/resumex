#!/usr/bin/env node
// Generate DOCX preview files for each template using realistic sample data
// Usage: node scripts/generate-previews.js
//   Then: convert DOCX → PDF → JPG using LibreOffice + ImageMagick

const path = require("path");
const fs = require("fs");
const { buildResume } = require("../lambda/lib/docx-builder");
const { TEMPLATES } = require("../lambda/lib/templates");

const SAMPLE_RESUME = {
  contact: {
    name: "Violet Rodriguez",
    email: "violet@email.com",
    phone: "(555) 123-4567",
    location: "New York, NY",
    linkedin: "linkedin.com/in/violet-r",
  },
  professional_summary:
    "Senior software engineer with 8+ years building scalable web applications and distributed systems. Led migration of monolithic architecture to microservices, reducing deployment time by 70% and improving system reliability to 99.95% uptime. Passionate about mentoring junior engineers and driving engineering culture.",
  technical_skills: {
    Languages: "TypeScript, Python, Go, SQL, Java, Rust",
    Frameworks: "React, Next.js, FastAPI, Spring Boot, Node.js, Express",
    "Cloud & DevOps": "AWS (ECS, Lambda, S3, DynamoDB), Docker, Kubernetes, Terraform, CI/CD",
    "Data & Tools": "PostgreSQL, Redis, Kafka, Elasticsearch, Datadog, Git",
  },
  experience: [
    {
      company: "Acme Technologies",
      title: "Senior Software Engineer",
      location: "San Francisco, CA",
      start_date: "Jan 2022",
      end_date: "Present",
      bullets: [
        "Architected event-driven microservices platform processing 2M+ daily transactions with 99.95% uptime using Kafka, Go, and Kubernetes",
        "Led team of 6 engineers to deliver real-time analytics dashboard, reducing customer churn analysis time from 3 days to under 15 minutes",
        "Designed and implemented CI/CD pipeline with automated canary deployments, cutting release cycle from 2 weeks to same-day delivery",
        "Mentored 4 junior engineers through structured code review and pair programming, with 2 promoted within 18 months",
      ],
    },
    {
      company: "Digital Solutions Inc.",
      title: "Software Engineer",
      location: "New York, NY",
      start_date: "Mar 2019",
      end_date: "Dec 2021",
      bullets: [
        "Built full-stack inventory management system serving 500+ retail locations using React, Node.js, and PostgreSQL",
        "Optimized database queries and implemented Redis caching layer, reducing API response times by 65% across 12 endpoints",
        "Developed automated testing framework achieving 92% code coverage, reducing production incidents by 40% quarter-over-quarter",
      ],
    },
    {
      company: "StartupCo",
      title: "Junior Developer",
      location: "Austin, TX",
      start_date: "Jun 2017",
      end_date: "Feb 2019",
      bullets: [
        "Developed customer-facing features for SaaS platform using React and Python Flask, growing active users from 1K to 15K",
        "Implemented OAuth 2.0 authentication flow and role-based access control supporting 3 distinct user tiers",
      ],
    },
  ],
  education: [
    {
      school: "University of California, Berkeley",
      degree: "Bachelor of Science, Computer Science",
      location: "Berkeley, CA",
      graduated: "2017",
    },
  ],
};

async function main() {
  const outDir = path.join(__dirname, "..", "frontend", "templates", "docx");
  fs.mkdirSync(outDir, { recursive: true });

  const templateIds = Object.keys(TEMPLATES);
  console.log(`Generating ${templateIds.length} template previews...`);

  for (const id of templateIds) {
    const buffer = await buildResume(SAMPLE_RESUME, null, {
      template: id,
      includeEducation: true,
    });
    const outPath = path.join(outDir, `${id}.docx`);
    fs.writeFileSync(outPath, buffer);
    console.log(`  ✓ ${id}.docx`);
  }

  console.log(`\nDOCX files written to ${outDir}`);
  console.log("Next steps:");
  console.log("  1. Convert to PDF:  libreoffice --headless --convert-to pdf --outdir <dir> *.docx");
  console.log("  2. Convert to JPG:  magick -density 200 file.pdf -quality 90 file.jpg");
}

main().catch(console.error);
