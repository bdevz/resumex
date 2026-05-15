// ============================================================================
// domains.js — Domain-pack resolution for functional-tech ecosystems
//
// The base config IS the "software" pack. A domain pack is a sparse overlay
// applied on top of the base config via explicit per-key merge rules (NOT a
// generic deep-merge — that hides regressions). resolveDomain("software") and
// resolveDomain(undefined) return an object deep-equal to the base config, so
// the software path is regression-locked by construction.
//
// Pack shape (all keys optional; absent ⇒ inherit base):
//   action_verbs_add        { category: [verbs] }   per-category UNION
//   weak_verbs_add          [verbs]                  added to WEAK_VERBS
//   weak_verbs_remove       [verbs]                  removed from WEAK_VERBS
//   scoring_rules_add       [rule]                   appended to QUALITY_SCORING.rules
//   scoring_rules_replace   { label: rule }          swap a rule by its label
//   tech_timeline           { tech: {earliest} }     spread onto TECH_TIMELINE
//   skill_categories        [str]                    replaces SKILL_CATEGORIES
//   prompt_verbs            { strong_long,... }       replaces PROMPT_VERBS fields
//   implicit_keyword_rules  str                      replaces IMPLICIT_KEYWORD_RULES
//   domain_context          str                      extra prompt block ("" = none)
//   anti_slop               { banned_words_add, banned_phrases_add, examples_add,
//                             authenticity_bonuses_add, tone, summary_rules }
//   it_services_firms       [str]                    replaces IT_SERVICES_FIRMS
//   education               {}                       replaces EDUCATION
//   timeline                {}                       replaces TIMELINE
//   certifications          [str]                    ecosystem certs (opt-in flag)
// ============================================================================

const base = require("./config");

const DEFAULT_DOMAIN = "software";
const _cache = new Map();

function uniq(arr) {
  return [...new Set(arr)];
}

function resolveDomain(domain) {
  const key = domain && base.DOMAIN_PACKS[domain] ? domain : DEFAULT_DOMAIN;
  if (_cache.has(key)) return _cache.get(key);

  const pack = base.DOMAIN_PACKS[key] || {};

  // --- ACTION_VERBS: per-category union (software verbs never disappear) ---
  const ACTION_VERBS = {};
  for (const [cat, verbs] of Object.entries(base.ACTION_VERBS)) {
    ACTION_VERBS[cat] = verbs.slice();
  }
  if (pack.action_verbs_add) {
    for (const [cat, verbs] of Object.entries(pack.action_verbs_add)) {
      ACTION_VERBS[cat] = uniq([...(ACTION_VERBS[cat] || []), ...verbs]);
    }
  }

  // --- WEAK_VERBS: base − remove ∪ add ---
  let WEAK_VERBS = base.WEAK_VERBS.slice();
  if (pack.weak_verbs_remove) {
    const rm = new Set(pack.weak_verbs_remove.map((v) => v.toLowerCase()));
    WEAK_VERBS = WEAK_VERBS.filter((v) => !rm.has(v.toLowerCase()));
  }
  if (pack.weak_verbs_add) WEAK_VERBS = uniq([...WEAK_VERBS, ...pack.weak_verbs_add]);

  // --- QUALITY_SCORING.rules: base + add, then replace-by-label ---
  let rules = base.QUALITY_SCORING.rules.slice();
  if (pack.scoring_rules_replace) {
    rules = rules.map((r) =>
      pack.scoring_rules_replace[r.label]
        ? { ...r, ...pack.scoring_rules_replace[r.label] }
        : r
    );
  }
  if (pack.scoring_rules_add) rules = [...rules, ...pack.scoring_rules_add];
  const QUALITY_SCORING = { ...base.QUALITY_SCORING, rules };

  // --- TECH_TIMELINE: base ← pack spread ---
  const TECH_TIMELINE = { ...base.TECH_TIMELINE, ...(pack.tech_timeline || {}) };

  // --- ANTI_SLOP: base + additive arrays, optional tone/summary override ---
  const a = base.ANTI_SLOP;
  const pa = pack.anti_slop || {};
  const ANTI_SLOP = {
    ...a,
    banned_words: [...a.banned_words, ...(pa.banned_words_add || [])],
    banned_phrases: [...a.banned_phrases, ...(pa.banned_phrases_add || [])],
    examples: [...a.examples, ...(pa.examples_add || [])],
    tone: pa.tone || a.tone,
    summary_rules: pa.summary_rules || a.summary_rules,
  };

  // --- Pack-replaces-if-present (else base) ---
  const PROMPT_VERBS = { ...base.PROMPT_VERBS, ...(pack.prompt_verbs || {}) };
  const IMPLICIT_KEYWORD_RULES =
    pack.implicit_keyword_rules || base.IMPLICIT_KEYWORD_RULES;
  const SKILL_CATEGORIES = pack.skill_categories || base.SKILL_CATEGORIES;
  const IT_SERVICES_FIRMS = pack.it_services_firms || base.IT_SERVICES_FIRMS;
  const EDUCATION = pack.education || base.EDUCATION;
  const TIMELINE = pack.timeline || base.TIMELINE;

  // Authenticity bonuses: base + additive (never replace ⇒ no software regression)
  if (pa.authenticity_bonuses_add) {
    QUALITY_SCORING.authenticity_bonuses = [
      ...base.QUALITY_SCORING.authenticity_bonuses,
      ...pa.authenticity_bonuses_add,
    ];
  }

  const resolved = Object.freeze({
    ...base,
    domain: key,
    ACTION_VERBS,
    WEAK_VERBS,
    QUALITY_SCORING,
    TECH_TIMELINE,
    ANTI_SLOP,
    PROMPT_VERBS,
    IMPLICIT_KEYWORD_RULES,
    SKILL_CATEGORIES,
    IT_SERVICES_FIRMS,
    EDUCATION,
    TIMELINE,
    DOMAIN_CONTEXT: pack.domain_context || "",
    CERTIFICATIONS: pack.certifications || [],
  });

  _cache.set(key, resolved);
  return resolved;
}

// --- detectDomain: advisory hint only. The user dropdown is authoritative. ---
const DETECT_SIGNALS = {
  workday: [
    "workday", "eib", "core connector", "workday studio", "birt",
    "calculated field", "business process framework", "hcm", "peci",
    "picof", "report writer", "workday pro", "prism analytics",
    "workday extend", "tenant",
  ],
  salesforce: [
    "salesforce", "apex", "soql", "sosl", "lightning web component",
    "lwc", "visualforce", "flow builder", "sales cloud", "service cloud",
    "experience cloud", "cpq", "sfdx", "trailhead", "validation rule",
    "permission set", "apex trigger",
  ],
};

function detectDomain(jd) {
  const text = (jd || "").toLowerCase();
  const scores = {};
  for (const [dom, signals] of Object.entries(DETECT_SIGNALS)) {
    scores[dom] = signals.reduce((n, s) => {
      const re = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
      return n + (text.match(re)?.length || 0);
    }, 0);
  }
  let best = "software";
  let bestScore = 0;
  for (const [dom, sc] of Object.entries(scores)) {
    if (sc > bestScore) {
      best = dom;
      bestScore = sc;
    }
  }
  const total = Object.values(scores).reduce((x, y) => x + y, 0) || 1;
  return {
    domain: best,
    confidence: best === "software" ? 0 : Math.round((bestScore / total) * 100) / 100,
    signals: scores,
  };
}

module.exports = { resolveDomain, detectDomain, DEFAULT_DOMAIN };
