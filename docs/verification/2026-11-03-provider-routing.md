# Provider routing verification

Live ResumeX was exercised through Aside on 2026-11-03 using the existing signed-in browser session. The test selected Generate New, GPT-5.6 Terra, Software Engineering, standard length, no education and no certifications. All submitted candidate, employer and job details were explicitly fictional.

## Results

- Generate Resume completed without the previous unknown-provider error.
- Result identified gpt-5.6-terra and reported 4,969 input / 1,564 output tokens. The UI cost estimate was $0.038; this is not a verified provider invoice.
- The generated result included a summary, skills and three fictional employers.
- Download .docx produced a valid Word ZIP/OOXML file. Text extraction confirmed the summary, skills, employers and twelve bullets; education and certifications were absent as selected.
- My History displayed the new synthetic entry and allowed reopening it.
- Browser result screenshot and native Quick Look document preview were inspected. Full paginated LibreOffice rendering was unavailable in this tool environment; no claim of complete Word pagination validation is made.
- Test resume is retained in the user's application history and local downloads. It is intentionally not added to the public repository.

## Findings outside the routing repair

- Downloaded contact header is Firstname Lastname with placeholder contact links, despite the fictional identity in extra context. The summary does contain Alex Morgan and identifies the resume as synthetic.
- The app reports two 12-month gaps even though displayed transitions are December 2019 to January 2020 and December 2022 to January 2023. These appear to be false-positive timeline warnings.
- Synthetic metrics are generated, as expected for Generate New; this document is a test artifact, not a factual candidate resume.

## Code validation

185 tests passed using `node --test scripts/proxy-relay.test.js lambda/lib/__tests__/*.test.js`. Relay tests also passed on the deployed Node 22 host. Negative live checks reject missing/wrong credentials with 401 and management routes with 404. The deployed relay file hash matches the checked source. Lambda handler and endpoint helper match the currently deployed package; an earlier, undeployed separate Codex route was removed from the publication candidate.
