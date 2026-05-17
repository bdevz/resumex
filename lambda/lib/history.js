// history.js — pure helpers for the per-user resume history feature.
//
// Records are stored as one JSON object per generated resume in the existing
// S3 bucket under  history/{userSlug}/{createdAt}-{id}.json
// (S3 read/write lives in index.js; this module is pure + unit-tested).

// Slugify a free-text user name into a safe, stable S3 prefix segment.
function userSlug(name) {
  const slug = String(name == null ? "" : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

function historyKey(slug, createdAt, id) {
  return `history/${slug}/${createdAt}-${id}.json`;
}

// First non-empty line of the JD, used as a human-readable "what kind of
// resume" label. Capped so the stored record stays small.
function jdTitleFromJD(jd) {
  const line = String(jd || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return (line || "").slice(0, 120);
}

// Build the full history record from a completed job. Pure: no S3, no clock —
// the caller passes `id` and `createdAt`.
function buildHistoryRecord({ id, userName, createdAt, body = {}, resultBody = {} }) {
  const resumeData = resultBody.resumeData || {};
  const score =
    resultBody.scoring && typeof resultBody.scoring.average === "number"
      ? resultBody.scoring.average
      : null;
  return {
    id,
    userName: userName || "Unknown",
    createdAt,
    mode: resultBody.mode || "generate",
    domain: body.domain || "software",
    model: body.model || null,
    targetCompany: body.customer || null,
    jdTitle: jdTitleFromJD(body.jd),
    candidateName: resumeData.name || "",
    score,
    // Full scoring + timeline warnings are kept so the resume can be
    // re-rendered later exactly as it first appeared.
    scoring: resultBody.scoring || null,
    timelineWarnings: resultBody.timeline_warnings || [],
    resumeData,
  };
}

// List/admin views only need metadata — drop the heavy blobs.
function summarize(record) {
  const { resumeData, scoring, timelineWarnings, ...rest } = record;
  return rest;
}

module.exports = { userSlug, historyKey, jdTitleFromJD, buildHistoryRecord, summarize };
