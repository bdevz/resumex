#!/usr/bin/env node
// ============================================================================
// scripts/local-generate.js — local resume generation harness (no AWS)
//
// Mirrors lambda handleAnalyze/handleOptimize: builds the domain-aware prompt,
// calls the Anthropic API directly via fetch, parses + scores the result, and
// prints a keyword-coverage report. Lets you test domain packs locally before
// deploying.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/local-generate.js \
//     --domain workday --mode generate --jd .context/local-test/jd-workday.txt \
//     [--xl] [--certs] [--model claude-opus-4-6] [--resume path]
// ============================================================================
const fs = require("fs");
const path = require("path");
const prompts = require("../lambda/lib/prompts");

const ANTHROPIC_MODELS = {
  "claude-opus-4.6": "claude-opus-4-6",
  "claude-opus-4.5": "claude-opus-4-5-20251101",
  "claude-sonnet-4.6": "claude-sonnet-4-6",
  "claude-sonnet-4.5": "claude-sonnet-4-5-20250929",
  "claude-haiku-4.5": "claude-haiku-4-5-20251001",
};

const SHORT_TO_FULL = {
  jd: "parsed_jd", rt: "role_title", ind: "industry", cp: "cloud_platform",
  kt: "key_technologies", rs: "required_skills", ps: "professional_summary",
  ts: "technical_skills", lang: "Languages", fw: "Frameworks & Libraries",
  cloud: "Cloud & DevOps", db: "Databases", tools: "Tools & Practices",
  exp: "experience", co: "company", ti: "title", loc: "location",
  sd: "start_date", ed: "end_date", b: "bullets", ct: "contact", n: "name",
  em: "email", ph: "phone", li: "linkedin", gh: "github", edu: "education",
  sc: "school", dg: "degree", cert: "certifications",
};
function expandKeys(obj) {
  if (Array.isArray(obj)) return obj.map(expandKeys);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[SHORT_TO_FULL[k] || k] = expandKeys(v);
    return out;
  }
  return obj;
}
function extractJSON(text) {
  if (!text || !text.trim()) return null;
  try { return JSON.parse(text.trim()); } catch {}
  const f = text.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/);
  if (f) { try { return JSON.parse(f[1].trim()); } catch {} }
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a !== -1 && b > a) { try { return JSON.parse(text.substring(a, b + 1)); } catch {} }
  return null;
}

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

(async () => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error("ERROR: set ANTHROPIC_API_KEY"); process.exit(1); }

  const domain = arg("domain", "software");
  const mode = arg("mode", "generate");
  const xl = !!arg("xl", false);
  const certs = !!arg("certs", false);
  const model = ANTHROPIC_MODELS[arg("model", "claude-opus-4.6")] || arg("model", "claude-opus-4-6");
  const jdPath = arg("jd");
  const jd = fs.readFileSync(path.resolve(jdPath), "utf8");

  let systemPrompt, userMessage;
  if (mode === "optimize") {
    const resume = fs.readFileSync(path.resolve(arg("resume")), "utf8");
    systemPrompt = xl ? prompts.buildOptimizeSystemPromptXL(domain, certs)
                      : prompts.buildOptimizeSystemPrompt(domain, certs);
    userMessage = prompts.buildOptimizeUserMessage(resume, jd, undefined);
  } else {
    systemPrompt = xl ? prompts.buildSystemPromptXL(domain, certs)
                      : prompts.buildSystemPrompt(domain, certs);
    userMessage = prompts.buildUserMessage(jd, undefined, undefined, undefined, domain);
  }

  console.log(`\n=== ${domain.toUpperCase()} | ${mode}${xl ? " | XL" : ""}${certs ? " | +certs" : ""} | ${model} ===`);
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: xl ? 16384 : 8192, system: systemPrompt,
      messages: [{ role: "user", content: userMessage }] }),
  });
  if (!res.ok) { console.error("API error", res.status, await res.text()); process.exit(1); }
  const data = await res.json();
  const txt = data.content?.[0]?.text || "";
  const resume = expandKeys(extractJSON(txt));
  if (!resume) { console.error("Invalid JSON:\n", txt.slice(0, 800)); process.exit(1); }

  const scoring = prompts.scoreResume(resume, domain);
  const warnings = prompts.validateTimeline(resume, domain);

  console.log(`\n--- PROFESSIONAL SUMMARY ---\n${resume.professional_summary}`);
  console.log(`\n--- TECHNICAL SKILLS ---`);
  for (const [k, v] of Object.entries(resume.technical_skills || {})) console.log(`  ${k}: ${v}`);
  if (resume.certifications) console.log(`\n--- CERTIFICATIONS ---\n  ${(resume.certifications || []).join("  •  ")}`);
  console.log(`\n--- EXPERIENCE ---`);
  for (const e of resume.experience || []) {
    console.log(`\n${e.company} — ${e.title} (${e.start_date}–${e.end_date})`);
    (e.bullets || []).forEach((b) => console.log(`  • ${b}`));
  }

  // Keyword coverage: capitalised/known terms from the JD present in the resume text
  const blob = JSON.stringify(resume).toLowerCase();
  const terms = [...new Set((jd.match(/\b(?:[A-Z][A-Za-z0-9.+/]{1,}|EIB|LWC|SOQL|SOSL|CPQ|HCM|UAT|API|REST|SOAP|XSLT|R1|R2|OWD)\b/g) || [])
    .filter((w) => !["We","The","Senior","Responsibilities","Requirements","Strong","Prior","Experience","Manage","Build","Design","Configure","Develop","Write","Integrate","Gather","Lead","Own"].includes(w)))];
  const missing = terms.filter((w) => !blob.includes(w.toLowerCase()));
  console.log(`\n--- KEYWORD COVERAGE ---`);
  console.log(`  ${terms.length - missing.length}/${terms.length} JD terms present (${Math.round((1 - missing.length / terms.length) * 100)}%)`);
  if (missing.length) console.log(`  MISSING: ${missing.join(", ")}`);
  console.log(`\n--- SCORING ---  avg ${scoring.average} over ${scoring.bulletCount} bullets`);
  for (const r of scoring.results) {
    const grades = r.bullets.map((b) => b.score).join(",");
    console.log(`  ${r.company}: [${grades}]${r.ordering_warning ? "  ⚠ " + r.ordering_warning : ""}`);
  }
  if (warnings.length) console.log(`\n--- TIMELINE WARNINGS ---\n  ${warnings.join("\n  ")}`);
  console.log(`\n(done in ${Math.round((Date.now() - t0) / 1000)}s, ${data.usage?.output_tokens || "?"} out tokens)\n`);
})();
