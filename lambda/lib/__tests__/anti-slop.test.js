const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const config = require("../config");
const prompts = require("../prompts");

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

describe("buildAntiSlopPromptSection()", () => {
  const { buildAntiSlopPromptSection } = prompts;

  it("is exported from prompts", () => {
    assert.equal(typeof buildAntiSlopPromptSection, "function");
  });

  it("returns a string containing tone guidance", () => {
    const result = buildAntiSlopPromptSection("standard");
    assert.ok(result.includes("tired engineer"), "should contain tone guidance");
  });

  it("returns a string containing hard-banned words", () => {
    const result = buildAntiSlopPromptSection("standard");
    assert.ok(result.includes("delve"), "should list banned word 'delve'");
    assert.ok(result.includes("NEVER"), "hard bans should use NEVER");
  });

  it("returns a string containing soft-banned words", () => {
    const result = buildAntiSlopPromptSection("standard");
    assert.ok(result.includes("robust"), "should list soft-banned word 'robust'");
    assert.ok(result.includes("Avoid"), "soft bans should use Avoid");
  });

  it("returns a string containing banned phrases", () => {
    const result = buildAntiSlopPromptSection("standard");
    assert.ok(result.includes("plays a vital role"));
  });

  it("returns a string containing structural anti-patterns with examples", () => {
    const result = buildAntiSlopPromptSection("standard");
    assert.ok(result.includes("adjective"), "should mention adjective triplet");
    assert.ok(result.includes("BAD:"), "should have BAD example labels");
    assert.ok(result.includes("GOOD:"), "should have GOOD example labels");
  });

  it("returns a string containing good/bad example pairs", () => {
    const result = buildAntiSlopPromptSection("standard");
    assert.ok(result.includes("Spearheaded a transformative"), "should contain bad example");
    assert.ok(result.includes("Moved 14 services"), "should contain good example");
    assert.ok(result.includes("WHY:"), "should explain why");
  });

  it("includes metric ratio for the given mode", () => {
    const standard = buildAntiSlopPromptSection("standard");
    assert.ok(standard.includes("6-8"), "standard mode should reference 6-8 bullets");

    const xl = buildAntiSlopPromptSection("xl");
    assert.ok(xl.includes("10-15"), "xl mode should reference 10-15 bullets");
  });

  it("includes sentence structure variety guidance", () => {
    const result = buildAntiSlopPromptSection("standard");
    assert.ok(result.includes("XYZ"), "should mention XYZ pattern");
    assert.ok(result.includes("CAR"), "should mention CAR pattern");
  });
});

describe("buildSystemPrompt() anti-slop integration", () => {
  const prompt = prompts.buildSystemPrompt();

  it("contains anti-slop section from config", () => {
    assert.ok(prompt.includes("WRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:"));
    assert.ok(prompt.includes("tired engineer"));
    assert.ok(prompt.includes("delve"));
  });

  it("no longer contains old hardcoded adverb guidance", () => {
    assert.ok(
      !prompt.includes('"strategically", "innovatively", "meticulously"'),
      "old hardcoded adverb list should be removed"
    );
    assert.ok(
      !prompt.includes("Avoid excessive adjectives/adverbs"),
      "old 'Avoid excessive' line should be removed"
    );
  });

  it("no longer contains old hardcoded 'A resume that reads like a human' line", () => {
    assert.ok(
      !prompt.includes("A resume that reads like a human wrote it stands out"),
      "old standalone human-resume line should be removed"
    );
  });

  it("still contains digit formatting guidance", () => {
    assert.ok(prompt.includes("digits instead of spelling out numbers"));
  });

  it("still contains CRITICAL RULES", () => {
    assert.ok(prompt.includes("CRITICAL RULES:"));
  });

  it("still contains BULLET ORDERING section", () => {
    assert.ok(prompt.includes("BULLET ORDERING"));
  });
});

describe("buildSystemPromptXL() anti-slop integration", () => {
  const prompt = prompts.buildSystemPromptXL();

  it("contains anti-slop section from config", () => {
    assert.ok(prompt.includes("WRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:"));
    assert.ok(prompt.includes("tired engineer"));
  });

  it("uses XL metric ratio", () => {
    assert.ok(prompt.includes("10-15"));
  });

  it("no longer contains old hardcoded adverb guidance", () => {
    assert.ok(
      !prompt.includes('"strategically", "innovatively", "meticulously"'),
      "old hardcoded adverb list should be removed"
    );
    assert.ok(
      !prompt.includes("Avoid excessive adjectives/adverbs"),
      "old 'Avoid excessive' line should be removed"
    );
  });

  it("no longer contains old standalone human-resume line", () => {
    assert.ok(
      !prompt.includes("A resume that reads like a human wrote it stands out"),
      "old standalone human-resume line should be removed"
    );
  });

  it("still contains CRITICAL RULES", () => {
    assert.ok(prompt.includes("CRITICAL RULES:"));
  });
});

describe("buildOptimizeSystemPrompt() anti-slop integration", () => {
  const prompt = prompts.buildOptimizeSystemPrompt();

  it("contains anti-slop section from config", () => {
    assert.ok(prompt.includes("WRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:"));
    assert.ok(prompt.includes("tired engineer"));
  });

  it("uses optimize metric ratio", () => {
    assert.ok(prompt.includes("6-8"));
  });

  it("no longer contains old hardcoded adverb guidance", () => {
    assert.ok(
      !prompt.includes('"strategically", "innovatively", "meticulously"'),
      "old hardcoded adverb list should be removed"
    );
    assert.ok(
      !prompt.includes("Avoid excessive adjectives/adverbs"),
      "old 'Avoid excessive' line should be removed"
    );
  });

  it("no longer contains old standalone human-resume line", () => {
    assert.ok(
      !prompt.includes("A resume that reads like a human wrote it stands out"),
      "old standalone human-resume line should be removed"
    );
  });

  it("still contains OPTIMIZATION RULES", () => {
    assert.ok(prompt.includes("OPTIMIZATION RULES:"));
  });
});

describe("buildOptimizeSystemPromptXL() anti-slop integration", () => {
  const prompt = prompts.buildOptimizeSystemPromptXL();

  it("contains anti-slop section from config", () => {
    assert.ok(prompt.includes("WRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:"));
    assert.ok(prompt.includes("tired engineer"));
  });

  it("uses optimize-xl metric ratio", () => {
    assert.ok(prompt.includes("10-15"));
  });

  it("no longer contains old hardcoded adverb guidance", () => {
    assert.ok(
      !prompt.includes('"strategically", "innovatively", "meticulously"'),
      "old hardcoded adverb list should be removed"
    );
    assert.ok(
      !prompt.includes("Avoid excessive adjectives/adverbs"),
      "old 'Avoid excessive' line should be removed"
    );
  });

  it("still contains OPTIMIZATION RULES", () => {
    assert.ok(prompt.includes("OPTIMIZATION RULES:"));
  });
});
