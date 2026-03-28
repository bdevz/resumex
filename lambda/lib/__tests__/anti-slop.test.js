const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const config = require("../config");
// NOTE: In Task 2, add this line below config require:
// const prompts = require("../prompts");

describe("ANTI_SLOP config", () => {
  it("is exported from config", () => {
    assert.ok(config.ANTI_SLOP, "ANTI_SLOP should be exported");
  });

  it("has banned_words array with severity fields", () => {
    assert.ok(Array.isArray(config.ANTI_SLOP.banned_words));
    assert.ok(config.ANTI_SLOP.banned_words.length > 0);
    for (const entry of config.ANTI_SLOP.banned_words) {
      assert.ok(entry.word, "each entry must have a word");
      assert.ok(
        entry.severity === "hard" || entry.severity === "soft",
        `severity must be "hard" or "soft", got "${entry.severity}"`
      );
    }
  });

  it("has banned_phrases array with severity fields", () => {
    assert.ok(Array.isArray(config.ANTI_SLOP.banned_phrases));
    assert.ok(config.ANTI_SLOP.banned_phrases.length > 0);
    for (const entry of config.ANTI_SLOP.banned_phrases) {
      assert.ok(entry.phrase, "each entry must have a phrase");
      assert.ok(entry.severity === "hard" || entry.severity === "soft");
    }
  });

  it("has structural_patterns array with required fields", () => {
    assert.ok(Array.isArray(config.ANTI_SLOP.structural_patterns));
    for (const pat of config.ANTI_SLOP.structural_patterns) {
      assert.ok(pat.name);
      assert.ok(pat.description);
      assert.ok(pat.example_bad);
      assert.ok(pat.example_good);
      assert.ok(pat.severity === "hard" || pat.severity === "soft");
    }
  });

  it("has examples array with bad/good/why fields", () => {
    assert.ok(Array.isArray(config.ANTI_SLOP.examples));
    assert.ok(config.ANTI_SLOP.examples.length >= 3);
    for (const ex of config.ANTI_SLOP.examples) {
      assert.ok(ex.bad);
      assert.ok(ex.good);
      assert.ok(ex.why);
    }
  });

  it("has tone string", () => {
    assert.equal(typeof config.ANTI_SLOP.tone, "string");
    assert.ok(config.ANTI_SLOP.tone.length > 0);
  });

  it("has max_metric_ratio for all four modes", () => {
    const ratio = config.ANTI_SLOP.max_metric_ratio;
    for (const mode of ["standard", "xl", "optimize", "optimize-xl"]) {
      assert.ok(ratio[mode], `missing ratio for mode "${mode}"`);
      assert.equal(typeof ratio[mode].max, "number");
      assert.equal(typeof ratio[mode].per, "string");
      assert.equal(typeof ratio[mode].description, "string");
    }
  });

  it("does not ban words that exist in ACTION_VERBS", () => {
    const allActionVerbs = Object.values(config.ACTION_VERBS)
      .flat()
      .map((v) => v.toLowerCase());
    const bannedWords = config.ANTI_SLOP.banned_words.map((e) => e.word.toLowerCase());

    for (const verb of allActionVerbs) {
      for (const banned of bannedWords) {
        if (banned.length >= 4 && verb.startsWith(banned)) {
          assert.fail(
            `ACTION_VERB "${verb}" conflicts with banned word "${banned}" — ` +
            `remove the banned word or remove the action verb first`
          );
        }
      }
    }

    assert.ok(
      !bannedWords.includes("streamline"),
      "streamline must not be banned — Streamlined is in ACTION_VERBS"
    );
    assert.ok(
      !bannedWords.includes("cultivate"),
      "cultivate must not be banned — Cultivated is in ACTION_VERBS"
    );
  });
});
