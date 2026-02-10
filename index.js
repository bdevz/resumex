// ============================================================================
// index.js — AWS Lambda handler for Resume Generator
//
// Single function handling all routes via Lambda Function URL:
//   POST /analyze  — JD → LLM → resume JSON + quality scores
//   POST /build    — resume JSON → DOCX binary download
//   GET  /models   — available model list
//
// Environment variables (set in Lambda console):
//   OPENROUTER_API_KEY  — Your OpenRouter API key
//   SHARED_PASSPHRASE   — Passphrase shared with team
// ============================================================================

const { buildSystemPrompt, buildUserMessage, scoreResume, validateTimeline } = require("./lib/prompts");
const { buildResume } = require("./lib/docx-builder");
const config = require("./lib/config");

// ── Helpers ──

function response(statusCode, body, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Passphrase",
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
      "Access-Control-Allow-Headers": "Content-Type, X-Passphrase",
    },
    isBase64Encoded: true,
    body: buffer.toString("base64"),
  };
}

function checkAuth(headers) {
  const passphrase = headers["x-passphrase"] || headers["X-Passphrase"];
  return passphrase && passphrase === process.env.SHARED_PASSPHRASE;
}

function resolveModel(modelInput) {
  if (!modelInput) return config.API.default_model;
  if (config.API.models[modelInput]) return config.API.models[modelInput];
  return modelInput;
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

// ── Route: POST /analyze ──

async function handleAnalyze(body) {
  const { jd, customer, context, model: modelInput } = body;

  if (!jd || jd.trim().length < 50) {
    return response(400, { error: "Job description too short (need at least 50 characters)" });
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(jd, customer, context);
  const model = resolveModel(modelInput);

  // Call OpenRouter
  const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "X-Title": "Resume Generator",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!orResponse.ok) {
    const errText = await orResponse.text();
    console.error(`OpenRouter error (${orResponse.status}):`, errText);
    return response(orResponse.status, {
      error: "LLM API error",
      status: orResponse.status,
      details: errText,
    });
  }

  const data = await orResponse.json();
  const responseText = data.choices?.[0]?.message?.content || "";

  // Parse JSON
  const cleaned = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  let resumeData;
  try {
    resumeData = JSON.parse(cleaned);
  } catch (e) {
    return response(422, {
      error: "LLM returned invalid JSON. Try again or use claude-sonnet.",
      raw_preview: cleaned.substring(0, 300),
    });
  }

  const scoring = scoreResume(resumeData);
  const timeline_warnings = validateTimeline(resumeData);

  return response(200, {
    resumeData,
    scoring,
    timeline_warnings,
    model_used: data.model || model,
    usage: data.usage || null,
  });
}

// ── Route: POST /build ──

async function handleBuild(body) {
  const { resumeData } = body;

  if (!resumeData || !resumeData.experience) {
    return response(400, { error: "Missing resumeData with experience array" });
  }

  const buffer = await buildResume(resumeData, null);
  return binaryResponse(buffer, "Resume.docx");
}

// ── Route: GET /models ──

function handleModels() {
  return response(200, {
    default: "claude-sonnet",
    models: Object.entries(config.API.models).map(([alias, id]) => ({
      alias,
      id,
      provider: id.split("/")[0],
    })),
  });
}

// ── Main handler ──

exports.handler = async (event) => {
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
    if (path === "/analyze" && method === "POST") {
      return await handleAnalyze(body);
    }

    if (path === "/build" && method === "POST") {
      return await handleBuild(body);
    }

    return response(404, { error: "Not found", path });
  } catch (err) {
    console.error("Lambda error:", err);
    return response(500, { error: "Server error", message: err.message });
  }
};
