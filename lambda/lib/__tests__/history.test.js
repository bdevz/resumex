const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  userSlug,
  historyKey,
  buildHistoryRecord,
  summarize,
} = require("../history");

describe("userSlug", () => {
  it("lowercases and slugifies a normal name", () => {
    assert.equal(userSlug("Jane Doe"), "jane-doe");
  });

  it("collapses runs of non-alphanumerics into a single dash", () => {
    assert.equal(userSlug("  Mary  O'Brien-Smith "), "mary-o-brien-smith");
  });

  it("strips leading/trailing dashes", () => {
    assert.equal(userSlug("!!!Bob!!!"), "bob");
  });

  it("falls back to 'unknown' for empty/garbage input", () => {
    assert.equal(userSlug(""), "unknown");
    assert.equal(userSlug("   "), "unknown");
    assert.equal(userSlug("***"), "unknown");
    assert.equal(userSlug(null), "unknown");
    assert.equal(userSlug(undefined), "unknown");
  });

  it("keeps digits", () => {
    assert.equal(userSlug("User 42"), "user-42");
  });
});

describe("historyKey", () => {
  it("builds a sortable per-user key", () => {
    assert.equal(
      historyKey("jane-doe", "2026-05-16T12:34:56.000Z", "abc-123"),
      "history/jane-doe/2026-05-16T12:34:56.000Z-abc-123.json"
    );
  });
});

describe("buildHistoryRecord", () => {
  const base = {
    id: "job-1",
    userName: "Jane Doe",
    createdAt: "2026-05-16T12:34:56.000Z",
    body: {
      jd: "Senior Backend Engineer\nWe are looking for...",
      customer: "Netflix",
      domain: "software",
      model: "claude-opus-4.6",
    },
    resultBody: {
      mode: "generate",
      resumeData: { name: "John Candidate", experience: [{}] },
      scoring: { average: 6.2 },
    },
  };

  it("extracts the expected fields", () => {
    const r = buildHistoryRecord(base);
    assert.equal(r.id, "job-1");
    assert.equal(r.userName, "Jane Doe");
    assert.equal(r.createdAt, "2026-05-16T12:34:56.000Z");
    assert.equal(r.mode, "generate");
    assert.equal(r.domain, "software");
    assert.equal(r.model, "claude-opus-4.6");
    assert.equal(r.targetCompany, "Netflix");
    assert.equal(r.jdTitle, "Senior Backend Engineer");
    assert.equal(r.candidateName, "John Candidate");
    assert.equal(r.score, 6.2);
    assert.deepEqual(r.resumeData, { name: "John Candidate", experience: [{}] });
  });

  it("retains full scoring + timeline warnings for re-rendering", () => {
    const r = buildHistoryRecord({
      ...base,
      resultBody: {
        ...base.resultBody,
        scoring: { average: 6.2, bulletCount: 3, results: [{ x: 1 }] },
        timeline_warnings: ["check dates"],
      },
    });
    assert.deepEqual(r.scoring, { average: 6.2, bulletCount: 3, results: [{ x: 1 }] });
    assert.deepEqual(r.timelineWarnings, ["check dates"]);
  });

  it("defaults missing optional fields safely", () => {
    const r = buildHistoryRecord({
      id: "job-2",
      userName: "X",
      createdAt: "2026-01-01T00:00:00.000Z",
      body: { jd: "   \n\n  Data Analyst  \nrest" },
      resultBody: { resumeData: {} },
    });
    assert.equal(r.mode, "generate");
    assert.equal(r.domain, "software");
    assert.equal(r.targetCompany, null);
    assert.equal(r.jdTitle, "Data Analyst");
    assert.equal(r.candidateName, "");
    assert.equal(r.score, null);
  });

  it("truncates a very long JD title to 120 chars", () => {
    const longTitle = "A".repeat(200);
    const r = buildHistoryRecord({
      ...base,
      body: { ...base.body, jd: longTitle },
    });
    assert.equal(r.jdTitle.length, 120);
  });
});

describe("summarize", () => {
  it("omits resumeData but keeps metadata", () => {
    const rec = buildHistoryRecord({
      id: "job-1",
      userName: "Jane Doe",
      createdAt: "2026-05-16T12:34:56.000Z",
      body: { jd: "Engineer", customer: "Acme", domain: "software", model: "m" },
      resultBody: { mode: "optimize", resumeData: { name: "C", experience: [] }, scoring: { average: 5 } },
    });
    const s = summarize(rec);
    assert.equal(s.resumeData, undefined);
    assert.equal(s.scoring, undefined);
    assert.equal(s.timelineWarnings, undefined);
    assert.equal(s.id, "job-1");
    assert.equal(s.candidateName, "C");
    assert.equal(s.mode, "optimize");
    assert.equal(s.score, 5);
  });
});
