const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { enforceConsistency, findConsistencyIssues, companyCloud } = require("../consistency");
const { validateTimeline, buildOptimizeSystemPrompt, buildSystemPrompt, buildRevisePrompt } = require("../prompts");

const NOW = new Date(2026, 8, 26);
const role = (company, start, end, bullets, extra = {}) => ({ company, title: "Engineer", start_date: start, end_date: end, bullets, ...extra });
const run = (resume, domain = "software") => enforceConsistency(resume, { domain, now: NOW });

describe("technology timeline enforcement", () => {
  it("rewrites tech that did not exist when the role ended", () => {
    const { resumeData, fixes } = run({ experience: [
      role("Oracle", "Jan 2010", "Oct 2012", ["Built RAG pipelines with LangChain on Kubernetes and Terraform"]),
    ] });
    const b = resumeData.experience[0].bullets[0];
    assert.doesNotMatch(b, /RAG|LangChain|Kubernetes|Terraform/);
    assert.ok(fixes.length >= 4);
  });

  it("keeps tech for a role that runs past its release year", () => {
    const bullets = ["Led LLM document-review pilots with RAG and vector databases"];
    const { resumeData, fixes } = run({ experience: [role("Cohere", "Feb 2021", "May 2024", bullets)] });
    assert.deepEqual(resumeData.experience[0].bullets, bullets);
    assert.equal(fixes.length, 0);
  });

  it("treats Present as today", () => {
    const bullets = ["Built MCP servers with the OpenAI Agents SDK and LangGraph"];
    const { resumeData } = run({ experience: [role("Acme", "Jun 2024", "Present", bullets)] });
    assert.deepEqual(resumeData.experience[0].bullets, bullets);
  });

  it("handles plurals, LLM-as-judge and sentence start", () => {
    const { resumeData } = run({ experience: [role("Acme", "2015", "Dec 2019", [
      "LLMs scored outputs with LLM-as-judge checks",
    ])] });
    assert.equal(resumeData.experience[0].bullets[0], "NLP models scored outputs with rubric-based checks");
  });

  it("does not touch the verb 'go' or unrelated words", () => {
    const bullets = ["Cut go-live time and ran drag-and-drop storage audits"];
    const { resumeData } = run({ experience: [role("Acme", "Jan 2008", "Dec 2010", bullets)] });
    assert.deepEqual(resumeData.experience[0].bullets, bullets);
  });

  it("covers consulting client bullets", () => {
    const { resumeData } = run({ experience: [role("Infosys", "Jan 2011", "Dec 2013", [], {
      is_consulting: true,
      clients: [{ client_name: "Acme Bank", start_date: "Jan 2011", end_date: "Dec 2013", bullets: ["Built GraphQL APIs in TypeScript"] }],
    })] });
    assert.equal(resumeData.experience[0].clients[0].bullets[0], "Built REST APIs in TypeScript");
  });

  it("removes career-wide anachronisms from skills only when no role supports them", () => {
    const { resumeData } = run({
      technical_skills: { Tools: "LangGraph, Jenkins, Docker" },
      experience: [role("Acme", "Jan 2015", "Dec 2020", ["Built services"])],
    });
    assert.equal(resumeData.technical_skills.Tools, "Jenkins, Docker");
  });

  it("does not mutate its input", () => {
    const input = { experience: [role("Oracle", "Jan 2010", "Oct 2012", ["Used Docker"])] };
    run(input);
    assert.equal(input.experience[0].bullets[0], "Used Docker");
  });
});

describe("employer names in effect during the role", () => {
  it("uses Facebook for a Meta role that ended before Oct 2021", () => {
    const { resumeData, fixes } = run({ experience: [role("Meta", "Oct 2012", "Feb 2021", ["Improved Meta ads ranking"])] });
    assert.equal(resumeData.experience[0].company, "Facebook");
    assert.equal(resumeData.experience[0].bullets[0], "Improved Facebook ads ranking");
    assert.match(fixes[0], /Facebook/);
  });

  it("keeps Meta when the role runs past the rename", () => {
    const { resumeData } = run({ experience: [role("Meta", "Jan 2019", "Present", ["Improved ads ranking"])] });
    assert.equal(resumeData.experience[0].company, "Meta");
  });
});

describe("cloud consistency", () => {
  it("knows well-known employers' clouds", () => {
    assert.equal(companyCloud("VRBO/Expedia"), "aws");
    assert.equal(companyCloud("Microsoft"), "azure");
    assert.equal(companyCloud("Spotify"), "gcp");
    assert.equal(companyCloud("Cohere"), null);
  });

  it("swaps other-cloud services at an AWS company", () => {
    const { resumeData, fixes } = run({ experience: [role("Expedia", "Jan 2020", "Present", [
      "Deployed agents on AKS with Azure OpenAI and Cosmos DB",
    ])] });
    assert.equal(resumeData.experience[0].bullets[0], "Deployed agents on EKS with Amazon Bedrock and Amazon DynamoDB");
    assert.ok(fixes.every(f => /known for running on AWS/.test(f)));
  });

  it("uses the dominant cloud when the employer is unknown", () => {
    const { resumeData } = run({ experience: [role("Acme", "Jan 2020", "Present", [
      "Ran services on AWS Lambda and Amazon S3",
      "Queried logs in BigQuery",
    ])] });
    assert.equal(resumeData.experience[0].bullets[1], "Queried logs in Redshift");
  });

  it("allows an explicit migration at an unknown employer", () => {
    const bullets = ["Migrated billing from Azure to AWS", "Ran services on AWS Lambda"];
    const { resumeData } = run({ experience: [role("Acme", "Jan 2020", "Present", bullets)] });
    assert.deepEqual(resumeData.experience[0].bullets, bullets);
  });

  it("drops skills for clouds no role uses and aligns the summary", () => {
    const { resumeData } = run({
      professional_summary: "Engineer shipping services on AWS and Azure.",
      technical_skills: { "Cloud & DevOps": "AWS, Amazon EKS, Microsoft Azure, AKS, Docker" },
      experience: [role("Netflix", "Jan 2020", "Present", ["Ran services on Amazon EKS"])],
    });
    assert.equal(resumeData.technical_skills["Cloud & DevOps"], "AWS, Amazon EKS, Docker");
    assert.equal(resumeData.professional_summary, "Engineer shipping services on AWS.");
  });

  it("leaves generic words like IAM and API Gateway alone", () => {
    const bullets = ["Designed IAM policies and an API Gateway for Azure Functions"];
    const { resumeData } = run({ experience: [role("Microsoft", "Jan 2020", "Present", bullets)] });
    assert.deepEqual(resumeData.experience[0].bullets, bullets);
  });
});

describe("validation and prompts", () => {
  it("reports remaining issues and none after enforcement", () => {
    const resume = { experience: [
      role("Meta", "Oct 2012", "Feb 2021", ["Built RAG with LangChain"]),
      role("Expedia", "Mar 2021", "Present", ["Ran GKE on AWS"]),
    ] };
    assert.ok(findConsistencyIssues(resume, "software", NOW).length >= 3);
    const { resumeData } = run(resume);
    assert.deepEqual(findConsistencyIssues(resumeData, "software", NOW), []);
    assert.deepEqual(validateTimeline(resumeData, "software"), []);
  });

  it("validateTimeline handles Present without false gaps", () => {
    const w = validateTimeline({ experience: [
      role("A", "Jun 2024", "Present", ["x"]),
      role("B", "Feb 2021", "May 2024", ["y"]),
    ] }, "software");
    assert.deepEqual(w, []);
  });

  it("every generation prompt carries the timeline, employer-name and cloud rules", () => {
    for (const p of [buildSystemPrompt(), buildOptimizeSystemPrompt(), buildRevisePrompt("software", "standard")]) {
      assert.match(p, /role's END date/);
      assert.match(p, /EMPLOYER NAMES/);
      assert.match(p, /CLOUD CONSISTENCY/);
      assert.match(p, /overrides JD keyword matching AND the original resume's wording/);
    }
  });
});
