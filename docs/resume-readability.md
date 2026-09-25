# ResumeX human-readable resume guidance

Updated 2026-09-23. This is product guidance, not an ATS pass-rate claim or a validated hiring predictor.

## What the UI checks

The 5-second review calls out dense roles (more than six bullets), passive or vague openings, long bullets, stock phrasing and obvious filler. It does not mark every bullet “Review” merely because it lacks a narrow list of impact verbs; qualitative purpose, scope and adoption count too. A very short action-only line may get a specific suggestion. The “No quick flag” label means only that no listed rule fired, not that a claim is verified or predicts interviews. The separate Recruiter Review and lint checks still deserve human judgment. On the strongest bullets, add supported value when useful, but never invent a metric.

Optimization must not invent metrics, tools, credentials, employers, or outcomes absent from the source resume. Generated-new resumes are illustrative drafts, not verified candidate histories. The user must verify every claim before sending.

## Design defaults

The default is a standard-length, single-column clean classic design. Modern and executive single-column variants are visible alternatives. A unique composition and longer or two-column variants remain opt-ins. DOCX experience/project bullets share hanging indents so wrapped text aligns with the text, not the bullet glyph. The result preview is approximate; inspect the downloaded DOCX before use.

## Community feedback considered

- Consistent bullet alignment: [r/resumes feedback](https://www.reddit.com/r/resumes/comments/aij4n8/comment/eeo9smi/).
- Restrained single-column layout for fast human scanning: [r/Resume feedback](https://www.reddit.com/r/Resume/comments/1i706ar/comment/m8kk9jr/). Another reader in the same discussion preferred two columns, so that stays opt-in rather than prohibited.
- Reduce ten repetitive bullets to four meaningful accomplishments: [r/resumes critique](https://www.reddit.com/r/resumes/comments/1chw5b5/comment/l26h5ua/). Another comment recommends roughly five, up to seven, per role: [discussion](https://www.reddit.com/r/resumes/comments/1chw5b5/comment/l27g5fy/). This is a warning, not a hard cap.
- Avoid unexplained skill bars: [r/resumes comment](https://www.reddit.com/r/resumes/comments/e8eu7c/comment/fadaxky/). Skill bands remain an explicit advanced option.
- One page is not universal; relevant experience can justify two: [r/resumes discussion](https://www.reddit.com/r/resumes/comments/1kamyy0/comment/mqt0l8w/). The default standard mode targets up to two pages without promising an exact pagination on every input.

These are anecdotal user comments, not verified recruiter credentials or scientific evidence. The app should not present them as universal ATS rules.

## Release smoke checks

1. Verify GPT-6 Sol is selected by default and API `/models` includes GPT-6 Sol, GPT-6 Luna, and Claude Opus 5.5, while existing advanced options remain available.
2. Check all three visible templates and the standard-length default in the live browser.
3. Generate or optimize a synthetic resume and confirm the numeric “out of 7” panel is gone, feedback gives reasons, and the DOCX downloads with hanging indents.
4. Run recruiter review, apply selected fixes, inspect highlighted changes, and confirm the saved message appears only when history persistence succeeds. A failed save must show a warning, not success.
5. Confirm My History reopens the revised result. Do not treat a successful `/status` response alone as proof of persistence.
6. Enter an incorrect team passphrase: Unlock must keep the gate visible and must not save it. Reload with a stale saved passphrase: the gate must ask for fresh credentials, not display a false signed-in state. A History 401 must return to the gate with a clear recovery message. Verify a valid session still opens History.
