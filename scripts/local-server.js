#!/usr/bin/env node
// ============================================================================
// scripts/local-server.js — run the ResumeX frontend + backend locally.
// Zero dependencies (Node http only). No AWS.
//
//   node scripts/local-server.js                # /build works offline
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/local-server.js   # + generate
//
// Then open http://localhost:8787 and use any passphrase.
// /build (DOCX) needs no key. /analyze + /optimize need ANTHROPIC_API_KEY.
// ============================================================================
const http = require("http");
const fs = require("fs");
const path = require("path");
const { buildResume } = require("../lambda/lib/docx-builder");
const prompts = require("../lambda/lib/prompts");
const { lintResume } = require("../lambda/lib/review");

const PORT = process.env.PORT || 8787;
const INDEX = path.join(__dirname, "..", "frontend", "index.html");

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
const expand = (o) => Array.isArray(o) ? o.map(expand)
  : (o && typeof o === "object")
    ? Object.fromEntries(Object.entries(o).map(([k, v]) => [SHORT_TO_FULL[k] || k, expand(v)]))
    : o;
function extractJSON(t) {
  if (!t || !t.trim()) return null;
  try { return JSON.parse(t.trim()); } catch {}
  const f = t.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (f) { try { return JSON.parse(f[1].trim()); } catch {} }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a !== -1 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return null;
}
const len = (body) => body.length === "extended" ? "extended"
  : (body.length === "xl" || body.xlMode) ? "xl" : "standard";

function readBody(req) {
  return new Promise((res) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => {
      try { res(JSON.parse(d || "{}")); } catch { res({}); }
    });
  });
}
const send = (r, code, obj) => {
  r.writeHead(code, { "Content-Type": "application/json" });
  r.end(JSON.stringify(obj));
};

async function callAnthropic(system, user, maxTokens) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Set ANTHROPIC_API_KEY to use generate/optimize. (/build works without it.)" };
  }
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.MODEL || "claude-opus-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  const j = await r.json();
  if (j.type === "error") return { ok: false, error: j.error?.message || "LLM error" };
  return { ok: true, text: j.content?.[0]?.text || "" };
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    const html = fs.readFileSync(INDEX, "utf8").replace(/%%API_URL%%/g, "");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(html);
  }
  if (req.method === "GET" && url === "/models") {
    return send(res, 200, { default: "claude-opus-4.6", models: [{ alias: "claude-opus-4.6", id: "claude-opus-4-6", provider: "anthropic", label: "Claude Opus 4.6 (local)" }] });
  }
  if (req.method !== "POST") return send(res, 404, { error: "Not found" });

  const body = await readBody(req);

  try {
    if (url === "/build") {
      const buf = await buildResume(body.resumeData, null, {
        template: body.template, design: body.design,
        includeEducation: body.includeEducation !== false, length: body.length,
      });
      res.writeHead(200, {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="Resume.docx"',
      });
      return res.end(buf);
    }

    if (url === "/analyze" || url === "/optimize") {
      const L = len(body);
      const dom = body.domain || "software";
      const maxTok = L === "standard" ? 8192 : 16384;
      let system, user;
      if (url === "/optimize") {
        system = L === "extended" ? prompts.buildOptimizeSystemPromptExtended(dom, body.includeCertifications)
          : L === "xl" ? prompts.buildOptimizeSystemPromptXL(dom, body.includeCertifications)
            : prompts.buildOptimizeSystemPrompt(dom, body.includeCertifications);
        user = prompts.buildOptimizeUserMessage(body.resume, body.jd, body.context);
      } else {
        system = L === "extended" ? prompts.buildSystemPromptExtended(dom, body.includeCertifications)
          : L === "xl" ? prompts.buildSystemPromptXL(dom, body.includeCertifications)
            : prompts.buildSystemPrompt(dom, body.includeCertifications);
        user = prompts.buildUserMessage(body.jd, body.customer, body.context, body.companies, dom);
      }
      const r = await callAnthropic(system, user, maxTok);
      if (!r.ok) return send(res, 502, { error: r.error });
      const resumeData = expand(extractJSON(r.text));
      if (!resumeData) return send(res, 422, { error: "Model returned invalid JSON. Try again." });
      return send(res, 200, {
        resumeData,
        scoring: prompts.scoreResume(resumeData, dom),
        timeline_warnings: prompts.validateTimeline(resumeData, dom),
        lint: lintResume(resumeData, { length: L }),
        model_used: "local",
        mode: url === "/optimize" ? "optimize" : undefined,
      });
    }

    // Deterministic lint only — the LLM review/revise passes need the deployed
    // Lambda (cross-family model routing); locally we return lint so the UI works.
    if (url === "/review") {
      if (!body.resumeData) return send(res, 400, { error: "Missing resumeData" });
      return send(res, 200, {
        reviewer_model: "local-lint-only",
        verdict: { phone_screen: "borderline", reason: "Local server runs lint only — deploy for the full cross-family recruiter review." },
        findings: [],
        lint: lintResume(body.resumeData, { length: len(body) }),
        mode: "review",
      });
    }
    return send(res, 404, { error: "Not found", url });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`ResumeX local → http://localhost:${PORT}`);
  console.log(process.env.ANTHROPIC_API_KEY
    ? "  generate/optimize: ENABLED (ANTHROPIC_API_KEY found)"
    : "  generate/optimize: disabled (no ANTHROPIC_API_KEY) — /build still works");
});
