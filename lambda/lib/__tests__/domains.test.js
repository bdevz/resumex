const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const base = require("../config");
const { resolveDomain, detectDomain } = require("../domains");
const prompts = require("../prompts");
const promptBaseline = require("./fixtures/software-prompts.baseline.json");
const scoringBaseline = require("./fixtures/software-scoring.baseline.json");

describe("resolveDomain — software path is regression-locked", () => {
  it("software resolves the overridable keys deep-equal to base config", () => {
    const c = resolveDomain("software");
    for (const key of [
      "ACTION_VERBS", "WEAK_VERBS", "TECH_TIMELINE", "ANTI_SLOP",
      "PROMPT_VERBS", "IMPLICIT_KEYWORD_RULES", "SKILL_CATEGORIES",
      "IT_SERVICES_FIRMS", "EDUCATION", "TIMELINE",
    ]) {
      assert.deepEqual(c[key], base[key], `${key} must equal base config for software`);
    }
    assert.deepEqual(c.QUALITY_SCORING.rules, base.QUALITY_SCORING.rules);
    assert.equal(c.DOMAIN_CONTEXT, "");
    assert.deepEqual(c.CERTIFICATIONS, []);
  });

  it("undefined domain === software", () => {
    assert.equal(resolveDomain(undefined), resolveDomain("software"));
  });

  it("unknown domain falls back to software", () => {
    assert.equal(resolveDomain("does-not-exist"), resolveDomain("software"));
  });

  it("result is frozen and memoized", () => {
    const c = resolveDomain("software");
    assert.ok(Object.isFrozen(c));
    assert.equal(resolveDomain("software"), c);
  });
});

describe("prompt builders — byte-identical under software", () => {
  const cases = {
    buildSystemPrompt: prompts.buildSystemPrompt(),
    buildSystemPromptXL: prompts.buildSystemPromptXL(),
    buildOptimizeSystemPrompt: prompts.buildOptimizeSystemPrompt(),
    buildOptimizeSystemPromptXL: prompts.buildOptimizeSystemPromptXL(),
    antiSlop_standard: prompts.buildAntiSlopPromptSection("standard"),
    antiSlop_xl: prompts.buildAntiSlopPromptSection("xl"),
    antiSlop_optimize: prompts.buildAntiSlopPromptSection("optimize"),
    antiSlop_optimizeXl: prompts.buildAntiSlopPromptSection("optimize-xl"),
  };
  for (const [name, value] of Object.entries(cases)) {
    it(`${name} matches pre-refactor baseline`, () => {
      assert.equal(value, promptBaseline[name]);
    });
  }

  it("explicit 'software' domain equals default", () => {
    assert.equal(prompts.buildSystemPrompt("software"), promptBaseline.buildSystemPrompt);
  });
});

describe("scoring — identical under software", () => {
  for (const { b, s } of scoringBaseline) {
    it(`scores unchanged: ${b.slice(0, 40)}...`, () => {
      const n = prompts.scoreResume({ experience: [{ company: "X", bullets: [b] }] }, "software");
      assert.equal(n.average, s.average);
    });
  }
});

describe("detectDomain — advisory hint only", () => {
  it("detects Workday signals", () => {
    const r = detectDomain("Workday HCM consultant: EIB, Core Connectors, Workday Studio, BIRT reporting");
    assert.equal(r.domain, "workday");
    assert.ok(r.confidence > 0);
  });

  it("detects Salesforce signals", () => {
    const r = detectDomain("Salesforce developer: Apex, SOQL, Lightning Web Components, Flow Builder, Sales Cloud");
    assert.equal(r.domain, "salesforce");
  });

  it("plain software JD → software (no hint)", () => {
    const r = detectDomain("Senior backend engineer: Go, Kubernetes, Kafka, PostgreSQL, gRPC");
    assert.equal(r.domain, "software");
    assert.equal(r.confidence, 0);
  });
});
