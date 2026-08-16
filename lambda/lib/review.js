// ============================================================================
// review.js — deterministic recruiter-lint for generated resumes.
//
// lintResume(resumeData, { length }) → findings[]
//   { severity: "major"|"minor", rule, location, quote, message }
//
// Pure string/date logic — no I/O, no LLM. Thresholds and lexicon extensions
// live in config.RECRUITER_RUBRIC; the AI-tell lexicon reuses config.ANTI_SLOP.
// Spec: docs/superpowers/specs/2026-08-15-recruiter-adversarial-review-design.md
// ============================================================================

const { ANTI_SLOP, RECRUITER_RUBRIC, ACTION_VERBS } = require("./config");

// ── Text collection ─────────────────────────────────────────────────────────

// Flatten the resume into [{ location, text }] units the rules operate on.
function textUnits(resumeData) {
  const units = [];
  if (resumeData.professional_summary) {
    units.push({ location: "professional_summary", text: String(resumeData.professional_summary) });
  }
  (resumeData.experience || []).forEach((job, ji) => {
    (job.bullets || []).forEach((b, bi) => {
      if (b) units.push({ location: `experience[${ji}].bullets[${bi}]`, text: String(b) });
    });
  });
  return units;
}

function snippet(text, max = 90) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

// ── ai_tell_word / ai_tell_phrase ───────────────────────────────────────────

// Forms sanctioned as action verbs are never flagged (e.g. "Transformed" is a
// valid ACTION_VERB even though "transformative" is banned).
const ACTION_VERB_FORMS = new Set(
  Object.values(ACTION_VERBS).flat().map((v) => v.toLowerCase())
);

// Morphological variants: leverage → leverages, leveraged, leveraging, …
function wordFormsPattern(word) {
  const stem = word.endsWith("e") ? word.slice(0, -1) : word;
  const forms = new Set([word, `${word}s`, `${word}es`, `${word}d`, `${word}ed`, `${stem}ing`, `${stem}ed`]);
  return new RegExp(`\\b(${[...forms].join("|")})\\b`, "gi");
}

const HARD_TELL_WORDS = ANTI_SLOP.banned_words
  .filter((w) => w.severity === "hard")
  .map((w) => ({ word: w.word, severity: "major", pattern: wordFormsPattern(w.word) }));

const EXTRA_TELL_WORDS = RECRUITER_RUBRIC.extra_flag_words
  .map((w) => ({ word: w, severity: "minor", pattern: wordFormsPattern(w) }));

// Only literal phrases lint mechanically; templates ("not just X, but Y") are
// prompt guidance and cannot be substring-matched.
const LITERAL_TELL_PHRASES = ANTI_SLOP.banned_phrases
  .filter((p) => p.severity === "hard" && !/[()]|\bX\b|\bY\b/.test(p.phrase))
  .map((p) => p.phrase.toLowerCase());

function lintAiTells(units, findings) {
  for (const { location, text } of units) {
    for (const { word, severity, pattern } of [...HARD_TELL_WORDS, ...EXTRA_TELL_WORDS]) {
      pattern.lastIndex = 0;
      let m;
      let flagged = false;
      while (!flagged && (m = pattern.exec(text)) !== null) {
        if (ACTION_VERB_FORMS.has(m[1].toLowerCase())) continue; // sanctioned verb form
        findings.push({
          severity,
          rule: "ai_tell_word",
          location,
          quote: snippet(text),
          message: `"${m[1]}" is a recognized AI-tell (form of "${word}") — recruiters pattern-match on it.`,
        });
        flagged = true;
      }
    }
    const lower = text.toLowerCase();
    for (const phrase of LITERAL_TELL_PHRASES) {
      if (lower.includes(phrase)) {
        findings.push({
          severity: "major",
          rule: "ai_tell_phrase",
          location,
          quote: snippet(text),
          message: `"${phrase}" is a stock AI/resume cliché recruiters flag on sight.`,
        });
      }
    }
  }
}

// ── em_dash_density ─────────────────────────────────────────────────────────

function lintEmDashes(units, findings) {
  const all = units.map((u) => u.text).join("\n");
  const dashes = (all.match(/[—–]/g) || []).length;
  if (dashes < 3) return;
  const words = all.split(/\s+/).filter(Boolean).length;
  const allowed = (words / 500) * RECRUITER_RUBRIC.em_dash_max_per_500_words;
  if (dashes > allowed) {
    const first = all.search(/[—–]/);
    findings.push({
      severity: "major",
      rule: "em_dash_density",
      location: "document",
      quote: snippet(all.slice(Math.max(0, first - 30), first + 40).replace(/\n/g, " ")),
      message: `${dashes} em/en-dashes in ~${words} words — humans average ~1 per 500. Heavy dash use is a strong AI signal.`,
    });
  }
}

// ── bullet_symmetry ─────────────────────────────────────────────────────────

function lintBulletSymmetry(resumeData, findings) {
  const cfg = RECRUITER_RUBRIC.bullet_symmetry;
  (resumeData.experience || []).forEach((job, ji) => {
    const bullets = (job.bullets || []).filter(Boolean).map(String);
    if (bullets.length < cfg.min_bullets) return;

    const lengths = bullets.map((b) => b.length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const stddev = Math.sqrt(lengths.reduce((a, l) => a + (l - mean) ** 2, 0) / lengths.length);
    if (mean > 0 && stddev / mean < cfg.min_length_stddev_ratio) {
      findings.push({
        severity: "minor",
        rule: "bullet_symmetry",
        location: `experience[${ji}]`,
        quote: snippet(bullets[0]),
        message: `All ${bullets.length} bullets under ${job.company || "this role"} are nearly identical length — robotic symmetry reads as AI-written. Vary bullet length and shape.`,
      });
    }

    const openers = bullets.map((b) => (b.trim().split(/\s+/)[0] || "").toLowerCase());
    const counts = {};
    for (const o of openers) counts[o] = (counts[o] || 0) + 1;
    const [topWord, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (topCount / bullets.length > cfg.max_same_opener_ratio) {
      findings.push({
        severity: "minor",
        rule: "bullet_symmetry",
        location: `experience[${ji}]`,
        quote: snippet(bullets[0]),
        message: `${topCount} of ${bullets.length} bullets under ${job.company || "this role"} open with "${topWord}" — vary the opening verbs.`,
      });
    }
  });
}

// ── naked_metric / implausible_metric ───────────────────────────────────────

const METRIC_RE = /(\d+(?:\.\d+)?)\s*(%|×|x\b)/gi;

function lintMetrics(units, findings) {
  const cfg = RECRUITER_RUBRIC.naked_metric;
  const contextRe = new RegExp(`\\b(${cfg.context_words.join("|")})\\b`, "i");
  for (const { location, text } of units) {
    METRIC_RE.lastIndex = 0;
    let m;
    while ((m = METRIC_RE.exec(text)) !== null) {
      const value = parseFloat(m[1]);
      if (m[2] === "%" && value > cfg.max_plausible_pct) {
        findings.push({
          severity: "major",
          rule: "implausible_metric",
          location,
          quote: snippet(text),
          message: `"${m[0]}" — improvements above ${cfg.max_plausible_pct}% read as fabricated. Restate with a real baseline (e.g. "from X to Y") or a believable figure.`,
        });
        continue;
      }
      const window = text.slice(Math.max(0, m.index - cfg.window_chars), m.index + m[0].length + cfg.window_chars);
      if (!contextRe.test(window)) {
        findings.push({
          severity: "minor",
          rule: "naked_metric",
          location,
          quote: snippet(text),
          message: `"${m[0]}" has no baseline or context nearby — unanchored metrics are a top r/resumes complaint. Add "from X to Y" or the measurement basis.`,
        });
      }
    }
  }
}

// ── tense_mismatch ──────────────────────────────────────────────────────────

const IRREGULAR_PAST = new Set([
  "led", "built", "drove", "cut", "ran", "wrote", "made", "grew", "held", "kept",
  "brought", "took", "won", "sold", "sent", "set", "put", "left", "began", "came",
  "found", "gave", "went", "knew", "lost", "met", "paid", "rose", "saw", "stood",
  "taught", "thought", "threw", "understood", "drew", "chose", "shipped", "spent",
]);
const PRESENT_BASE = new Set([
  "lead", "own", "drive", "manage", "build", "architect", "design", "maintain",
  "oversee", "mentor", "operate", "serve", "partner", "coach", "run", "ship",
  "develop", "deliver", "advise",
]);

function tenseOf(word) {
  const w = word.toLowerCase();
  if (IRREGULAR_PAST.has(w) || /ed$/.test(w)) return "past";
  if (PRESENT_BASE.has(w)) return "present";
  return null; // unknown — ignored
}

function lintTense(resumeData, findings) {
  (resumeData.experience || []).forEach((job, ji) => {
    const bullets = (job.bullets || []).filter(Boolean).map(String);
    if (bullets.length < 3) return;
    let past = 0, present = 0;
    for (const b of bullets) {
      const t = tenseOf(b.trim().split(/\s+/)[0] || "");
      if (t === "past") past++;
      else if (t === "present") present++;
    }
    const total = past + present;
    if (past >= 1 && present >= 1 && Math.min(past, present) / total > 0.3) {
      findings.push({
        severity: "minor",
        rule: "tense_mismatch",
        location: `experience[${ji}]`,
        quote: snippet(bullets[0]),
        message: `Bullets under ${job.company || "this role"} mix past and present tense (${past} past / ${present} present) — pick one per role.`,
      });
    }
  });
}

// ── date_overlap ────────────────────────────────────────────────────────────

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// "Feb 2021" / "February 2021" / "2021" → absolute month index; null if unparseable
function parseMonth(s, nowIfPresent = false) {
  if (!s) return null;
  const str = String(s).trim().toLowerCase();
  if (/present|current|now/.test(str)) {
    if (!nowIfPresent) return null;
    const d = new Date();
    return d.getFullYear() * 12 + d.getMonth();
  }
  const m = str.match(/([a-z]{3,9})?\s*(\d{4})/);
  if (!m) return null;
  const year = parseInt(m[2], 10);
  const month = m[1] ? MONTHS[m[1].slice(0, 3)] : 5;
  if (month === undefined) return null;
  return year * 12 + month;
}

function lintDates(resumeData, findings) {
  const jobs = resumeData.experience || [];
  jobs.forEach((job, ji) => {
    const start = parseMonth(job.start_date);
    const end = parseMonth(job.end_date, true);
    if (start !== null && end !== null && start > end) {
      findings.push({
        severity: "major",
        rule: "date_overlap",
        location: `experience[${ji}]`,
        quote: `${job.start_date} – ${job.end_date}`,
        message: `${job.company || "This role"} starts after it ends (${job.start_date} → ${job.end_date}).`,
      });
    }
  });
  // Entries are most-recent-first: each next job should end before this one starts
  for (let i = 0; i + 1 < jobs.length; i++) {
    const currStart = parseMonth(jobs[i].start_date);
    const prevEnd = parseMonth(jobs[i + 1].end_date, true);
    if (currStart === null || prevEnd === null) continue;
    const overlap = prevEnd - currStart;
    if (overlap > 1) {
      findings.push({
        severity: "major",
        rule: "date_overlap",
        location: `experience[${i + 1}]`,
        quote: `${jobs[i + 1].company || "?"} ends ${jobs[i + 1].end_date}; ${jobs[i].company || "?"} starts ${jobs[i].start_date}`,
        message: `${jobs[i + 1].company || "A role"} overlaps ${jobs[i].company || "the next role"} by ${overlap} months — recruiters read unexplained overlaps as errors or padding.`,
      });
    }
  }
}

// ── duplicate_bullet ────────────────────────────────────────────────────────

const STOPWORDS = new Set(["the", "a", "an", "for", "of", "to", "and", "in", "on", "with", "by", "at", "across", "our", "its"]);

function tokenSet(text) {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  );
}

function lintDuplicates(resumeData, findings) {
  const entries = [];
  (resumeData.experience || []).forEach((job, ji) => {
    (job.bullets || []).forEach((b, bi) => {
      if (b) entries.push({ location: `experience[${ji}].bullets[${bi}]`, text: String(b), tokens: tokenSet(String(b)) });
    });
  });
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i].tokens, b = entries[j].tokens;
      if (a.size < 3 || b.size < 3) continue;
      let inter = 0;
      for (const t of a) if (b.has(t)) inter++;
      const jaccard = inter / (a.size + b.size - inter);
      if (jaccard > RECRUITER_RUBRIC.duplicate_bullet_overlap) {
        findings.push({
          severity: "major",
          rule: "duplicate_bullet",
          location: `${entries[i].location} + ${entries[j].location}`,
          quote: snippet(entries[i].text),
          message: `Near-duplicate bullets (${Math.round(jaccard * 100)}% overlap) — recruiters read repetition as padding. Merge or differentiate them.`,
        });
      }
    }
  }
}

// ── unevidenced_skill ───────────────────────────────────────────────────────

function lintSkills(resumeData, findings) {
  const skills = [];
  const ts = resumeData.technical_skills;
  if (Array.isArray(ts)) skills.push(...ts);
  else if (ts && typeof ts === "object") for (const v of Object.values(ts)) if (Array.isArray(v)) skills.push(...v);
  const clean = skills.map(String).filter(Boolean);
  if (clean.length < 3) return;

  const body = [resumeData.professional_summary || "",
    ...(resumeData.experience || []).flatMap((j) => j.bullets || [])].join("\n");
  const unevidenced = clean.filter((s) => {
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`, "i").test(body);
  });
  if (unevidenced.length / clean.length > RECRUITER_RUBRIC.unevidenced_skill_ratio) {
    findings.push({
      severity: "minor",
      rule: "unevidenced_skill",
      location: "technical_skills",
      quote: snippet(unevidenced.slice(0, 8).join(", ")),
      message: `${unevidenced.length} of ${clean.length} listed skills never appear in the summary or any bullet — reads as keyword stuffing. Evidence them or cut them.`,
    });
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────

const SEVERITY_ORDER = { reject_risk: 0, major: 1, minor: 2 };

function lintResume(resumeData, opts = {}) {
  if (!resumeData || typeof resumeData !== "object") return [];
  const findings = [];
  const units = textUnits(resumeData);
  lintAiTells(units, findings);
  lintEmDashes(units, findings, opts);
  lintBulletSymmetry(resumeData, findings);
  lintMetrics(units, findings);
  lintTense(resumeData, findings);
  lintDates(resumeData, findings);
  lintDuplicates(resumeData, findings);
  lintSkills(resumeData, findings);
  findings.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  return findings;
}

module.exports = { lintResume };
