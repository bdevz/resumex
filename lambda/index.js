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

const { buildSystemPrompt, buildSystemPromptXL, buildUserMessage, buildOptimizeSystemPrompt, buildOptimizeSystemPromptXL, buildOptimizeUserMessage, scoreResume, validateTimeline } = require("./lib/prompts");
const { buildResume } = require("./lib/docx-builder");
const config = require("./lib/config");
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const crypto = require("crypto");

const s3 = new S3Client({ region: "us-east-1" });
const lambda = new LambdaClient({ region: "us-east-1" });
const JOB_BUCKET = "resumex-526810258535";

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
  const { jd, customer, context, model: modelInput, xlMode } = body;

  if (!jd || jd.trim().length < 50) {
    return response(400, { error: "Job description too short (need at least 50 characters)" });
  }

  const systemPrompt = xlMode ? buildSystemPromptXL() : buildSystemPrompt();
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
      max_tokens: xlMode ? 8192 : 4096,
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

// ── Route: POST /optimize ──

async function handleOptimize(body) {
  const { resume, jd, context, model: modelInput, xlMode } = body;

  if (!resume || resume.trim().length < 100) {
    return response(400, { error: "Resume too short (need at least 100 characters)" });
  }

  if (!jd || jd.trim().length < 50) {
    return response(400, { error: "Job description too short (need at least 50 characters)" });
  }

  const systemPrompt = xlMode ? buildOptimizeSystemPromptXL() : buildOptimizeSystemPrompt();
  const userMessage = buildOptimizeUserMessage(resume, jd, context);
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
      max_tokens: xlMode ? 8192 : 4096,
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
    mode: "optimize",
  });
}

// ── Route: POST /build ──

async function handleBuild(body) {
  const { resumeData, template, includeEducation, xlMode } = body;

  if (!resumeData || !resumeData.experience) {
    return response(400, { error: "Missing resumeData with experience array" });
  }

  const buffer = await buildResume(resumeData, null, {
    template: template || "classic",
    includeEducation: includeEducation !== false,
    xlMode: !!xlMode,
  });
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
          "Access-Control-Allow-Headers": "Content-Type, X-Passphrase",
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
          "Access-Control-Allow-Headers": "Content-Type, X-Passphrase",
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
    let systemPrompt, userMessage, model, mode;

    if (path.includes("/optimize") && method === "POST") {
      const { resume, jd, context, model: modelInput } = body;
      if (!resume || resume.trim().length < 100) return streamError(400, "Resume too short");
      if (!jd || jd.trim().length < 50) return streamError(400, "Job description too short");
      systemPrompt = buildOptimizeSystemPrompt();
      userMessage = buildOptimizeUserMessage(resume, jd, context);
      model = resolveModel(modelInput);
      mode = "optimize";
    } else if (path.includes("/analyze") && method === "POST") {
      const { jd, customer, context, model: modelInput } = body;
      if (!jd || jd.trim().length < 50) return streamError(400, "Job description too short");
      systemPrompt = buildSystemPrompt();
      userMessage = buildUserMessage(jd, customer, context);
      model = resolveModel(modelInput);
      mode = "generate";
    } else {
      return streamError(404, "Not found");
    }

    // Set up SSE response
    responseStream = awslambda.HttpResponseStream.from(responseStream, {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-Passphrase",
      },
    });

    // Send initial status
    responseStream.write(`data: ${JSON.stringify({ type: "status", message: "Connecting to AI..." })}\n\n`);

    // Call OpenRouter with streaming
    let orResponse;
    try {
      orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "X-Title": "Resume Generator",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      });
    } catch (err) {
      responseStream.write(`data: ${JSON.stringify({ type: "error", error: "Failed to connect to AI service" })}\n\n`);
      responseStream.end();
      return;
    }

    if (!orResponse.ok) {
      const errText = await orResponse.text();
      console.error(`OpenRouter stream error (${orResponse.status}):`, errText);
      responseStream.write(`data: ${JSON.stringify({ type: "error", error: "LLM API error", status: orResponse.status })}\n\n`);
      responseStream.end();
      return;
    }

    responseStream.write(`data: ${JSON.stringify({ type: "status", message: "AI is writing..." })}\n\n`);

    // Read streaming response from OpenRouter and forward chunks
    const reader = orResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines from OpenRouter
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || "";
          if (delta) {
            fullText += delta;
            responseStream.write(`data: ${JSON.stringify({ type: "content", delta })}\n\n`);
          }
        } catch {}
      }
    }

    // Parse complete response and send final structured data
    const cleaned = fullText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    try {
      const resumeData = JSON.parse(cleaned);
      const scoring = scoreResume(resumeData);
      const timeline_warnings = validateTimeline(resumeData);

      responseStream.write(`data: ${JSON.stringify({
        type: "complete",
        resumeData,
        scoring,
        timeline_warnings,
        model_used: model,
        mode: mode === "optimize" ? "optimize" : undefined,
      })}\n\n`);
    } catch (e) {
      responseStream.write(`data: ${JSON.stringify({ type: "error", error: "LLM returned invalid JSON. Try again." })}\n\n`);
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
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404 || err.name === "AccessDenied") return null;
    throw err;
  }
}

async function startAsyncJob(body, route) {
  const jobId = crypto.randomUUID();
  const asyncPayload = { ...body, __jobId: jobId, __route: route };

  await lambda.send(new InvokeCommand({
    FunctionName: "resume-generator",
    InvocationType: "Event",
    Payload: JSON.stringify({
      __asyncJob: true,
      body: JSON.stringify(asyncPayload),
      headers: { "x-passphrase": process.env.SHARED_PASSPHRASE },
    }),
  }));

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
      } else {
        result = await handleAnalyze(body);
      }
      const resultBody = JSON.parse(result.body);
      await writeJobResult(jobId, { status: "complete", ...resultBody });
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

    // Start async jobs for analyze/optimize (avoids 30s API GW timeout)
    if (path === "/analyze" && method === "POST") {
      return await startAsyncJob(body, "analyze");
    }

    if (path === "/optimize" && method === "POST") {
      return await startAsyncJob(body, "optimize");
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