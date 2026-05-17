#!/usr/bin/env node
// ============================================================================
// scripts/preview-designs.js — render real .docx files for several designs
// from a sample resume so you can open them in Word and eyeball the output.
// No AWS, no API key. Usage:
//   node scripts/preview-designs.js [--resume path-to-resume.json]
//   open .context/design-previews/*.docx
// ============================================================================
const fs = require("fs");
const path = require("path");
const { buildResume } = require("../lambda/lib/docx-builder");

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i !== -1 ? process.argv[i + 1] : null;
};

const SAMPLE = {
  contact: {
    name: "Violet Rodriguez",
    phone: "(555) 123-4567",
    email: "violet@email.com",
    linkedin: "linkedin.com/in/violet",
    github: "github.com/violet",
  },
  professional_summary:
    "Backend engineer who likes hard infrastructure problems and teams that ship daily. Currently working on payments reliability; before that, search ranking.",
  technical_skills: {
    Languages: "Go, Python, TypeScript, SQL",
    "Cloud & DevOps": "AWS, Terraform, Kubernetes, GitHub Actions",
    Databases: "PostgreSQL, Redis, DynamoDB",
    "Tools & Practices": "Kafka, gRPC, Datadog, OpenTelemetry",
  },
  experience: [
    {
      company: "Acme Technologies",
      title: "Senior Software Engineer",
      location: "San Francisco, CA",
      start_date: "Jan 2022",
      end_date: "Present",
      bullets: [
        "Built a Kafka-based event pipeline that replaced the polling system three teams had been complaining about",
        "Owned the on-call rotation for the payments team — wrote the runbook new engineers still use",
        "Reduced p99 checkout latency from 1.8s to 240ms by adding a Redis read-through cache",
        "Led the migration of 14 services from EC2 to EKS over four months",
      ],
    },
    {
      company: "Digital Solutions Inc.",
      title: "Software Engineer",
      location: "New York, NY",
      start_date: "Mar 2019",
      end_date: "Dec 2021",
      bullets: [
        "Shipped the ranking service that powered search for 4.2M monthly users",
        "Cut nightly batch runtime in half by rewriting the join in Spark",
        "Mentored two junior engineers through their first production launches",
      ],
    },
  ],
  education: [
    { school: "University of California, Berkeley", degree: "B.S. Computer Science", location: "Berkeley, CA", graduated: "May 2017" },
  ],
  certifications: ["AWS Certified Solutions Architect"],
  projects: [
    { name: "resumex", tech: "Node.js, docx", bullets: ["Composable DOCX resume design engine"] },
  ],
};

const DESIGNS = [
  { file: "01-preset-classic.docx",       opts: { template: "classic" } },
  { file: "02-preset-modern-xl.docx",     opts: { template: "modern", length: "xl" } },
  { file: "03-compose-extended.docx",     opts: { length: "extended", design: { compose: true, seed: "demo-1" } } },
  { file: "04-compose-extended-2.docx",   opts: { length: "extended", design: { compose: true, seed: "demo-2" } } },
  {
    file: "05-single-split-banner.docx",
    opts: {
      length: "extended",
      design: {
        layout: "single-split", palette: "navy", typography: "georgia-serif",
        headerStyle: "top-bottom",
        elements: { dividers: true },
      },
    },
  },
  {
    file: "06-single-banner-callout.docx",
    opts: {
      length: "extended",
      design: {
        layout: "single-banner", palette: "maroon", typography: "georgia-exec",
        headerStyle: "thick-bottom",
        elements: { callout: true, dividers: true },
      },
    },
  },
  {
    file: "07-twocol-optin-allelements.docx",
    opts: {
      length: "extended",
      design: {
        layout: "two-column-left", palette: "navy", typography: "georgia-serif",
        headerStyle: "shading",
        sectionOrder: ["contact", "summary", "skills", "projects", "experience", "education", "certifications"],
        elements: { skillBars: true, dividers: true, callout: true, icons: true },
      },
    },
  },
];

(async () => {
  const resume = arg("resume")
    ? JSON.parse(fs.readFileSync(arg("resume"), "utf8"))
    : SAMPLE;

  const outDir = path.join(__dirname, "..", ".context", "design-previews");
  fs.mkdirSync(outDir, { recursive: true });

  for (const d of DESIGNS) {
    const buf = await buildResume(resume, null, d.opts);
    const p = path.join(outDir, d.file);
    fs.writeFileSync(p, buf);
    console.log(`  ${d.file}  (${buf.length} bytes)`);
  }
  console.log(`\nWrote ${DESIGNS.length} resumes to ${outDir}`);
  console.log(`Open them:  open "${outDir}"/*.docx`);
})().catch((e) => { console.error("FAILED:", e); process.exit(1); });
