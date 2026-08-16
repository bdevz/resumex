// ============================================================================
// index.js — AWS Lambda handler for Resume Generator
//
// Single function handling all routes via Lambda Function URL:
//   POST /analyze  — JD → LLM → resume JSON + quality scores
//   POST /build    — resume JSON → DOCX binary download
//   GET  /models   — available model list
//
// Environment variables (set in Lambda console):
//   ANTHROPIC_API_KEY   — Your Anthropic API key
//   SHARED_PASSPHRASE   — Passphrase shared with team
// ============================================================================

const { buildSystemPrompt, buildSystemPromptXL, buildSystemPromptExtended, buildUserMessage, buildOptimizeSystemPrompt, buildOptimizeSystemPromptXL, buildOptimizeSystemPromptExtended, buildOptimizeUserMessage, buildReviewerPrompt, buildReviewerUserMessage, buildRevisePrompt, buildReviseUserMessage, scoreResume, validateTimeline } = require("./lib/prompts");
const { lintResume } = require("./lib/review");
const { buildResume } = require("./lib/docx-builder");
const config = require("./lib/config");
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { userSlug, historyKey, buildHistoryRecord, summarize } = require("./lib/history");
const crypto = require("crypto");

const s3 = new S3Client({ region: "us-east-1" });
const lambda = new LambdaClient({ region: "us-east-1" });
const JOB_BUCKET = "resumex-526810258535";

// ── JSON extraction (handles markdown fences, preamble text, etc.) ──

function extractJSON(text) {
  if (!text || !text.trim()) return null;

  // 1. Try direct parse first (model returned clean JSON)
  try { return JSON.parse(text.trim()); } catch {}

  // 2. Strip markdown code fences (```json, ```JSON, ```, etc.)
  const fenceMatch = text.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // 3. Find first { and last } — extract the JSON object
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.substring(firstBrace, lastBrace + 1);
    try { return JSON.parse(candidate); } catch {}
  }

  return null;
}

// ── Short-key expansion (maps compact LLM output keys → full keys) ──

const SHORT_TO_FULL = {
  jd: "parsed_jd",
  rt: "role_title",
  ind: "industry",
  cp: "cloud_platform",
  kt: "key_technologies",
  rs: "required_skills",
  ps: "professional_summary",
  ts: "technical_skills",
  lang: "Languages",
  fw: "Frameworks & Libraries",
  cloud: "Cloud & DevOps",
  db: "Databases",
  tools: "Tools & Practices",
  exp: "experience",
  co: "company",
  ti: "title",
  loc: "location",
  sd: "start_date",
  ed: "end_date",
  b: "bullets",
  ct: "contact",
  n: "name",
  em: "email",
  ph: "phone",
  li: "linkedin",
  gh: "github",
  edu: "education",
  sc: "school",
  dg: "degree",
  cert: "certifications",
};

function expandKeys(obj) {
  if (Array.isArray(obj)) return obj.map(expandKeys);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[SHORT_TO_FULL[k] || k] = expandKeys(v);
    }
    return out;
  }
  return obj;
}

// ── Helpers ──

function response(statusCode, body, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Passphrase, X-User-Name, X-Admin-Passphrase",
    ...extraHeaders,
  };
  return {
    statusCode,
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

function binaryResponse(buffer, filename) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Passphrase, X-User-Name, X-Admin-Passphrase",
    },
    isBase64Encoded: true,
    body: buffer.toString("base64"),
  };
}

// Case-insensitive header lookup (API Gateway preserves case, Function URL lowercases)
function getHeader(headers, name) {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return undefined;
}

function checkAuth(headers) {
  const passphrase = headers["x-passphrase"] || headers["X-Passphrase"];
  return passphrase && passphrase === process.env.SHARED_PASSPHRASE;
}

function checkAdmin(headers) {
  const pass = getHeader(headers, "x-admin-passphrase");
  return !!pass && !!process.env.ADMIN_PASSPHRASE && pass === process.env.ADMIN_PASSPHRASE;
}

// Model registry: dropdown alias → { id, provider, label }
const DEFAULT_MODEL_ALIAS = "claude-opus-4.6";
const MODELS = {
  // ── Anthropic ──
  // alwaysThinks: thinking is on by default and shares the max_tokens budget,
  // so those models get extra output headroom in callLLM/stream.
  "claude-fable-5":    { id: "claude-fable-5",              provider: "anthropic", label: "Claude Fable 5",   alwaysThinks: true },
  "claude-opus-5":     { id: "claude-opus-5",               provider: "anthropic", label: "Claude Opus 5",    alwaysThinks: true },
  "claude-opus-4.8":   { id: "claude-opus-4-8",            provider: "anthropic", label: "Claude Opus 4.8" },
  "claude-opus-4.7":   { id: "claude-opus-4-7",            provider: "anthropic", label: "Claude Opus 4.7" },
  "claude-opus-4.6":   { id: "claude-opus-4-6",            provider: "anthropic", label: "Claude Opus 4.6" },
  "claude-opus-4.5":   { id: "claude-opus-4-5-20251101",   provider: "anthropic", label: "Claude Opus 4.5" },
  "claude-sonnet-5":   { id: "claude-sonnet-5",            provider: "anthropic", label: "Claude Sonnet 5",  alwaysThinks: true },
  "claude-sonnet-4.6": { id: "claude-sonnet-4-6",          provider: "anthropic", label: "Claude Sonnet 4.6" },
  "claude-sonnet-4.5": { id: "claude-sonnet-4-5-20250929", provider: "anthropic", label: "Claude Sonnet 4.5" },
  "claude-haiku-4.5":  { id: "claude-haiku-4-5-20251001",  provider: "anthropic", label: "Claude Haiku 4.5" },
  // ── OpenAI ──
  "gpt-5.6-sol":   { id: "gpt-5.6-sol",   provider: "openai", label: "GPT-5.6 Sol" },
  "gpt-5.6-terra": { id: "gpt-5.6-terra", provider: "openai", label: "GPT-5.6 Terra" },
  "gpt-5.6-luna":  { id: "gpt-5.6-luna",  provider: "openai", label: "GPT-5.6 Luna" },
  "gpt-5.5":    { id: "gpt-5.5",    provider: "openai", label: "GPT-5.5" },
  "gpt-5":      { id: "gpt-5",      provider: "openai", label: "GPT-5" },
  "gpt-5-mini": { id: "gpt-5-mini", provider: "openai", label: "GPT-5 mini" },
  "gpt-4.1":    { id: "gpt-4.1",    provider: "openai", label: "GPT-4.1" },
  "gpt-4o":     { id: "gpt-4o",     provider: "openai", label: "GPT-4o" },
};

function modelInfo(modelInput) {
  if (modelInput && MODELS[modelInput]) return { alias: modelInput, ...MODELS[modelInput] };
  // Unknown but provider-shaped → pass through to that provider
  if (modelInput && modelInput.startsWith("claude-")) return { alias: modelInput, id: modelInput, provider: "anthropic", label: modelInput };
  if (modelInput && (modelInput.startsWith("gpt-") || /^o\d/.test(modelInput))) return { alias: modelInput, id: modelInput, provider: "openai", label: modelInput };
  console.warn(`Model "${modelInput}" not recognized, using default: ${DEFAULT_MODEL_ALIAS}`);
  return { alias: DEFAULT_MODEL_ALIAS, ...MODELS[DEFAULT_MODEL_ALIAS] };
}

// Unified LLM call. Returns { ok:true, text, modelUsed, usage }
// or { ok:false, status, error, details, isTimeout }.
async function callLLM(modelInput, systemPrompt, userMessage, maxTokens) {
  const m = modelInfo(modelInput);
  let apiResponse;
  try {
    if (m.provider === "openai") {
      apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(240_000),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: m.id,
          max_completion_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });
    } else {
      apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(240_000),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: m.id,
          // alwaysThinks models spend part of max_tokens on thinking
          max_tokens: m.alwaysThinks ? maxTokens + 8192 : maxTokens,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    }
  } catch (fetchErr) {
    const isTimeout = fetchErr.name === "TimeoutError" || fetchErr.name === "AbortError";
    console.error(`${m.provider} fetch failed:`, fetchErr.message);
    return {
      ok: false,
      status: 504,
      isTimeout,
      error: isTimeout
        ? "The model took too long to respond. Try a faster model (e.g. Claude Haiku or GPT-5.6 Luna) or disable XL mode."
        : `Network error calling LLM API: ${fetchErr.message}`,
    };
  }

  if (!apiResponse.ok) {
    const errText = await apiResponse.text();
    console.error(`${m.provider} error (${apiResponse.status}):`, errText);
    let friendly = "LLM API error";
    try {
      const j = JSON.parse(errText);
      friendly = j.error?.message || j.error?.type || friendly;
    } catch {}
    return { ok: false, status: apiResponse.status, error: friendly, details: errText };
  }

  const data = await apiResponse.json();

  if (m.provider === "openai") {
    if (data.error) {
      console.error("OpenAI API error:", JSON.stringify(data.error));
      return { ok: false, status: 422, error: data.error?.message || "Model returned an error." };
    }
    const choice = data.choices?.[0];
    const text = choice?.message?.content || "";
    if (!text) return { ok: false, status: 422, error: "Model returned empty response. Try again." };
    return { ok: true, text, modelUsed: data.model || m.id, usage: data.usage || null,
             truncated: choice?.finish_reason === "length" };
  }

  if (data.type === "error") {
    console.error("Anthropic API error:", JSON.stringify(data.error));
    return { ok: false, status: 422, error: data.error?.message || "Model returned an error." };
  }
  if (data.stop_reason === "refusal") {
    console.error("Anthropic refusal:", JSON.stringify(data.stop_details || {}));
    return { ok: false, status: 422, error: "The model declined this request. Try again or use a different model." };
  }
  // Thinking-enabled models return a thinking block before the text block
  const text = data.content?.find((b) => b.type === "text")?.text || "";
  if (!text) return { ok: false, status: 422, error: "Model returned empty response. Try again." };
  return { ok: true, text, modelUsed: data.model || m.id, usage: data.usage || null,
           truncated: data.stop_reason === "max_tokens" };
}

function getPath(event) {
  // Lambda Function URL puts path in rawPath
  // API Gateway v2 puts it in requestContext.http.path
  const raw = event.rawPath || event.requestContext?.http?.path || event.path || "/";
  // Strip leading /api/ or /prod/ etc. to normalize
  return raw.replace(/^\/(api|prod|dev)/, "").replace(/^\/+/, "/");
}

function getMethod(event) {
  return (
    event.requestContext?.http?.method ||
    event.httpMethod ||
    "GET"
  ).toUpperCase();
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getHeaders(event) {
  // Lambda Function URL lowercases all headers
  return event.headers || {};
}

// Resolve the length tier. `length` ("standard"|"xl"|"extended") wins; the
// legacy `xlMode` boolean is kept as an alias for "xl".
function resolveLength(body) {
  if (body.length === "extended") return "extended";
  if (body.length === "xl" || body.xlMode) return "xl";
  if (body.length === "standard") return "standard";
  return body.xlMode ? "xl" : "standard";
}

function maxTokensFor(len) {
  return len === "standard" ? 8192 : 16384;
}

// ── Route: POST /analyze ──

async function handleAnalyze(body) {
  const { jd, customer, context, model: modelInput, companies, domain, includeCertifications } = body;

  if (!jd || jd.trim().length < 50) {
    return response(400, { error: "Job description too short (need at least 50 characters)" });
  }

  const dom = domain || "software";
  const len = resolveLength(body);
  const systemPrompt = len === "extended"
    ? buildSystemPromptExtended(dom, includeCertifications)
    : len === "xl"
      ? buildSystemPromptXL(dom, includeCertifications)
      : buildSystemPrompt(dom, includeCertifications);
  const userMessage = buildUserMessage(jd, customer, context, companies, dom);

  const r = await callLLM(modelInput, systemPrompt, userMessage, maxTokensFor(len));
  if (!r.ok) {
    return response(r.status || 502, { error: r.error, status: r.status, details: r.details });
  }

  // Parse JSON and expand short keys to full keys
  const resumeData = expandKeys(extractJSON(r.text));
  if (!resumeData) {
    return response(422, {
      error: r.truncated
        ? "Model response was cut off (too long)."
        : "Model returned invalid JSON. Try again.",
      raw_preview: r.text.substring(0, 500),
    });
  }

  const scoring = scoreResume(resumeData, dom);
  const timeline_warnings = validateTimeline(resumeData, dom);

  return response(200, {
    resumeData,
    scoring,
    timeline_warnings,
    lint: lintResume(resumeData, { length: len }),
    model_used: r.modelUsed,
    usage: r.usage,
  });
}

// ── Route: POST /optimize ──

async function handleOptimize(body) {
  const { resume, jd, context, model: modelInput, domain, includeCertifications } = body;

  if (!resume || resume.trim().length < 100) {
    return response(400, { error: "Resume too short (need at least 100 characters)" });
  }

  if (!jd || jd.trim().length < 50) {
    return response(400, { error: "Job description too short (need at least 50 characters)" });
  }

  const dom = domain || "software";
  const len = resolveLength(body);
  const systemPrompt = len === "extended"
    ? buildOptimizeSystemPromptExtended(dom, includeCertifications)
    : len === "xl"
      ? buildOptimizeSystemPromptXL(dom, includeCertifications)
      : buildOptimizeSystemPrompt(dom, includeCertifications);
  const userMessage = buildOptimizeUserMessage(resume, jd, context);

  const r = await callLLM(modelInput, systemPrompt, userMessage, maxTokensFor(len));
  if (!r.ok) {
    return response(r.status || 502, { error: r.error, status: r.status, details: r.details });
  }

  // Parse JSON and expand short keys to full keys
  const resumeData = expandKeys(extractJSON(r.text));
  if (!resumeData) {
    return response(422, {
      error: r.truncated
        ? "Model response was cut off (too long)."
        : "Model returned invalid JSON. Try again.",
      raw_preview: r.text.substring(0, 500),
    });
  }

  const scoring = scoreResume(resumeData, dom);
  const timeline_warnings = validateTimeline(resumeData, dom);

  return response(200, {
    resumeData,
    scoring,
    timeline_warnings,
    lint: lintResume(resumeData, { length: len }),
    model_used: r.modelUsed,
    usage: r.usage,
    mode: "optimize",
  });
}

// ── Route: POST /review (recruiter adversarial review) ──
// Spec: docs/superpowers/specs/2026-08-15-recruiter-adversarial-review-design.md

// Cross-family reviewer: a model family is blind to its own writing tics.
// Deterministic fallback if the preferred reviewer's provider has no API key.
function pickReviewer(generatorModelInput) {
  const gen = modelInfo(generatorModelInput || "");
  const preferred = gen.provider === "openai" ? "claude-sonnet-5" : "gpt-5.6-terra";
  const fallback = gen.provider === "openai" ? "gpt-5.6-terra" : "claude-sonnet-5";
  const hasKey = (alias) =>
    MODELS[alias].provider === "openai" ? !!process.env.OPENAI_API_KEY : !!process.env.ANTHROPIC_API_KEY;
  return hasKey(preferred) ? preferred : fallback;
}

async function handleReview(body) {
  const { resumeData, jd, model: generatorModel } = body;
  if (!resumeData || !resumeData.experience) {
    return response(400, { error: "Missing resumeData with experience array" });
  }
  if (!jd || jd.trim().length < 50) {
    return response(400, { error: "Job description too short (need at least 50 characters)" });
  }

  const len = resolveLength(body);
  const lint = lintResume(resumeData, { length: len });
  const reviewerAlias = pickReviewer(generatorModel);

  const r = await callLLM(
    reviewerAlias,
    buildReviewerPrompt(lint),
    buildReviewerUserMessage(jd, resumeData),
    4096
  );
  if (!r.ok) {
    return response(r.status || 502, { error: r.error, status: r.status, details: r.details });
  }

  const review = extractJSON(r.text);
  if (!review || !Array.isArray(review.findings)) {
    return response(422, {
      error: "Reviewer returned invalid JSON. Try again.",
      raw_preview: r.text.substring(0, 500),
    });
  }

  return response(200, {
    reviewer_model: r.modelUsed || reviewerAlias,
    verdict: review.verdict || null,
    findings: review.findings.slice(0, 15),
    lint,
    usage: r.usage,
    mode: "review",
  });
}

// ── Route: POST /revise (apply accepted review findings) ──

async function handleRevise(body) {
  const { resumeData, jd, findings, model: modelInput, domain, includeCertifications } = body;
  if (!resumeData || !resumeData.experience) {
    return response(400, { error: "Missing resumeData with experience array" });
  }
  if (!jd || jd.trim().length < 50) {
    return response(400, { error: "Job description too short (need at least 50 characters)" });
  }
  if (!Array.isArray(findings) || findings.length === 0) {
    return response(400, { error: "No findings selected to fix" });
  }

  const dom = domain || "software";
  const len = resolveLength(body);

  const r = await callLLM(
    modelInput,
    buildRevisePrompt(dom, len, includeCertifications),
    buildReviseUserMessage(jd, resumeData, findings),
    maxTokensFor(len)
  );
  if (!r.ok) {
    return response(r.status || 502, { error: r.error, status: r.status, details: r.details });
  }

  const revised = expandKeys(extractJSON(r.text));
  if (!revised || !revised.experience) {
    return response(422, {
      error: r.truncated
        ? "Model response was cut off (too long)."
        : "Model returned invalid revised JSON. Try again.",
      raw_preview: r.text.substring(0, 500),
    });
  }

  return response(200, {
    resumeData: revised,
    scoring: scoreResume(revised, dom),
    timeline_warnings: validateTimeline(revised, dom),
    lint: lintResume(revised, { length: len }),
    model_used: r.modelUsed,
    usage: r.usage,
    mode: "revise",
  });
}

// ── Route: POST /build ──

async function handleBuild(body) {
  const { resumeData, template, design, includeEducation, xlMode, length } = body;

  if (!resumeData || !resumeData.experience) {
    return response(400, { error: "Missing resumeData with experience array" });
  }

  const buffer = await buildResume(resumeData, null, {
    template: template || "classic",
    design: design || undefined,
    includeEducation: includeEducation !== false,
    xlMode: !!xlMode,
    length: length || (xlMode ? "xl" : undefined),
  });
  return binaryResponse(buffer, "Resume.docx");
}

// ── Route: GET /models ──

function handleModels() {
  return response(200, {
    default: DEFAULT_MODEL_ALIAS,
    models: Object.entries(MODELS).map(([alias, m]) => ({
      alias,
      id: m.id,
      provider: m.provider,
      label: m.label,
    })),
  });
}

// ── Streaming handler (for Lambda Function URL with RESPONSE_STREAM) ──

if (typeof awslambda !== "undefined") {
  exports.streamHandler = awslambda.streamifyResponse(async (event, responseStream, _context) => {
    const method = getMethod(event);
    const path = getPath(event);
    const headers = getHeaders(event);

    // CORS preflight
    if (method === "OPTIONS") {
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Passphrase, X-User-Name, X-Admin-Passphrase",
        },
      });
      responseStream.end();
      return;
    }

    // Helper to send SSE error and close
    function streamError(statusCode, error) {
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, X-Passphrase, X-User-Name, X-Admin-Passphrase",
        },
      });
      responseStream.write(JSON.stringify({ error }));
      responseStream.end();
    }

    // Auth
    if (!checkAuth(headers)) {
      return streamError(401, "Invalid passphrase");
    }

    const body = parseBody(event);

    // Determine which mode (analyze or optimize)
    let systemPrompt, userMessage, modelAlias, mode;

    let dom = "software";
    const len = resolveLength(body);
    if (path.includes("/optimize") && method === "POST") {
      const { resume, jd, context, model: modelInput, domain, includeCertifications } = body;
      if (!resume || resume.trim().length < 100) return streamError(400, "Resume too short");
      if (!jd || jd.trim().length < 50) return streamError(400, "Job description too short");
      dom = domain || "software";
      systemPrompt = len === "extended"
        ? buildOptimizeSystemPromptExtended(dom, includeCertifications)
        : len === "xl"
          ? buildOptimizeSystemPromptXL(dom, includeCertifications)
          : buildOptimizeSystemPrompt(dom, includeCertifications);
      userMessage = buildOptimizeUserMessage(resume, jd, context);
      modelAlias = modelInput;
      mode = "optimize";
    } else if (path.includes("/analyze") && method === "POST") {
      const { jd, customer, context, model: modelInput, companies, domain, includeCertifications } = body;
      if (!jd || jd.trim().length < 50) return streamError(400, "Job description too short");
      dom = domain || "software";
      systemPrompt = len === "extended"
        ? buildSystemPromptExtended(dom, includeCertifications)
        : len === "xl"
          ? buildSystemPromptXL(dom, includeCertifications)
          : buildSystemPrompt(dom, includeCertifications);
      userMessage = buildUserMessage(jd, customer, context, companies, dom);
      modelAlias = modelInput;
      mode = "generate";
    } else {
      return streamError(404, "Not found");
    }
    const streamMaxTokens = maxTokensFor(len);

    // Set up SSE response
    responseStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-Passphrase, X-User-Name, X-Admin-Passphrase",
      },
    });

    // Send initial status
    responseStream.write(`data: ${JSON.stringify({ type: "status", message: "Connecting to AI..." })}\n\n`);

    // Call the selected provider with streaming (4 min timeout)
    const m = modelInfo(modelAlias);
    let apiResponse;
    try {
      if (m.provider === "openai") {
        apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          signal: AbortSignal.timeout(240_000),
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: m.id,
            max_completion_tokens: streamMaxTokens,
            response_format: { type: "json_object" },
            stream: true,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          }),
        });
      } else {
        apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          signal: AbortSignal.timeout(240_000),
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: m.id,
            // alwaysThinks models spend part of max_tokens on thinking
            max_tokens: m.alwaysThinks ? streamMaxTokens + 8192 : streamMaxTokens,
            stream: true,
            system: systemPrompt,
            messages: [
              { role: "user", content: userMessage },
            ],
          }),
        });
      }
    } catch (err) {
      const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
      const msg = isTimeout
        ? "The model took too long to respond. Try a faster model."
        : "Failed to connect to AI service";
      responseStream.write(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`);
      responseStream.end();
      return;
    }

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error(`Anthropic stream error (${apiResponse.status}):`, errText);
      responseStream.write(`data: ${JSON.stringify({ type: "error", error: "LLM API error", status: apiResponse.status })}\n\n`);
      responseStream.end();
      return;
    }

    responseStream.write(`data: ${JSON.stringify({ type: "status", message: "AI is writing..." })}\n\n`);

    // Read Anthropic SSE stream and forward content deltas
    const reader = apiResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines from Anthropic
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          let delta = null;
          if (m.provider === "openai") {
            delta = parsed.choices?.[0]?.delta?.content || null;
          } else if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            delta = parsed.delta.text;
          }
          if (delta) {
            fullText += delta;
            responseStream.write(`data: ${JSON.stringify({ type: "content", delta })}\n\n`);
          }
        } catch {}
      }
    }

    // Parse complete response and expand short keys to full keys
    const resumeData = expandKeys(extractJSON(fullText));

    if (resumeData) {
      const scoring = scoreResume(resumeData, dom);
      const timeline_warnings = validateTimeline(resumeData, dom);

      responseStream.write(`data: ${JSON.stringify({
        type: "complete",
        resumeData,
        scoring,
        timeline_warnings,
        lint: lintResume(resumeData, { length: len }),
        model_used: m.id,
        mode: mode === "optimize" ? "optimize" : undefined,
      })}\n\n`);
    } else {
      responseStream.write(`data: ${JSON.stringify({ type: "error", error: "LLM returned invalid JSON. Try again or use a different model." })}\n\n`);
    }

    responseStream.write("data: [DONE]\n\n");
    responseStream.end();
  });
}

// ── Async job helpers ──

async function writeJobResult(jobId, result) {
  await s3.send(new PutObjectCommand({
    Bucket: JOB_BUCKET,
    Key: `jobs/${jobId}.json`,
    Body: JSON.stringify(result),
    ContentType: "application/json",
  }));
}

async function readJobResult(jobId) {
  try {
    const obj = await s3.send(new GetObjectCommand({
      Bucket: JOB_BUCKET,
      Key: `jobs/${jobId}.json`,
    }));
    const text = await obj.Body.transformToString();
    return JSON.parse(text);
  } catch (err) {
    // Any S3 error means result isn't ready yet — return null so polling continues
    return null;
  }
}

// ── Resume history helpers (per-user, stored in the same bucket) ──

async function writeHistory(record) {
  const key = historyKey(userSlug(record.userName), record.createdAt, record.id);
  await s3.send(new PutObjectCommand({
    Bucket: JOB_BUCKET,
    Key: key,
    Body: JSON.stringify(record),
    ContentType: "application/json",
  }));
}

// List every full record under a prefix (e.g. "history/jane-doe/" or "history/").
async function listHistoryRecords(prefix) {
  const records = [];
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: JOB_BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
    }));
    const keys = (page.Contents || []).map((o) => o.Key).filter((k) => k && k.endsWith(".json"));
    const objs = await Promise.all(keys.map(async (Key) => {
      try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: JOB_BUCKET, Key }));
        return JSON.parse(await obj.Body.transformToString());
      } catch {
        return null; // skip unreadable/corrupt entries rather than fail the whole list
      }
    }));
    for (const r of objs) if (r) records.push(r);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return records;
}

async function startAsyncJob(body, route) {
  const jobId = crypto.randomUUID();
  const asyncPayload = { ...body, __jobId: jobId, __route: route };

  try {
    await lambda.send(new InvokeCommand({
      FunctionName: "resume-generator",
      InvocationType: "Event",
      Payload: JSON.stringify({
        __asyncJob: true,
        body: JSON.stringify(asyncPayload),
        headers: { "x-passphrase": process.env.SHARED_PASSPHRASE },
      }),
    }));
  } catch (err) {
    console.error("Failed to start async job:", err);
    return response(500, { error: "Failed to start job. Try again." });
  }

  return response(202, { jobId, status: "processing" });
}

// ── Main handler (non-streaming, for API Gateway) ──

exports.handler = async (event) => {
  // ── Async job execution (invoked by Lambda async invoke) ──
  if (event.__asyncJob) {
    const body = JSON.parse(event.body);
    const { __jobId: jobId, __route: route } = body;
    try {
      let result;
      if (route === "optimize") {
        result = await handleOptimize(body);
      } else if (route === "review") {
        result = await handleReview(body);
      } else if (route === "revise") {
        result = await handleRevise(body);
      } else {
        result = await handleAnalyze(body);
      }
      const resultBody = JSON.parse(result.body);

      // Check if the handler returned a non-200 status (LLM API error, invalid JSON, etc.)
      if (result.statusCode >= 400) {
        await writeJobResult(jobId, {
          status: "error",
          error: resultBody.error || `Request failed (${result.statusCode})`,
          details: resultBody.details || resultBody.raw_preview || undefined,
        });
      } else {
        // Success — write result without spreading (avoids status field collision)
        await writeJobResult(jobId, {
          status: "complete",
          resumeData: resultBody.resumeData,
          scoring: resultBody.scoring,
          timeline_warnings: resultBody.timeline_warnings,
          lint: resultBody.lint,
          // review-route fields (undefined on other routes, dropped by JSON)
          reviewer_model: resultBody.reviewer_model,
          verdict: resultBody.verdict,
          findings: resultBody.findings,
          model_used: resultBody.model_used,
          usage: resultBody.usage,
          mode: resultBody.mode,
        });

        // Save to per-user history. Best-effort: a failure here must never
        // affect the generated resume the user is waiting on.
        // Reviews produce no resume — nothing to save; revised resumes save
        // as new entries through this same path.
        if (route === "review") return response(200, { ok: true });
        try {
          await writeHistory(buildHistoryRecord({
            id: jobId,
            userName: body.__userName,
            createdAt: new Date().toISOString(),
            body,
            resultBody: { ...resultBody, mode: resultBody.mode || (route === "optimize" ? "optimize" : "generate") },
          }));
        } catch (histErr) {
          console.error("History write failed (non-fatal):", histErr);
        }
      }
    } catch (err) {
      console.error("Async job error:", err);
      await writeJobResult(jobId, { status: "error", error: err.message });
    }
    return response(200, { ok: true });
  }

  const method = getMethod(event);
  const path = getPath(event);
  const headers = getHeaders(event);

  // CORS preflight
  if (method === "OPTIONS") {
    return response(200, "");
  }

  // Models endpoint — no auth needed
  if (path === "/models" && method === "GET") {
    return handleModels();
  }

  // Health check
  if (path === "/" && method === "GET") {
    return response(200, { status: "ok", service: "resume-generator" });
  }

  // All other routes need auth
  if (!checkAuth(headers)) {
    return response(401, { error: "Invalid passphrase" });
  }

  const body = parseBody(event);

  try {
    // Poll for async job result
    if (path === "/status" && method === "POST") {
      const { jobId } = body;
      if (!jobId) return response(400, { error: "Missing jobId" });
      const result = await readJobResult(jobId);
      if (!result) return response(200, { status: "processing" });
      return response(200, result);
    }

    // Carry the user's name through the async job so it can be saved to history
    const userName = getHeader(headers, "x-user-name") || "Unknown";

    // Start async jobs for analyze/optimize (avoids 30s API GW timeout)
    if (path === "/analyze" && method === "POST") {
      return await startAsyncJob({ ...body, __userName: userName }, "analyze");
    }

    if (path === "/optimize" && method === "POST") {
      return await startAsyncJob({ ...body, __userName: userName }, "optimize");
    }

    if (path === "/review" && method === "POST") {
      return await startAsyncJob({ ...body, __userName: userName }, "review");
    }

    if (path === "/revise" && method === "POST") {
      return await startAsyncJob({ ...body, __userName: userName }, "revise");
    }

    if (path === "/build" && method === "POST") {
      return await handleBuild(body);
    }

    // ── Resume history ──

    // A user's own history (summaries only, newest first)
    if (path === "/history/list" && method === "POST") {
      const records = await listHistoryRecords(`history/${userSlug(userName)}/`);
      return response(200, { items: records.map(summarize) });
    }

    // A single full record (for re-view + re-download via /build)
    if (path === "/history/get" && method === "POST") {
      const { id, userName: who } = body;
      if (!id) return response(400, { error: "Missing id" });
      const slug = userSlug(who || userName);
      const records = await listHistoryRecords(`history/${slug}/`);
      const rec = records.find((r) => r.id === id);
      if (!rec) return response(404, { error: "Not found" });
      return response(200, { record: rec });
    }

    // Admin: everyone's history, grouped by user (separate admin passphrase)
    if (path === "/admin/list" && method === "POST") {
      if (!checkAdmin(headers)) {
        return response(401, { error: "Invalid admin passphrase" });
      }
      const records = await listHistoryRecords("history/");
      const usersByName = {};
      for (const r of records) {
        const name = r.userName || "Unknown";
        if (!usersByName[name]) usersByName[name] = { userName: name, count: 0, items: [] };
        usersByName[name].count += 1;
        usersByName[name].items.push(summarize(r));
      }
      const users = Object.values(usersByName).sort((a, b) => b.count - a.count);
      return response(200, { users, total: records.length });
    }

    return response(404, { error: "Not found", path });
  } catch (err) {
    console.error("Lambda error:", err);
    return response(500, { error: "Server error", message: err.message });
  }
};