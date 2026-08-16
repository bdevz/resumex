# Recruiter Adversarial Review — Design Spec

## Problem

ResumeX defends against AI-sounding output at generation time (the `ANTI_SLOP` prompt rules) and scores bullets individually (`scoreBullet()`), but nothing reads the *finished document* the way a skeptical recruiter reads it. Forum communities like r/resumes document a stable set of instant-reject signals that generation-time prompting cannot fully prevent:

1. **AI-tell vocabulary** — "spearheaded", "leveraged", "pivotal", "delve" now signal AI authorship; surveys report ~91% of recruiters believe they can spot AI-written resumes in seconds and ~49% of US hiring managers reject them.
2. **Em-dash overuse** — humans average ~1 per 500 words; LLMs emit one every 50–80 words. Three or more on a page is a pattern match.
3. **Robotic bullet symmetry** — every bullet the same length and grammatical shape.
4. **Naked or implausible metrics** — "improved performance by 400%" with no baseline, tool, or obstacle mentioned.
5. **Classic non-AI flags** — tense/date inconsistencies, near-duplicate bullets, keyword stuffing, skills listed but never evidenced.

Some of these are mechanically detectable (no LLM needed); others require judgment (fabrication smell, JD misalignment, seniority-voice mismatch).

## Goal

Add a two-layer adversarial review:

1. **Deterministic lint** — free, instant, runs on every generation, catches the mechanical tells.
2. **Recruiter review** — an on-demand LLM pass by a *different model family* than the generator, applying a curated recruiter rubric, with findings the user can selectively apply as fixes.

Success criteria: every generated resume ships with lint results attached; a user can run a recruiter review and apply accepted fixes in one click; a fixed resume re-lints clean (or shows only findings the user declined); no automatic critique-revise loops.

## Decisions already made (with the owner)

- **Flow:** lint always-on + review on demand. Not an automatic critique-and-revise loop (doubles cost/time invisibly) and not review-only (too manual).
- **Reviewer:** cross-family. A model family is blind to its own writing tics, so Claude output is reviewed by GPT and vice versa. Mid-tier reviewers keep cost moderate.
- **Rubric:** curated, lives in code, updated by hand. No live Reddit fetching (noise, latency, API terms).
- **Fix pass:** one round, executed by the *original generator model* (it owns the voice; the reviewer only critiques).

## Design

### 1. `RECRUITER_RUBRIC` config block (`lambda/lib/config.js`)

Single source of truth shared by the lint engine and the reviewer prompt. Follows the `ANTI_SLOP` precedent (config in `config.js`, prompt assembly in `prompts.js`).

```js
RECRUITER_RUBRIC = {
  // Lexicon: reuses ANTI_SLOP.banned_words / banned_phrases (do NOT duplicate),
  // plus recruiter-specific additions not banned at generation time:
  extra_flag_words: ["honed", "showcasing", "meticulous", "results-driven", "dynamic", "passionate"],
  em_dash_max_per_500_words: 2,        // flag above this density, or ≥3 absolute on standard length
  bullet_symmetry: {
    min_length_stddev_ratio: 0.18,     // stddev/mean of bullet char lengths per job below this → flag
    max_same_opener_ratio: 0.6,        // >60% of a job's bullets opening with the same first word → flag
  },
  naked_metric: {
    context_words: ["from", "to", "baseline", "vs", "versus", "p99", "p95", "previously"],
    window_chars: 80,                  // a %/×-claim with no context word within this window → flag
    max_plausible_pct: 200,            // improvements above this → flag as implausible
  },
  // Judgment criteria — prompt-only, mirrored into the reviewer prompt verbatim:
  reviewer_criteria: [
    "jd_alignment",        // must-have JD requirements with no supporting evidence in the resume
    "fabrication_smell",   // claims with no tools, obstacles, or trade-offs; uniformly perfect outcomes
    "seniority_voice",     // voice doesn't match the target level (e.g. Principal role, mid-level phrasing)
    "phone_screen_test",   // blunt verdict: would a recruiter phone-screen this? what stops them?
  ],
}
```

### 2. Lint engine (`lambda/lib/review.js`, new file)

`lintResume(resumeData, { length }) → findings[]` — pure functions, no I/O, no LLM.

Finding shape (shared with reviewer findings):

```js
{ severity: "reject_risk" | "major" | "minor",
  rule: "ai_tell_word" | "em_dash_density" | "bullet_symmetry" | "naked_metric" |
        "implausible_metric" | "tense_mismatch" | "date_overlap" | "duplicate_bullet" |
        "unevidenced_skill",
  location: "experience[0].bullets[3]" | "professional_summary" | "technical_skills",
  quote: "…the offending text…",
  message: "human-readable explanation of why recruiters flag this" }
```

Rules and severities:

| Rule | Logic | Severity |
|---|---|---|
| `ai_tell_word` | Word (or morphological form) from `ANTI_SLOP` hard list or `extra_flag_words` appears in summary/bullets | hard-list → `major`, extras → `minor` |
| `em_dash_density` | Em-dash count exceeds `em_dash_max_per_500_words` pro-rated by document word count, or ≥3 absolute at standard length | `major` |
| `bullet_symmetry` | Per job: length stddev/mean below threshold, or same-opener ratio above threshold | `minor` |
| `naked_metric` | `%`/`×`-claim with no context word within `window_chars` | `minor` |
| `implausible_metric` | Improvement claim above `max_plausible_pct` | `major` |
| `tense_mismatch` | Past-tense openers in the current role (end_date "Present"), present-tense in past roles; flag when >30% of a job's bullets mismatch | `minor` |
| `date_overlap` | Experience entries whose ranges overlap or are out of order | `major` |
| `duplicate_bullet` | Two bullets anywhere with >70% token overlap (case-folded, stopwords removed) | `major` |
| `unevidenced_skill` | Item in `technical_skills` never mentioned in any bullet or the summary (whole-word match); flag only when >40% of listed skills are unevidenced (keyword-stuffing signal, not per-skill noise) | `minor` |

Wire-up: `handleAnalyze`, the streaming completion path, and `/optimize` attach `lint: lintResume(resumeData, { length })` to their result payloads next to `scoring` and `timeline_warnings`. `handleBuild` is untouched.

### 3. Recruiter review route (`POST /review`)

Reuses the existing async-job pattern (`202 { jobId }` + `/status` polling) — API Gateway's ~30s sync cap rules out a synchronous route.

Request: `{ resumeData, jd, generatorModel }` (`generatorModel` = the dropdown alias used for generation; the frontend already has it as `model_used`).

Reviewer selection (registry-driven, in `modelInfo` terms):

| Generator provider | Reviewer |
|---|---|
| `anthropic` | `gpt-5.6-terra` |
| `openai` | `claude-sonnet-5` |
| unknown / passthrough | `claude-sonnet-5` |

If the reviewer's provider errors (e.g. missing API key), fall back to the strongest available model of the other family and record which reviewer actually ran. The response always includes `reviewer_model`.

Prompt: `buildReviewerPrompt(jd, resumeData)` in `prompts.js` — a skeptical-recruiter persona ("you screen hundreds of AI-written resumes a week; your job is to find reasons to reject") + the `reviewer_criteria` from `RECRUITER_RUBRIC` + the lint findings already computed (so the reviewer doesn't waste output re-reporting mechanical tells — it is told those are handled and to focus on judgment calls). Instructed to report *everything* it finds with severity and confidence, not to self-filter (models follow severity filters literally, which depresses recall).

Response (on job completion):

```js
{ status: "complete",
  reviewer_model: "gpt-5.6-terra",
  verdict: { phone_screen: "yes" | "borderline" | "no", reason: "…one paragraph…" },
  findings: [ { severity, rule: "reviewer_judgment", criterion: "fabrication_smell",
                location, quote, message, suggested_rewrite } ],   // max 15, ordered by severity
  lint: [ …the deterministic findings, echoed for a single rendering path… ] }
```

Reviewer output is requested as strict JSON (OpenAI: `response_format: json_object`, already the pattern; Anthropic: prompt-enforced like existing routes) and parsed with the existing `extractJSON` tolerance.

### 4. Apply-fixes route (`POST /revise`)

Request: `{ resumeData, jd, findings, model }` — `findings` is the subset the user accepted (checkboxes in the panel); `model` is the original generator alias. Async job.

Prompt: `buildRevisePrompt(jd, resumeData, findings)` — "revise this resume to resolve exactly these findings; change nothing else; keep the voice". Returns full revised `resumeData` in the same schema (reuses the short-key expansion). Response includes fresh `lint` and `scoring` so the frontend swaps everything at once.

One round only. After a revise, lint re-runs automatically; the user may manually run `/review` again, but nothing loops.

### 5. Frontend (`frontend/index.html`)

- **Lint strip** on the result screen: count badge per severity, expandable list showing `quote` + `message`. Renders from the `lint` array in the generation response. No new network calls.
- **"Recruiter Review" button** next to the download button: fires `/review`, polls `/status`, renders findings grouped by severity with a checkbox per finding (default: `reject_risk` and `major` checked, `minor` unchecked) and the verdict paragraph at the top.
- **"Apply selected fixes" button**: fires `/revise` with checked findings, polls, replaces the in-memory `resumeData`, re-renders scoring + lint strip. The existing Download/build flow then operates on the revised data unchanged.

### 6. Cost and latency

| Operation | Cost | Latency |
|---|---|---|
| Lint | $0 | ~0 (same response) |
| Review | ~$0.02–0.10 (mid-tier, ~2–4K output tokens) | ~20–40s |
| Revise | ≈ one regeneration at the original model's price | same as a generation |

## Testing

- **Unit tests** (`lambda/lib/__tests__/review.test.js`, `node --test`): one fixture pair per lint rule (triggering and non-triggering), plus edge cases — empty bullets, single-job resumes, resumes with no metrics. Target: every rule and threshold in `RECRUITER_RUBRIC` exercised.
- **Prompt baseline**: snapshot fixture for `buildReviewerPrompt` / `buildRevisePrompt` following `software-prompts.baseline.json` precedent.
- **Integration**: run lint against the three saved test resumes from 2026-08-15 (Fable 5 / Opus 5 / GPT-5.6 Sol outputs) as realistic fixtures; assert the known issues (e.g. any residual AI-tell words) are caught.
- **E2E (manual)**: live-API review + revise round on one generated resume, verifying the revised output lints cleaner than the original.

## Out of scope (deliberately)

- Rendering lint/review findings into the DOCX (cover note) — revisit after the UI panel proves useful.
- Automatic multi-round critique-revise loops.
- Live fetching of Reddit/forum content at review time.
- Persisting review findings into the history records (history keeps working unchanged; revised resumes save as new history entries via the existing path).
- ATS-simulation checks (keyword-parsing emulation) — different feature.
