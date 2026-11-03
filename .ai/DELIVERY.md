# ResumeX delivery

- Repository: bdevz/resumex; base branch master.
- Target: existing production ResumeX application. Backend uses lambda/, frontend uses frontend/index.html.
- Authority: owner requested the live EasyCLIProxy routing repair, then explicitly requested an Aside end-to-end test, test resume, and committing the code to GitHub on 2026-11-03. Publish the fix branch and a reviewable PR; no broader infrastructure changes are part of this task.
- Production writer: targeted updates of the existing restricted relay service. Lambda handler and endpoint helper in this change match the already deployed package. Frontend unchanged.
- Runtime path: Lambda -> authenticated public HTTPS relay -> private-network HTTPS gateway -> EasyCLIProxyAPI.
- Outcome: selected GPT-5.6 Terra model completes a resume through the live UI, with download and history persistence.
- Validation: node --test scripts/proxy-relay.test.js lambda/lib/__tests__/*.test.js; live credential rejection and management isolation; one synthetic Aside Generate New workflow.
- Recovery: inspect the active service first, restore its saved pre-change service configuration, then restart only that relay. Updated relay retains its original loopback default. For Lambda changes preserve a rollback version and all environment settings; do not use deploy.sh for routing-only updates.
- Credentials: use backend environment or owner-only service credential storage; never publish keys, local credential paths or operational dumps.
- Availability: relay host, upstream host, private network and proxy must remain online.
- Evidence: docs/verification/2026-11-03-provider-routing.md. 185 tests passed; live generation, DOCX download and history reopening succeeded. Contact placeholders and timeline false positives are recorded separately.
