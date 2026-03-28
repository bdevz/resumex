# Anti-Slop Prompt Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a config-driven anti-AI-slop system that injects writing style rules into all four prompt builders from a single `ANTI_SLOP` config block.

**Architecture:** A new `ANTI_SLOP` object in `config.js` holds all banned words, phrases, structural patterns, examples, tone, and metric ratios. A new `buildAntiSlopPromptSection(mode)` function in `prompts.js` reads the config and returns a prompt string. The four existing prompt builders each call this function, replacing their scattered hardcoded anti-slop guidance.

**Tech Stack:** Node.js 18+ (plain JS, no TypeScript), Node built-in test runner (`node --test`)

**Spec:** `docs/superpowers/specs/2026-03-28-anti-slop-prompt-hardening-design.md`

---

### File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `lambda/lib/config.js` | Modify (insert at line 314, replace lines 315-333) | Add `ANTI_SLOP` block, replace `module.exports` to include it |
| `lambda/lib/prompts.js` | Modify | Add `buildAntiSlopPromptSection(mode)`, remove scattered anti-slop from 4 builders, insert call |
| `lambda/lib/__tests__/anti-slop.test.js` | Create | Tests for config structure, prompt builder function, and removal of old guidance |

---

### Task 1: Add `ANTI_SLOP` config block to `config.js`

**Files:**
- Modify: `lambda/lib/config.js` — insert new `ANTI_SLOP` const at line 314 (after `SOFT_SKILL_RULES` closing on line 313), then replace `module.exports` block (lines 315-333) to include `ANTI_SLOP`

- [ ] **Step 1: Write the failing test**

Create `lambda/lib/__tests__/anti-slop.test.js`:

```js
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
    // Collect all ACTION_VERBS lowercased
    const allActionVerbs = Object.values(config.ACTION_VERBS)
      .flat()
      .map((v) => v.toLowerCase());
    const bannedWords = config.ANTI_SLOP.banned_words.map((e) => e.word.toLowerCase());

    // For each action verb, check that no banned word is its root
    // (e.g., "streamlined" should not have "streamline" banned)
    for (const verb of allActionVerbs) {
      for (const banned of bannedWords) {
        // Check: verb starts with banned word (covers "streamlined" → "streamline")
        // and banned word is at least 4 chars (avoid false positives with short roots)
        if (banned.length >= 4 && verb.startsWith(banned)) {
          assert.fail(
            `ACTION_VERB "${verb}" conflicts with banned word "${banned}" — ` +
            `remove the banned word or remove the action verb first`
          );
        }
      }
    }

    // Explicit known pairs that were considered and intentionally allowed:
    // - "transformative" (banned adjective) vs "Transformed" (ACTION_VERB) — OK because
    //   "transformed" does NOT start with "transformative"
    // - "streamline" is NOT in banned_words because "Streamlined" is in ACTION_VERBS
    // - "cultivate" is NOT in banned_words because "Cultivated" is in ACTION_VERBS
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: FAIL — `ANTI_SLOP` is not exported from config.

- [ ] **Step 3: Add `ANTI_SLOP` to `config.js`**

Add the following block before `module.exports` in `lambda/lib/config.js` (after `SOFT_SKILL_RULES`, before line 315):

```js
// --- Anti-AI-slop writing rules (config-driven, injected into all prompts) ---
const ANTI_SLOP = {
  banned_words: [
    // Hard — NEVER use these
    { word: "delve", severity: "hard" },
    { word: "pivotal", severity: "hard" },
    { word: "underscore", severity: "hard" },
    { word: "landscape", severity: "hard" },
    { word: "foster", severity: "hard" },
    { word: "testament", severity: "hard" },
    { word: "leverage", severity: "hard" },
    { word: "spearhead", severity: "hard" },
    { word: "harness", severity: "hard" },
    { word: "elevate", severity: "hard" },
    { word: "bolster", severity: "hard" },
    { word: "utilize", severity: "hard" },
    { word: "tapestry", severity: "hard" },
    { word: "intricate", severity: "hard" },
    { word: "groundbreaking", severity: "hard" },
    { word: "transformative", severity: "hard" },
    { word: "innovative", severity: "hard" },
    { word: "revolutionize", severity: "hard" },
    { word: "synergy", severity: "hard" },
    { word: "paradigm", severity: "hard" },
    // Soft — avoid when possible
    { word: "robust", severity: "soft" },
    { word: "seamless", severity: "soft" },
    { word: "comprehensive", severity: "soft" },
    { word: "cutting-edge", severity: "soft" },
    { word: "world-class", severity: "soft" },
    { word: "best-in-class", severity: "soft" },
    { word: "holistic", severity: "soft" },
  ],

  banned_phrases: [
    { phrase: "not just X, but Y", severity: "hard" },
    { phrase: "plays a vital role", severity: "hard" },
    { phrase: "stands as a testament", severity: "hard" },
    { phrase: "it's important to note", severity: "hard" },
    { phrase: "from X to Y (rhetorical, not metric)", severity: "hard" },
    { phrase: "driving innovation", severity: "hard" },
    { phrase: "ensuring seamless", severity: "hard" },
    { phrase: "state-of-the-art", severity: "hard" },
    { phrase: "in today's fast-paced", severity: "hard" },
    { phrase: "at the forefront of", severity: "hard" },
    { phrase: "end-to-end", severity: "soft" },
    { phrase: "above and beyond", severity: "soft" },
    { phrase: "key stakeholders", severity: "soft" },
  ],

  structural_patterns: [
    {
      name: "adjective_triplet",
      description: "Three adjectives in a row separated by commas",
      example_bad: "Built a scalable, resilient, and performant API gateway",
      example_good: "Built an API gateway that handled 50K concurrent connections without falling over",
      severity: "hard",
    },
    {
      name: "trailing_ing_clause",
      description: "Dangling -ing clause tacked onto the end that adds no specifics",
      example_bad: "Migrated 12 services to Kubernetes, ensuring high availability and compliance",
      example_good: "Migrated 12 services to Kubernetes — two of them had zero-downtime requirements that forced us to run blue-green deploys for 3 weeks",
      severity: "hard",
    },
    {
      name: "em_dash_overuse",
      description: "More than one em dash in a single bullet",
      example_bad: "Designed a caching layer — Redis-based — that reduced latency — improving UX significantly",
      example_good: "Designed a Redis caching layer that cut API response times from 1.2s to 180ms",
      severity: "soft",
    },
    {
      name: "every_bullet_has_metric",
      description: "When every single bullet in a role has a percentage, dollar amount, or numeric comparison — this is the #1 sign of an AI resume",
      example_bad: "Reduced X by 72%... improved Y by 340%... saving $420K... from 1.2s to 180ms...",
      example_good: "4 out of 6 bullets have metrics. The rest describe what was built and why it mattered.",
      severity: "hard",
    },
    {
      name: "metric_stacking",
      description: "Cramming multiple unrelated metrics into one bullet",
      example_bad: "Reduced latency by 40%, increased throughput by 200%, saving $1.2M annually while improving NPS by 15 points",
      example_good: "Reduced API latency by 40% by adding a Redis read-through cache in front of the payments table",
      severity: "hard",
    },
  ],

  examples: [
    {
      bad: "Spearheaded a transformative cloud migration initiative leveraging Kubernetes and Terraform, resulting in a 60% reduction in infrastructure costs",
      good: "Moved 14 services from EC2 to EKS over 4 months — the hardest part was untangling the shared RDS instance that three teams depended on",
      why: "The bad version uses 'spearheaded', 'transformative', 'leveraging', 'initiative' — four AI tells in one sentence. The good version sounds like someone who actually did the work.",
    },
    {
      bad: "Drove innovation by implementing a robust microservices architecture, ensuring seamless scalability and enhanced system reliability",
      good: "Broke a Rails monolith into 6 services so deploys stopped taking down the whole app every Thursday",
      why: "The bad version is all buzzwords. The good version has a specific pain point (Thursday deploys) that no AI would invent.",
    },
    {
      bad: "Leveraged cutting-edge machine learning algorithms to optimize customer engagement metrics, achieving a 45% improvement in retention rates",
      good: "Built a churn prediction model using XGBoost that flagged at-risk accounts 2 weeks before they cancelled — the CS team used it to save about 30% of them",
      why: "Specificity beats superlatives. Name the model, name the team, describe the workflow.",
    },
  ],

  tone: `Write like a tired engineer updating their resume at 11pm, not like a marketing copywriter.
Be specific and plain. If something was hard, say it was hard. If the scope was small, don't inflate it.
A human resume has personality — it mentions the annoying migration, the team that was skeptical, the workaround that became permanent.
Never make every bullet sound triumphant. Real work is messy.`,

  max_metric_ratio: {
    standard:      { max: 4, per: "6-8",   description: "At most 4 of 6-8 bullets per role should have hard metrics" },
    xl:            { max: 5, per: "10-15",  description: "At most 5 of 10-15 bullets per role should have hard metrics" },
    optimize:      { max: 4, per: "6-8",    description: "At most 4 of 6-8 bullets per role should have hard metrics" },
    "optimize-xl": { max: 7, per: "10-15",  description: "At most 5-7 of 10-15 bullets per role should have hard metrics" },
  },
};
```

Then add `ANTI_SLOP` to the `module.exports` object (after `SOFT_SKILL_RULES`):

```js
module.exports = {
  API,
  CONTACT,
  EDUCATION,
  IT_SERVICES_FIRMS,
  TIMELINE,
  FORMAT,
  FORMAT_XL,
  ATS_HEADERS,
  XYZ_PATTERNS,
  ACTION_VERBS,
  WEAK_VERBS,
  QUALITY_SCORING,
  COMPETITOR_MAPS,
  CLOUD_ECOSYSTEMS,
  TECH_TIMELINE,
  SKILL_CATEGORIES,
  SOFT_SKILL_RULES,
  ANTI_SLOP,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lambda/lib/config.js lambda/lib/__tests__/anti-slop.test.js
git commit -m "feat: add ANTI_SLOP config block with banned words, phrases, patterns, and examples"
```

---

### Task 2: Add `buildAntiSlopPromptSection(mode)` to `prompts.js`

**Files:**
- Modify: `lambda/lib/prompts.js` (add new function before `module.exports`, line 656)
- Modify: `lambda/lib/__tests__/anti-slop.test.js` (add tests)

- [ ] **Step 1: Write the failing tests**

First, add the prompts import at the top of the file (after the config import, replacing the NOTE comment):

```js
const prompts = require("../prompts");
```

Then append the following test block to the file:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: FAIL — `buildAntiSlopPromptSection` is not exported.

- [ ] **Step 3: Implement `buildAntiSlopPromptSection(mode)`**

Add the following function to `lambda/lib/prompts.js` before the `module.exports` block (before line 656):

```js
function buildAntiSlopPromptSection(mode) {
  const slop = config.ANTI_SLOP;

  const hardWords = slop.banned_words.filter(w => w.severity === "hard").map(w => w.word);
  const softWords = slop.banned_words.filter(w => w.severity === "soft").map(w => w.word);
  const hardPhrases = slop.banned_phrases.filter(p => p.severity === "hard").map(p => p.phrase);
  const softPhrases = slop.banned_phrases.filter(p => p.severity === "soft").map(p => p.phrase);

  const ratio = slop.max_metric_ratio[mode] || slop.max_metric_ratio.standard;

  let section = `\nWRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:\n`;
  section += slop.tone + "\n";

  section += `\nNEVER use these words — they are the #1 signal of AI-generated writing:\n`;
  section += hardWords.join(", ") + "\n";

  section += `\nAvoid these words when possible:\n`;
  section += softWords.join(", ") + "\n";

  section += `\nNEVER use these phrase patterns:\n`;
  section += hardPhrases.map(p => `- "${p}"`).join("\n") + "\n";

  if (softPhrases.length > 0) {
    section += `\nAvoid these phrases when possible:\n`;
    section += softPhrases.map(p => `- "${p}"`).join("\n") + "\n";
  }

  section += `\nSTRUCTURAL ANTI-PATTERNS TO AVOID:\n`;
  for (const pat of slop.structural_patterns) {
    const verb = pat.severity === "hard" ? "NEVER" : "Avoid";
    section += `\n${verb}: ${pat.description}\n`;
    section += `  BAD: "${pat.example_bad}"\n`;
    section += `  GOOD: "${pat.example_good}"\n`;
  }

  section += `\nMETRIC RATIO: ${ratio.description}.\n`;
  section += `The remaining bullets MUST NOT contain percentages, dollar amounts, or numeric comparisons.\n`;
  section += `Instead, describe WHAT you built, HOW it worked, or WHY it mattered — in plain language.\n`;

  section += `\nEXAMPLES — LEARN THE DIFFERENCE:\n`;
  for (const ex of slop.examples) {
    section += `\n  BAD: "${ex.bad}"\n`;
    section += `  GOOD: "${ex.good}"\n`;
    section += `  WHY: ${ex.why}\n`;
  }

  section += `\nMix sentence structures naturally — do NOT write every bullet in the same pattern:\n`;
  section += `- Some bullets: "Accomplished [X] by doing [Y], resulting in [Z]" (XYZ)\n`;
  section += `- Some bullets: "Faced [challenge], took [action], achieved [result]" (CAR)\n`;
  section += `- Some bullets: Start with the impact/scale, then explain how\n`;
  section += `- Some bullets: Lead with the technology choice, then show the outcome\n`;

  return section;
}
```

Then add `buildAntiSlopPromptSection` to `module.exports`:

```js
module.exports = {
  buildSystemPrompt,
  buildSystemPromptXL,
  buildUserMessage,
  buildOptimizeSystemPrompt,
  buildOptimizeSystemPromptXL,
  buildOptimizeUserMessage,
  scoreResume,
  validateTimeline,
  buildAntiSlopPromptSection,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lambda/lib/prompts.js lambda/lib/__tests__/anti-slop.test.js
git commit -m "feat: add buildAntiSlopPromptSection() that reads ANTI_SLOP config"
```

---

### Task 3: Update `buildSystemPrompt()` — remove scattered anti-slop, insert function call

**Files:**
- Modify: `lambda/lib/prompts.js:7-115` (`buildSystemPrompt` function)
- Modify: `lambda/lib/__tests__/anti-slop.test.js` (add integration test)

- [ ] **Step 1: Write the failing test**

Append to `lambda/lib/__tests__/anti-slop.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: FAIL — the old hardcoded lines still exist.

- [ ] **Step 3: Edit `buildSystemPrompt()`**

In `lambda/lib/prompts.js`, within `buildSystemPrompt()`:

**Remove line 67:**
```
- Avoid excessive adjectives/adverbs (no "strategically", "innovatively", "meticulously")
```

**Remove lines 70-85** (the entire WRITING STYLE section from `WRITING STYLE — SOUND HUMAN` through `A resume that reads like a human wrote it stands out.`):
```
WRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:
Do NOT write every bullet in the same XYZ formula pattern. Mix sentence structures naturally:
- Some bullets: "Accomplished [X] by doing [Y], resulting in [Z]" (XYZ)
- Some bullets: "Faced [challenge], took [action], achieved [result]" (CAR)
- Some bullets: Start with the impact/scale, then explain how
- Some bullets: Lead with the technology choice, then show the outcome
CRITICAL: NOT every bullet needs numbers. This is the #1 sign of an AI-generated resume — when EVERY bullet has a percentage or dollar amount.
- Maximum 4 bullets per role should have hard metrics (%, $, from-X-to-Y comparisons)
- The remaining bullets MUST NOT contain percentages, dollar amounts, or numeric comparisons
- Instead, those bullets should describe WHAT you built, HOW it worked, or WHY it mattered — in plain language

Example of a GOOD non-metric bullet: "Designed a caching layer using Redis to serve frequently accessed legal documents without hitting the database on every request"
Example of a GOOD non-metric bullet: "Built an internal CLI tool that automated sandbox provisioning, replacing a 15-step manual process the team had been doing since launch"
Example of a BAD pattern (every bullet has numbers): "Reduced X by 72%... improved Y by 340%... saving $420K... from 1.2s to 180ms..." — this reads like AI slop.

A resume that reads like a human wrote it stands out.
```

**Insert in its place:**
```
${buildAntiSlopPromptSection("standard")}
```

Note: Keep the `- Use digits instead of spelling out numbers (8 not "eight")` line (line 68) — it stays in BULLET REQUIREMENTS.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lambda/lib/prompts.js lambda/lib/__tests__/anti-slop.test.js
git commit -m "refactor: replace hardcoded anti-slop in buildSystemPrompt with config-driven section"
```

---

### Task 4: Update `buildSystemPromptXL()` — remove scattered anti-slop, insert function call

**Files:**
- Modify: `lambda/lib/prompts.js:117-227` (`buildSystemPromptXL` function)
- Modify: `lambda/lib/__tests__/anti-slop.test.js` (add integration test)

- [ ] **Step 1: Write the failing test**

Append to `lambda/lib/__tests__/anti-slop.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: FAIL — old hardcoded lines still present.

- [ ] **Step 3: Edit `buildSystemPromptXL()`**

In `lambda/lib/prompts.js`, within `buildSystemPromptXL()`:

**Remove line 176:**
```
- Avoid excessive adjectives/adverbs (no "strategically", "innovatively", "meticulously")
```

**Remove lines 180-190** (the entire WRITING STYLE section from `WRITING STYLE — SOUND HUMAN` through `A resume that reads like a human wrote it stands out.`):
```
WRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:
Do NOT write every bullet in the same XYZ formula pattern. Mix sentence structures naturally:
- Some bullets: "Accomplished [X] by doing [Y], resulting in [Z]" (XYZ)
- Some bullets: "Faced [challenge], took [action], achieved [result]" (CAR)
- Some bullets: Start with the impact/scale, then explain how
- Some bullets: Lead with the technology choice, then show the outcome
CRITICAL: NOT every bullet needs numbers. This is the #1 sign of an AI-generated resume.
With 10-15 bullets per role, maximum 5 should have hard metrics (%, $, from-X-to-Y).
The remaining 5-10 bullets MUST NOT contain percentages, dollar amounts, or numeric comparisons.
Instead, describe WHAT you built, HOW it worked, or WHY it mattered — in plain language.
A resume that reads like a human wrote it stands out.
```

**Insert in its place:**
```
${buildAntiSlopPromptSection("xl")}
```

Keep the `- Use digits instead of spelling out numbers` line (line 177).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lambda/lib/prompts.js lambda/lib/__tests__/anti-slop.test.js
git commit -m "refactor: replace hardcoded anti-slop in buildSystemPromptXL with config-driven section"
```

---

### Task 5: Update `buildOptimizeSystemPrompt()` — remove scattered anti-slop, insert function call

**Files:**
- Modify: `lambda/lib/prompts.js:432-535` (`buildOptimizeSystemPrompt` function)
- Modify: `lambda/lib/__tests__/anti-slop.test.js` (add integration test)

- [ ] **Step 1: Write the failing test**

Append to `lambda/lib/__tests__/anti-slop.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: FAIL — old hardcoded lines still present.

- [ ] **Step 3: Edit `buildOptimizeSystemPrompt()`**

In `lambda/lib/prompts.js`, within `buildOptimizeSystemPrompt()`:

**Remove line 508:**
```
- Avoid excessive adjectives/adverbs (no "strategically", "innovatively", "meticulously")
```

**Remove lines 510-517** (the entire WRITING STYLE section from `WRITING STYLE — SOUND HUMAN` through `A resume that reads like a human wrote it stands out.`):
```
WRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:
Do NOT write every bullet in the same XYZ formula pattern. Mix sentence structures naturally:
- Some bullets: "Accomplished [X] by doing [Y], resulting in [Z]" (XYZ)
- Some bullets: "Faced [challenge], took [action], achieved [result]" (CAR)
- Some bullets: Start with the impact/scale, then explain how
- Some bullets: Lead with the technology choice, then show the outcome
- 3-4 bullets per role should have hard metrics. The rest can show scope, scale, business context, or technical decisions without forcing numbers.
A resume that reads like a human wrote it stands out.
```

**Insert in its place:**
```
${buildAntiSlopPromptSection("optimize")}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lambda/lib/prompts.js lambda/lib/__tests__/anti-slop.test.js
git commit -m "refactor: replace hardcoded anti-slop in buildOptimizeSystemPrompt with config-driven section"
```

---

### Task 6: Update `buildOptimizeSystemPromptXL()` — remove scattered anti-slop, insert function call

**Files:**
- Modify: `lambda/lib/prompts.js:537-641` (`buildOptimizeSystemPromptXL` function)
- Modify: `lambda/lib/__tests__/anti-slop.test.js` (add integration test)

- [ ] **Step 1: Write the failing test**

Append to `lambda/lib/__tests__/anti-slop.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: FAIL — old hardcoded lines still present.

- [ ] **Step 3: Edit `buildOptimizeSystemPromptXL()`**

In `lambda/lib/prompts.js`, within `buildOptimizeSystemPromptXL()`:

**Remove line 613:**
```
- Avoid excessive adjectives/adverbs (no "strategically", "innovatively", "meticulously")
```

**Remove lines 615-621** (the entire WRITING STYLE section):
```
WRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:
Do NOT write every bullet in the same formula pattern. Mix sentence structures naturally:
- Some bullets: "Accomplished [X] by doing [Y], resulting in [Z]" (XYZ)
- Some bullets: "Faced [challenge], took [action], achieved [result]" (CAR)
- Some bullets: Start with the impact/scale, then explain how
- Some bullets: Lead with the technology choice, then show the outcome
With 10-15 bullets per role, 5-7 should have hard metrics. The rest can show scope, scale, business context, or technical decisions without forcing numbers.
```

**Insert in its place:**
```
${buildAntiSlopPromptSection("optimize-xl")}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add lambda/lib/prompts.js lambda/lib/__tests__/anti-slop.test.js
git commit -m "refactor: replace hardcoded anti-slop in buildOptimizeSystemPromptXL with config-driven section"
```

---

### Task 7: Final verification — run all tests and sanity-check prompt output

**Files:**
- Read: `lambda/lib/prompts.js` (verify final state)
- Read: `lambda/lib/config.js` (verify final state)

- [ ] **Step 1: Run all tests**

Run: `cd lambda && node --test lib/__tests__/anti-slop.test.js`

Expected: ALL PASS (all tests from Tasks 1-6)

- [ ] **Step 2: Verify no old anti-slop guidance remains**

Run a search for the old hardcoded patterns that should no longer appear in the prompt builders:

```bash
cd lambda && grep -n "strategically.*innovatively.*meticulously" lib/prompts.js && echo "FAIL: old adverb list found" || echo "PASS: old adverb list removed"
cd lambda && grep -n "A resume that reads like a human wrote it stands out" lib/prompts.js && echo "FAIL: old human-resume line found" || echo "PASS: old human-resume line removed"
```

Expected: Both should print PASS.

- [ ] **Step 3: Spot-check prompt output**

Run a quick Node script to print the first 20 lines of each prompt's anti-slop section:

```bash
cd lambda && node -e "
const p = require('./lib/prompts');
for (const fn of ['buildSystemPrompt','buildSystemPromptXL','buildOptimizeSystemPrompt','buildOptimizeSystemPromptXL']) {
  const out = p[fn]();
  const idx = out.indexOf('WRITING STYLE');
  console.log('--- ' + fn + ' ---');
  console.log(out.slice(idx, idx + 300));
  console.log();
}
"
```

Expected: All four should show the same `WRITING STYLE — SOUND HUMAN, NOT AI-GENERATED:` section starting with the tone guidance.

- [ ] **Step 4: Commit (if any fixups needed)**

Only if Steps 1-3 revealed issues that needed fixing. Otherwise, skip.
