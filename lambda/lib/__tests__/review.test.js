const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { lintResume } = require("../review");

// ── Fixture helpers ─────────────────────────────────────────────────────────

function baseResume(overrides = {}) {
  return {
    professional_summary: "I make search fast. Ten years of Elasticsearch across banking and streaming.",
    technical_skills: {
      Languages: ["Java", "Python"],
      "Cloud & DevOps": ["AWS"],
    },
    experience: [
      {
        company: "Capital One",
        title: "Principal Engineer",
        start_date: "Feb 2021",
        end_date: "Present",
        bullets: [
          "Led Elasticsearch architecture for 14 clusters and 300 nodes with Java tooling",
          "Cut p99 latency from 870ms to 190ms by rewriting the merge policy in Python",
          "Built AWS ingestion handling 40 TB/day across bulk indexing paths",
        ],
      },
      {
        company: "LinkedIn",
        title: "Staff Engineer",
        start_date: "Jun 2017",
        end_date: "Jan 2021",
        bullets: [
          "Ran the OpenSearch platform migration for search infrastructure teams",
          "Shipped a shard rebalancing service that halved hot-node incidents",
        ],
      },
    ],
    ...overrides,
  };
}

function findingsFor(resume, rule, opts) {
  return lintResume(resume, opts).filter((f) => f.rule === rule);
}

// ── ai_tell_word ────────────────────────────────────────────────────────────

describe("lint: ai_tell_word", () => {
  it("flags hard ANTI_SLOP words in bullets as major", () => {
    const r = baseResume();
    r.experience[0].bullets[0] = "Spearheaded the Elasticsearch platform for 14 clusters";
    const f = findingsFor(r, "ai_tell_word");
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "major");
    assert.match(f[0].location, /experience\[0\]\.bullets\[0\]/);
  });

  it("flags morphological forms (leveraging → leverage)", () => {
    const r = baseResume();
    r.professional_summary = "Leveraging distributed systems experience across banking.";
    const f = findingsFor(r, "ai_tell_word");
    assert.equal(f.length, 1);
    assert.equal(f[0].location, "professional_summary");
  });

  it("flags extra recruiter flag-words as minor", () => {
    const r = baseResume();
    r.experience[0].bullets[1] = "Honed a results-driven approach to latency tuning";
    const f = findingsFor(r, "ai_tell_word");
    assert.ok(f.length >= 1);
    assert.ok(f.every((x) => x.severity === "minor"));
  });

  it("does not flag clean text", () => {
    assert.equal(findingsFor(baseResume(), "ai_tell_word").length, 0);
  });

  it("does not flag banned-word forms that are sanctioned action verbs", () => {
    const r = baseResume();
    // "Transformed" is in ACTION_VERBS even though "transformative" is banned
    r.experience[0].bullets[0] = "Transformed the ingest pipeline to cut costs by a third";
    assert.equal(findingsFor(r, "ai_tell_word").length, 0);
  });
});

// ── ai_tell_phrase ──────────────────────────────────────────────────────────

describe("lint: ai_tell_phrase", () => {
  it("flags literal hard banned phrases", () => {
    const r = baseResume();
    r.professional_summary = "Engineer with a proven track record in search.";
    const f = findingsFor(r, "ai_tell_phrase");
    assert.ok(f.length >= 1);
    assert.equal(f[0].severity, "major");
  });

  it("ignores template phrases with placeholders", () => {
    const r = baseResume();
    r.professional_summary = "Migrated the stack not just once but twice.";
    // "not just X, but Y" is a template, not a literal string — must not crash or flag
    assert.equal(findingsFor(r, "ai_tell_phrase").length, 0);
  });
});

// ── em_dash_density ─────────────────────────────────────────────────────────

describe("lint: em_dash_density", () => {
  it("flags three or more em-dashes in a standard-length resume", () => {
    const r = baseResume();
    r.experience[0].bullets = [
      "Led the platform — 14 clusters — across two regions",
      "Cut latency — from 870ms to 190ms — at peak load",
      "Built ingestion for 40 TB/day",
    ];
    const f = findingsFor(r, "em_dash_density", { length: "standard" });
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "major");
  });

  it("does not flag one or two em-dashes", () => {
    const r = baseResume();
    r.experience[0].bullets[0] = "Led the platform — 14 clusters, 300 nodes";
    assert.equal(findingsFor(r, "em_dash_density", { length: "standard" }).length, 0);
  });
});

// ── bullet_symmetry ─────────────────────────────────────────────────────────

describe("lint: bullet_symmetry", () => {
  it("flags a job whose bullets are near-uniform length", () => {
    const r = baseResume();
    r.experience[0].bullets = [
      "Led the search platform migration for the core banking team",
      "Ran the vector search rollout for the core banking team",
      "Kept the ingest pipeline healthy for the core banking team",
      "Made the shard strategy simpler for the core banking team",
    ];
    const f = findingsFor(r, "bullet_symmetry");
    assert.ok(f.length >= 1);
    assert.equal(f[0].severity, "minor");
  });

  it("flags a job where most bullets open with the same word", () => {
    const r = baseResume();
    r.experience[0].bullets = [
      "Led the search platform migration across nine teams and two data centers",
      "Led the vector rollout",
      "Led ingest work spanning multiple regions with very different profiles",
      "Cut p99 latency in half",
    ];
    const f = findingsFor(r, "bullet_symmetry");
    assert.ok(f.some((x) => /open/i.test(x.message)));
  });

  it("ignores jobs with fewer than four bullets", () => {
    const r = baseResume(); // first job has 3 bullets
    assert.equal(findingsFor(r, "bullet_symmetry").length, 0);
  });
});

// ── naked_metric / implausible_metric ───────────────────────────────────────

describe("lint: metrics", () => {
  it("flags a percentage claim with no nearby context", () => {
    const r = baseResume();
    r.experience[0].bullets[0] = "Improved query performance by 45% for the search stack";
    const f = findingsFor(r, "naked_metric");
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "minor");
  });

  it("does not flag a metric with a baseline", () => {
    const r = baseResume();
    r.experience[0].bullets[0] = "Improved throughput 45%, from 12k to 17k requests per second";
    assert.equal(findingsFor(r, "naked_metric").length, 0);
  });

  it("flags improvements above 200% as implausible", () => {
    const r = baseResume();
    r.experience[0].bullets[0] = "Improved indexing performance by 400% during the migration";
    const f = findingsFor(r, "implausible_metric");
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "major");
  });

  it("does not flag large plain counts", () => {
    const r = baseResume();
    r.experience[0].bullets[0] = "Operated 300 nodes ingesting 40 TB/day across 14 clusters";
    assert.equal(findingsFor(r, "implausible_metric").length, 0);
  });
});

// ── tense_mismatch ──────────────────────────────────────────────────────────

describe("lint: tense_mismatch", () => {
  it("flags a job mixing past and present tense openers", () => {
    const r = baseResume();
    r.experience[0].bullets = [
      "Lead the search platform for core banking",
      "Own the vector store roadmap",
      "Led the migration off OpenSearch",
      "Built the ingest pipeline",
    ];
    const f = findingsFor(r, "tense_mismatch");
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "minor");
  });

  it("does not flag consistent past tense", () => {
    assert.equal(findingsFor(baseResume(), "tense_mismatch").length, 0);
  });
});

// ── date_overlap ────────────────────────────────────────────────────────────

describe("lint: date_overlap", () => {
  it("flags overlapping experience ranges", () => {
    const r = baseResume();
    r.experience[1].end_date = "Jun 2021"; // overlaps Feb 2021 start of job 0 by 4 months
    const f = findingsFor(r, "date_overlap");
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "major");
  });

  it("allows a one-month transition overlap", () => {
    const r = baseResume();
    r.experience[1].end_date = "Feb 2021";
    assert.equal(findingsFor(r, "date_overlap").length, 0);
  });

  it("flags a job whose start is after its end", () => {
    const r = baseResume();
    r.experience[1].start_date = "Mar 2021";
    r.experience[1].end_date = "Jan 2019";
    const f = findingsFor(r, "date_overlap");
    assert.ok(f.length >= 1);
  });
});

// ── duplicate_bullet ────────────────────────────────────────────────────────

describe("lint: duplicate_bullet", () => {
  it("flags near-duplicate bullets across jobs", () => {
    const r = baseResume();
    r.experience[0].bullets[0] = "Led the Elasticsearch cluster migration for the payments platform team";
    r.experience[1].bullets[0] = "Led the Elasticsearch cluster migration for the payments platform group";
    const f = findingsFor(r, "duplicate_bullet");
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "major");
  });

  it("does not flag distinct bullets", () => {
    assert.equal(findingsFor(baseResume(), "duplicate_bullet").length, 0);
  });
});

// ── unevidenced_skill ───────────────────────────────────────────────────────

describe("lint: unevidenced_skill", () => {
  it("flags when most listed skills never appear in the resume body", () => {
    const r = baseResume();
    r.technical_skills = {
      Languages: ["Go", "Rust", "Scala", "Kotlin", "Haskell"],
      Tools: ["Kubernetes", "Terraform"],
    };
    const f = findingsFor(r, "unevidenced_skill");
    assert.equal(f.length, 1);
    assert.equal(f[0].severity, "minor");
  });

  it("does not flag when skills are evidenced in bullets", () => {
    assert.equal(findingsFor(baseResume(), "unevidenced_skill").length, 0);
  });
});

// ── output contract ─────────────────────────────────────────────────────────

describe("lint: output contract", () => {
  it("returns [] for a clean resume and never throws on sparse data", () => {
    assert.deepEqual(lintResume(baseResume()), []);
    assert.deepEqual(lintResume({}), []);
    assert.deepEqual(lintResume({ experience: [{}] }), []);
    assert.deepEqual(lintResume(null), []);
  });

  it("every finding carries severity, rule, location, quote, message", () => {
    const r = baseResume();
    r.experience[0].bullets[0] = "Spearheaded a pivotal, seamless overhaul improving results by 400%";
    for (const f of lintResume(r)) {
      assert.ok(["reject_risk", "major", "minor"].includes(f.severity), f.rule);
      assert.ok(f.rule && f.location && typeof f.quote === "string" && f.message, JSON.stringify(f));
    }
  });
});

// ── Integration: real generated resume (Claude Opus 5, 2026-08-15 live test) ─

describe("lint: live fixture", () => {
  const fixture = require("./fixtures/live-resume-opus5.json");

  it("catches the em-dash overuse in a real generated resume", () => {
    const f = lintResume(fixture, { length: "extended" });
    assert.ok(f.some((x) => x.rule === "em_dash_density" && x.severity === "major"));
  });

  it("catches robotic bullet symmetry in a real generated resume", () => {
    const f = lintResume(fixture, { length: "extended" });
    assert.ok(f.some((x) => x.rule === "bullet_symmetry"));
  });

  it("does not produce false-positive date overlaps on a valid timeline", () => {
    const f = lintResume(fixture, { length: "extended" });
    assert.equal(f.filter((x) => x.rule === "date_overlap").length, 0);
  });
});
