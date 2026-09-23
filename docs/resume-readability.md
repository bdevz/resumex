# ResumeX human-readable resume guidance

Updated 2026-09-23. This is product guidance, not an ATS pass-rate claim or a validated hiring predictor.

## What the UI checks

The 5-second review favors an immediately understandable action and result. It calls out dense roles (more than six bullets), passive or vague openings, long bullets, and bullets whose value is not apparent. Each bullet shows a short reason instead of an uncalibrated numeric rating. Recruiter lint remains separate for mechanical flags. A “Clear” badge only means no listed rule fired; it does not verify factual accuracy or predict interviews.

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
