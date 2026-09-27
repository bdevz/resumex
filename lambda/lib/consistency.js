// ============================================================================
// consistency.js — deterministic post-generation guards
//
// Prompts ask models to respect technology timelines and cloud consistency,
// but models (and source resumes) still slip. This module is the enforcement
// layer that runs on EVERY resume before it is returned, scored or saved:
//
//   1. Technology timeline: a technology may only appear in a role whose END
//      date is on/after the year it became available. Out-of-era mentions are
//      rewritten to an era-appropriate equivalent (or dropped).
//   2. Employer names: use the name in effect during the role (Facebook, not
//      Meta, for a role that ended before the Oct 2021 rename).
//   3. Cloud consistency: one cloud provider per role. Employers publicly known
//      for a provider keep that provider; otherwise the role's dominant provider
//      wins. Other-provider services are swapped for the equivalent service.
//
// Every change is reported in `fixes` so the UI can show what was corrected.
// ============================================================================

const { resolveDomain } = require("./domains");

// ── Dates ──────────────────────────────────────────────────────────────────

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// Returns months since year 0, or null when the date cannot be read.
function parseYM(dateStr, now = new Date()) {
  if (dateStr == null) return null;
  const s = String(dateStr).trim();
  if (!s) return null;
  if (/present|current|now|today|ongoing/i.test(s)) return now.getFullYear() * 12 + now.getMonth();
  const y = s.match(/(?:19|20)\d{2}/);
  if (!y) return null;
  const mm = s.match(/[A-Za-z]{3}/);
  const m = mm && MONTHS[mm[0].toLowerCase()] != null ? MONTHS[mm[0].toLowerCase()] : 11;
  return parseInt(y[0], 10) * 12 + m;
}

const yearOf = (ym) => (ym == null ? null : Math.floor(ym / 12));

// ── Technology era rules ───────────────────────────────────────────────────
// `term` links to TECH_TIMELINE (which supplies `earliest`, shown in prompts).
// `patterns` default to a case-insensitive word match with optional plural.
// `replace` is the era-appropriate equivalent ("" drops the term).
// Replacements can themselves be out of era; enforcement repeats until stable.

const MULTIWORD_ACRONYM = String.raw`(?:\s*\([A-Z][A-Za-z]{1,6}\))?`;

const ERA_RULES = [
  { term: "retrieval-augmented generation", patterns: [String.raw`\bretrieval[- ]augmented generation${MULTIWORD_ACRONYM}`], replace: "NLP retrieval" },
  { term: "model context protocol (mcp)", patterns: [String.raw`\bModel Context Protocol${MULTIWORD_ACRONYM}`, String.raw`\bMCP(?=[- ](?:servers?|tools?|clients?|integrations?|connectors?)\b)`], replace: "tool-integration" },
  { term: "openai agents sdk", replace: "custom orchestration" },
  { term: "claude agent sdk", replace: "custom orchestration" },
  { term: "computer-use agents", patterns: [String.raw`\bcomputer[- ]use agents?\b`], replace: "UI automation" },
  { term: "browser-use agents", patterns: [String.raw`\bbrowser[- ]use agents?\b`], replace: "browser automation" },
  { term: "large language model", patterns: [String.raw`\blarge language models?${MULTIWORD_ACRONYM}`], replace: "NLP model", plural: "NLP models" },
  { term: "llm-as-judge", patterns: [String.raw`\bLLM[- ]as[- ](?:a[- ])?judge\b`], replace: "rubric-based" },
  { term: "prompt engineering", replace: "NLP tuning" },
  { term: "prompt injection", replace: "input injection" },
  { term: "function calling", replace: "API calling" },
  { term: "tool calling", replace: "API calling" },
  { term: "ai agents", patterns: [String.raw`\b(?:AI|LLM|autonomous) agents?\b`], replace: "automation workflow", plural: "automation workflows" },
  { term: "agentic ai", patterns: [String.raw`\bagentic(?: AI)?\b`], replace: "automated" },
  { term: "generative ai", patterns: [String.raw`\bgenerative AI\b`, String.raw`\bGenAI\b`], replace: "machine learning" },
  { term: "vector database", replace: "search index", plural: "search indexes" },
  { term: "github copilot", replace: "IDE tooling" },
  { term: "openai api", replace: "ML APIs" },
  { term: "chatgpt", replace: "NLP" },
  { term: "gpt-4", patterns: [String.raw`\bGPT-4(?:o|\.\d)?\b`], replace: "NLP models" },
  { term: "langchain", replace: "custom Python" },
  { term: "langgraph", replace: "stateful" },
  { term: "llamaindex", replace: "document indexing" },
  { term: "autogen", replace: "custom orchestration" },
  { term: "crewai", replace: "custom orchestration" },
  { term: "llmops", replace: "MLOps" },
  { term: "mlops", replace: "ML deployment" },
  { term: "llm", patterns: [String.raw`\bLLMs?\b`], replace: "NLP", plural: "NLP models" },
  { term: "rag", patterns: [String.raw`\bRAG\b`], replace: "NLP" },
  { term: "vllm", replace: "TorchServe" },
  { term: "sglang", replace: "TorchServe" },
  { term: "torchserve", replace: "custom model serving" },
  { term: "pgvector", replace: "PostgreSQL full-text search" },
  { term: "opensearch", patterns: [String.raw`\b(?:Amazon )?OpenSearch\b`], replace: "Elasticsearch" },
  { term: "amazon bedrock", patterns: [String.raw`\b(?:Amazon|AWS) Bedrock\b`], replace: "Amazon SageMaker" },
  { term: "amazon sagemaker", patterns: [String.raw`\b(?:Amazon |AWS )?SageMaker\b`], replace: "Amazon EC2" },
  { term: "azure openai", patterns: [String.raw`\bAzure OpenAI(?: Service)?\b`], replace: "Azure Machine Learning" },
  { term: "vertex ai", patterns: [String.raw`\b(?:Google )?Vertex AI\b`], replace: "Google Cloud ML Engine" },
  { term: "amazon eks", patterns: [String.raw`\b(?:Amazon |AWS )?EKS\b`, String.raw`\bElastic Kubernetes Service\b`], replace: "Amazon EC2" },
  { term: "aks", patterns: [String.raw`\bAzure Kubernetes Service${MULTIWORD_ACRONYM}`, String.raw`\bAKS\b`], replace: "Azure Virtual Machines" },
  { term: "opentelemetry", replace: "Zipkin" },
  { term: "zipkin", replace: "application logs" },
  { term: "github actions", replace: "Jenkins" },
  { term: "fastapi", replace: "Flask" },
  { term: "pytorch", replace: "Theano" },
  { term: "tensorflow", replace: "scikit-learn" },
  { term: "hugging face", patterns: [String.raw`\bHugging ?Face(?: Transformers)?\b`], replace: "NLTK" },
  { term: "typescript", replace: "JavaScript" },
  { term: "terraform", replace: "Puppet" },
  { term: "kubernetes", patterns: [String.raw`\bKubernetes\b`, String.raw`\bK8s\b`], replace: "VM clusters" },
  { term: "docker", patterns: [{ src: String.raw`\bDockeri[sz]ed\b`, replace: "VM-packaged" }, { src: String.raw`\bDocker containers?\b`, replace: "virtual machine", plural: "virtual machines" }, { src: String.raw`\bDocker\b`, replace: "VM images" }], replace: "VM images" },
  { term: "react", patterns: [String.raw`\bReact(?:\.js|JS)?\b(?! Native)`], replace: "jQuery" },
  { term: "next.js", patterns: [String.raw`\bNext\.js\b`], replace: "Node.js" },
  { term: "vue.js", patterns: [String.raw`\bVue(?:\.js)?\b`], replace: "jQuery" },
  { term: "svelte", patterns: [String.raw`\bSvelte(?:Kit)?\b`], replace: "jQuery" },
  { term: "go", patterns: [String.raw`\b(?:Golang|Go)\b(?!-)`], replace: "" },
  { term: "rust", patterns: [String.raw`\bRust\b`], replace: "" },
  { term: "graphql", replace: "REST" },
  { term: "deno", patterns: [String.raw`\bDeno\b`], replace: "Node.js" },
  { term: "bun", patterns: [String.raw`\bBun\b`], replace: "Node.js" },
  { term: "aws lambda", replace: "Amazon EC2" },
  { term: "azure functions", replace: "Azure Cloud Services" },
  { term: "snowflake", patterns: [String.raw`\bSnowflake\b`], replace: "Teradata" },
  { term: "databricks", replace: "Hadoop" },
  { term: "apache kafka", patterns: [String.raw`\b(?:Apache )?Kafka\b`], replace: "RabbitMQ" },
  { term: "apache spark", patterns: [String.raw`\b(?:Apache )?Spark\b`], replace: "Hadoop MapReduce" },
  { term: "spring boot", replace: "Spring" },
  { term: "microservices", replace: "SOA services" },
];

// Short, ambiguous words that must be matched case-sensitively.
const CASE_SENSITIVE_PATTERNS = new Set(["rag", "go", "rust", "react", "vue.js", "svelte", "deno", "bun", "snowflake", "apache spark", "apache kafka", "aks", "amazon eks", "kubernetes"]);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function defaultPattern(term) {
  const lead = /^\w/.test(term) ? "\\b" : "";
  const tail = /\w$/.test(term) ? "s?\\b" : "";
  return `${lead}${escapeRe(term)}${tail}`;
}

const _rulesCache = new Map();

// Resolve the rule set for a domain: ERA_RULES plus an automatic rule for any
// TECH_TIMELINE entry (including domain-pack additions) without one.
function eraRulesFor(domain) {
  const c = resolveDomain(domain);
  if (_rulesCache.has(c)) return _rulesCache.get(c);
  const timeline = c.TECH_TIMELINE || {};
  const byTerm = new Map(ERA_RULES.map(r => [r.term, r]));
  const rules = [];
  for (const [term, t] of Object.entries(timeline)) {
    const rule = byTerm.get(term) || { term, replace: "" };
    rules.push({ ...rule, earliest: t.earliest });
  }
  for (const r of ERA_RULES) {
    if (!(r.term in timeline) && r.earliest) rules.push(r);
  }
  const compiled = rules.map(r => {
    const flags = CASE_SENSITIVE_PATTERNS.has(r.term) ? "g" : "gi";
    const sources = r.patterns || [defaultPattern(r.term)];
    const regexes = sources.map(p => {
      const spec = typeof p === "string" ? { src: p } : p;
      const re = new RegExp(spec.src, flags);
      re.replace_ = spec.replace != null ? spec.replace : r.replace;
      re.plural_ = spec.plural != null ? spec.plural : (spec.replace != null ? null : r.plural);
      return re;
    });
    return { ...r, regexes };
  });
  // Most specific first so "LLM-as-judge" is handled before "LLM".
  compiled.sort((a, b) => b.term.length - a.term.length);
  _rulesCache.set(c, compiled);
  return compiled;
}

// ── Text helpers ───────────────────────────────────────────────────────────

function articleFor(word) {
  if (!word) return "a";
  if (/^[A-Z]{2,}/.test(word)) return /^[AEFHILMNORSX]/.test(word) ? "an" : "a";
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function cleanupText(text, removedTerm = false) {
  let t = text;
  t = t.replace(/\(\s*\)/g, "");
  t = t.replace(/\(([^()]+)\)/g, (m, inner, off, whole) => {
    const before = whole.slice(0, off).trimEnd();
    return before.toLowerCase().endsWith(inner.trim().toLowerCase()) ? "" : m;
  });
  // "X and X", "X, X", "X or X" left behind by two terms mapping to the same equivalent.
  for (let i = 0; i < 2; i++) {
    t = t.replace(/\b([A-Za-z][\w.+#/-]*(?: [A-Za-z][\w.+#/-]*){0,3})(?:\s*,\s*|\s+(?:and|or|&)\s+)\1\b/g, "$1");
  }
  t = t.replace(/\b(\w+)\s+\1\b/gi, "$1");
  t = t.replace(/\s+([,;:.])/g, "$1");
  t = t.replace(/([,;])\s*(?:[,;]\s*)+/g, "$1 ");
  if (removedTerm) {
    t = t.replace(/\b(with|and|or|using|via|on|in|through|plus|from)\s*([,;.]|$)/gi, "$2");
    t = t.replace(/\b(with|using|via|on|in|through)\s+(and|or)\s+/gi, "$1 ");
    t = t.replace(/(^|[,;]\s*)(?:and|or)\s*(?=[,;]|$)/gi, "$1");
    // "with A, and B" left after dropping the middle item of a 3-item list.
    t = t.replace(/\b(with|using|on|in|through|via|of|across)\s+([^,;]+), (and|or) /gi, "$1 $2 $3 ");
  }
  t = t.replace(/^[\s,;:]+|[\s,;:]+$/g, "");
  t = t.replace(/\s{2,}/g, " ");
  return t.trim();
}

function capitalizeFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Apply one era rule to a string. Returns { text, hits: [matched strings] }.
function applyRule(text, rule) {
  const hits = [];
  let out = text;
  for (const re of rule.regexes) {
    re.lastIndex = 0;
    out = out.replace(re, (match, ...args) => {
      const offset = args[args.length - 2];
      const core = match.replace(/\s*\([^)]*\)$/, "");
      let rep = /s$/i.test(core) && re.plural_ ? re.plural_ : re.replace_;
      hits.push({ from: match.trim(), to: rep || "" });
      if (!rep) return "";
      if (offset === 0) rep = capitalizeFirst(rep);
      return rep;
    });
  }
  if (hits.length) {
    const reps = new Set(rule.regexes.flatMap(re => [re.replace_, re.plural_]).filter(Boolean));
    for (const rep of reps) {
      out = out.replace(new RegExp(`\\b([Aa]n?) (${escapeRe(rep)})`, "gi"), (m, art, word) => {
        const want = articleFor(word);
        return (art[0] === "A" ? capitalizeFirst(want) : want) + " " + word;
      });
    }
    out = cleanupText(out, hits.some(h => !h.to));
  }
  return { text: out, hits };
}

// Rewrite all out-of-era technology in `text` given the latest usable year.
function enforceEraOnText(text, latestYear, rules) {
  if (typeof text !== "string" || !text || latestYear == null) return { text, changes: [] };
  const changes = [];
  let current = text;
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const rule of rules) {
      if (latestYear >= rule.earliest) continue;
      const { text: next, hits } = applyRule(current, rule);
      if (hits.length) {
        for (const h of hits) changes.push({ from: h.from, to: h.to || "(removed)", term: rule.term, earliest: rule.earliest });
        current = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { text: current, changes };
}

// Comma-separated skills list: rewrite each item, drop empties, dedupe.
function enforceEraOnList(list, latestYear, rules) {
  if (typeof list !== "string" || latestYear == null) return { text: list, changes: [] };
  const changes = [];
  const seen = new Set();
  const items = [];
  for (const raw of list.split(",")) {
    const item = raw.trim();
    const { changes: ch } = enforceEraOnText(item, latestYear, rules);
    // A skill no role could have used is dropped rather than paraphrased.
    if (ch.length) { changes.push({ ...ch[0], from: item, to: "(removed)" }); continue; }
    const text = item;
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    items.push(text);
  }
  return { text: items.join(", "), changes };
}

// ── Employer names in effect at the time ───────────────────────────────────

const COMPANY_RENAMES = [
  { match: /^meta(?: platforms)?(?:,? inc\.?)?$/i, current: "Meta", former: "Facebook", since: 2021 * 12 + 9 },
  { match: /^x(?: corp\.?)?$/i, current: "X", former: "Twitter", since: 2023 * 12 + 6 },
  { match: /^block(?:,? inc\.?)?$/i, current: "Block", former: "Square", since: 2021 * 12 + 11 },
  { match: /^elevance health$/i, current: "Elevance Health", former: "Anthem", since: 2022 * 12 + 5 },
  { match: /^paramount(?: global)?$/i, current: "Paramount", former: "ViacomCBS", since: 2022 * 12 + 1 },
  { match: /^rtx(?: corporation)?$/i, current: "RTX", former: "Raytheon Technologies", since: 2023 * 12 + 6 },
];

// ── Cloud providers ────────────────────────────────────────────────────────

const PROVIDERS = ["aws", "azure", "gcp"];
const PROVIDER_LABEL = { aws: "AWS", azure: "Azure", gcp: "GCP" };

// Equivalent services across providers. First alias of each list is canonical.
const CLOUD_EQUIVALENTS = [
  { aws: ["Amazon EKS", "EKS", "Elastic Kubernetes Service"], azure: ["Azure Kubernetes Service (AKS)", "Azure Kubernetes Service", "AKS"], gcp: ["Google Kubernetes Engine (GKE)", "Google Kubernetes Engine", "GKE"] },
  { aws: ["AWS Lambda"], azure: ["Azure Functions"], gcp: ["Google Cloud Functions", "Cloud Functions"] },
  { aws: ["Amazon S3", "S3"], azure: ["Azure Blob Storage", "Blob Storage"], gcp: ["Google Cloud Storage", "Cloud Storage", "GCS"] },
  { aws: ["Amazon DynamoDB", "DynamoDB"], azure: ["Azure Cosmos DB", "Cosmos DB", "CosmosDB"], gcp: ["Firestore", "Cloud Firestore"] },
  { aws: ["Amazon RDS", "RDS"], azure: ["Azure SQL Database", "Azure SQL"], gcp: ["Cloud SQL"] },
  { aws: ["Amazon Redshift", "Redshift"], azure: ["Azure Synapse Analytics", "Azure Synapse"], gcp: ["BigQuery"] },
  { aws: ["Amazon SQS", "SQS"], azure: ["Azure Service Bus"], gcp: ["Google Cloud Pub/Sub", "Pub/Sub"] },
  { aws: ["Amazon Kinesis", "Kinesis"], azure: ["Azure Event Hubs", "Event Hubs", "Azure Event Hub"], gcp: [] },
  { aws: ["Amazon CloudWatch", "CloudWatch"], azure: ["Azure Monitor"], gcp: ["Google Cloud Monitoring", "Cloud Monitoring", "Cloud Logging", "Stackdriver"] },
  { aws: ["Amazon Bedrock", "AWS Bedrock"], azure: ["Azure OpenAI Service", "Azure OpenAI"], gcp: ["Vertex AI Gemini API"] },
  { aws: ["Amazon SageMaker", "SageMaker"], azure: ["Azure Machine Learning", "Azure ML"], gcp: ["Vertex AI", "Google Vertex AI"] },
  { aws: ["AWS CloudFormation", "CloudFormation"], azure: ["Azure Resource Manager", "ARM templates", "Bicep"], gcp: ["Google Cloud Deployment Manager", "Deployment Manager"] },
  { aws: ["AWS CodePipeline", "CodePipeline", "AWS CodeBuild", "CodeBuild"], azure: ["Azure DevOps Pipelines", "Azure Pipelines", "Azure DevOps"], gcp: ["Google Cloud Build", "Cloud Build"] },
  { aws: ["Amazon ECS", "ECS", "AWS Fargate", "Fargate"], azure: ["Azure Container Apps", "Azure Container Instances"], gcp: ["Google Cloud Run", "Cloud Run"] },
  { aws: ["Amazon EC2", "EC2"], azure: ["Azure Virtual Machines", "Azure VMs"], gcp: ["Google Compute Engine", "Compute Engine"] },
  { aws: ["AWS IAM"], azure: ["Microsoft Entra ID", "Entra ID", "Azure Active Directory", "Azure AD"], gcp: ["Cloud IAM"] },
  { aws: ["Amazon API Gateway"], azure: ["Azure API Management"], gcp: ["Apigee"] },
  { aws: ["Amazon ElastiCache", "ElastiCache"], azure: ["Azure Cache for Redis"], gcp: ["Memorystore"] },
  { aws: ["AWS Step Functions", "Step Functions"], azure: ["Azure Logic Apps", "Logic Apps", "Durable Functions"], gcp: ["Google Cloud Workflows", "Cloud Workflows"] },
  { aws: ["Amazon Web Services (AWS)", "Amazon Web Services", "AWS"], azure: ["Microsoft Azure", "Azure"], gcp: ["Google Cloud Platform (GCP)", "Google Cloud Platform", "Google Cloud", "GCP"] },
];

// Provider-only markers (detection, no swap target).
const PROVIDER_MARKERS = {
  aws: [/\bAWS\b/, /\bAmazon (?:EC2|S3|RDS|EKS|ECS|DynamoDB|Aurora|Redshift|Kinesis|SQS|SNS|Bedrock|SageMaker|CloudWatch)\b/, /\bSageMaker\b/, /\bDynamoDB\b/, /\bCloudFormation\b/],
  azure: [/\bAzure\b/, /\bAKS\b/, /\bCosmos ?DB\b/, /\bEntra ID\b/],
  gcp: [/\bGCP\b/, /\bGoogle Cloud\b/, /\bBigQuery\b/, /\bGKE\b/, /\bVertex AI\b/, /\bCloud Run\b/, /\bPub\/Sub\b/, /\bSpanner\b/],
};

// Employers publicly associated with one primary cloud. Conservative on purpose:
// multi-cloud or self-hosted companies are left out and fall back to the role's
// dominant provider.
const COMPANY_CLOUD = [
  { match: /\b(?:amazon|aws|amazon web services)\b/i, cloud: "aws" },
  { match: /\b(?:expedia|vrbo|homeaway|hotels\.com)\b/i, cloud: "aws" },
  { match: /\b(?:netflix|airbnb|capital one|lyft|pinterest|intuit|twitch|slack|moderna|zillow|robinhood|coinbase|peloton|epic games|nasdaq|atlassian)\b/i, cloud: "aws" },
  { match: /\b(?:microsoft|linkedin|github|nuance|openai)\b/i, cloud: "azure" },
  { match: /\b(?:walgreens|kroger|starbucks|chevron|exxonmobil|exxon mobil)\b/i, cloud: "azure" },
  { match: /\b(?:google|alphabet|youtube|deepmind|waymo)\b/i, cloud: "gcp" },
  { match: /\b(?:spotify|snap|snapchat|home depot|etsy|target corporation)\b/i, cloud: "gcp" },
];

function companyCloud(name) {
  if (!name) return null;
  const hit = COMPANY_CLOUD.find(e => e.match.test(String(name)));
  return hit ? hit.cloud : null;
}

let _aliasIndex = null;
function aliasIndex() {
  if (_aliasIndex) return _aliasIndex;
  const entries = [];
  CLOUD_EQUIVALENTS.forEach((row, rowIdx) => {
    for (const p of PROVIDERS) {
      row[p].forEach((alias, aliasIdx) => entries.push({ alias, provider: p, rowIdx, aliasIdx }));
    }
  });
  entries.sort((a, b) => b.alias.length - a.alias.length);
  _aliasIndex = entries.map(e => ({
    ...e,
    re: new RegExp(`(?<![\\w-])${escapeRe(e.alias)}(?![\\w-])`, "g"),
  }));
  return _aliasIndex;
}

function detectProviders(text) {
  const counts = { aws: 0, azure: 0, gcp: 0 };
  if (typeof text !== "string") return counts;
  for (const p of PROVIDERS) {
    for (const re of PROVIDER_MARKERS[p]) {
      const m = text.match(new RegExp(re.source, "g"));
      if (m) counts[p] += m.length;
    }
  }
  return counts;
}

const MIGRATION_RE = /\b(?:migrat\w*|multi[- ]cloud|hybrid[- ]cloud|cross[- ]cloud|from (?:AWS|Azure|GCP|Google Cloud)\b.*\bto\b)/i;

// Swap every other-provider service in `text` to `target`'s equivalent.
function swapCloud(text, target) {
  if (typeof text !== "string" || !text) return { text, changes: [] };
  const changes = [];
  // Mask matches as we go so a replacement is never re-matched.
  const tokens = [];
  let out = text;
  for (const e of aliasIndex()) {
    e.re.lastIndex = 0;
    out = out.replace(e.re, (match) => {
      let rep = match;
      if (e.provider !== target) {
        const row = CLOUD_EQUIVALENTS[e.rowIdx];
        const targets = row[target];
        if (targets.length) {
          // A short alias (AKS) maps to the target's short form (EKS).
          const shortest = (arr) => arr.reduce((a, b) => (b.length < a.length ? b : a));
          const isShort = !/\s/.test(match);
          rep = isShort ? shortest(targets) : targets[0];
          changes.push({ from: match, to: rep });
        }
      }
      tokens.push(rep);
      return `\u0000${tokens.length - 1}\u0000`;
    });
  }
  out = out.replace(/\u0000(\d+)\u0000/g, (m, i) => tokens[+i]);
  if (changes.length) out = cleanupText(out);
  return { text: out, changes };
}

// ── Main entry point ───────────────────────────────────────────────────────

function roleScopes(resumeData) {
  const scopes = [];
  for (const exp of resumeData.experience || []) {
    const clients = Array.isArray(exp.clients) ? exp.clients : [];
    scopes.push({ owner: exp, company: exp.company, start: exp.start_date, end: exp.end_date, key: "bullets" });
    for (const cl of clients) {
      scopes.push({ owner: cl, company: cl.client_name || exp.company, start: cl.start_date || exp.start_date, end: cl.end_date || exp.end_date, key: "bullets" });
    }
  }
  return scopes;
}

function fmtPeriod(start, end) {
  const s = start ? String(start) : "?";
  const e = end ? String(end) : "?";
  return `${s} – ${e}`;
}

function enforceConsistency(input, opts = {}) {
  if (!input || typeof input !== "object" || !Array.isArray(input.experience)) {
    return { resumeData: input, fixes: [] };
  }
  const now = opts.now || new Date();
  const resumeData = JSON.parse(JSON.stringify(input));
  const rules = eraRulesFor(opts.domain);
  const fixes = [];
  const seenFix = new Set();
  const addFix = (msg) => { if (!seenFix.has(msg)) { seenFix.add(msg); fixes.push(msg); } };

  const scopes = roleScopes(resumeData);

  // 1) Employer names in effect during the role.
  for (const exp of resumeData.experience) {
    const endYM = parseYM(exp.end_date, now);
    const rn = COMPANY_RENAMES.find(r => r.match.test(String(exp.company || "").trim()));
    if (!rn || endYM == null || endYM >= rn.since) continue;
    const old = exp.company;
    exp.company = rn.former;
    const wordRe = new RegExp(`\\b${escapeRe(rn.current)}\\b`, "g");
    exp.bullets = (exp.bullets || []).map(b => (typeof b === "string" ? b.replace(wordRe, rn.former) : b));
    for (const s of scopes) if (s.owner === exp) s.company = rn.former;
    addFix(`Renamed "${old}" to "${rn.former}": the role (${fmtPeriod(exp.start_date, exp.end_date)}) ended before the company became ${rn.current}.`);
  }

  // 2) Technology timeline, per role (by role END date).
  let latestEnd = null;
  for (const s of scopes) {
    const endYM = parseYM(s.end, now);
    if (endYM != null) latestEnd = latestEnd == null ? endYM : Math.max(latestEnd, endYM);
    const endYear = yearOf(endYM);
    const list = s.owner[s.key];
    if (!Array.isArray(list) || endYear == null) continue;
    s.owner[s.key] = list.map(b => {
      const { text, changes } = enforceEraOnText(b, endYear, rules);
      for (const ch of changes) {
        addFix(`${s.company} (${fmtPeriod(s.start, s.end)}): ${ch.to === "(removed)" ? `removed "${ch.from}"` : `replaced "${ch.from}" with "${ch.to}"`}; it was not in use until ${ch.earliest}.`);
      }
      return text;
    });
  }

  // 3) Cloud consistency, per role.
  const jdCloud = PROVIDERS.includes(String(resumeData.parsed_jd?.cloud_platform || "").toLowerCase())
    ? String(resumeData.parsed_jd.cloud_platform).toLowerCase() : null;
  const usedClouds = new Set();
  for (const s of scopes) {
    const list = s.owner[s.key];
    if (!Array.isArray(list)) continue;
    const known = companyCloud(s.company);
    const totals = { aws: 0, azure: 0, gcp: 0 };
    for (const b of list) {
      const c = detectProviders(b);
      for (const p of PROVIDERS) totals[p] += c[p];
    }
    const mentioned = PROVIDERS.filter(p => totals[p] > 0);
    let target = known;
    if (!target && mentioned.length > 1) {
      const max = Math.max(...mentioned.map(p => totals[p]));
      const top = mentioned.filter(p => totals[p] === max);
      target = top.includes(jdCloud) ? jdCloud : top[0];
    }
    if (!target) {
      if (mentioned.length === 1) usedClouds.add(mentioned[0]);
      continue;
    }
    usedClouds.add(target);
    if (mentioned.length === 0 || (mentioned.length === 1 && mentioned[0] === target)) continue;
    s.owner[s.key] = list.map(b => {
      if (typeof b !== "string") return b;
      // Unknown employers may legitimately describe a cloud migration.
      if (!known && MIGRATION_RE.test(b)) return b;
      const { text, changes } = swapCloud(b, target);
      for (const ch of changes) {
        const why = known ? `${s.company} is known for running on ${PROVIDER_LABEL[target]}` : `the rest of this role uses ${PROVIDER_LABEL[target]}`;
        addFix(`${s.company}: changed "${ch.from}" to "${ch.to}" (${why}).`);
      }
      return text;
    });
  }

  // 4) Career-wide sections: summary and skills.
  const latestYear = yearOf(latestEnd);
  if (typeof resumeData.professional_summary === "string") {
    const { text, changes } = enforceEraOnText(resumeData.professional_summary, latestYear, rules);
    resumeData.professional_summary = text;
    for (const ch of changes) addFix(`Summary: replaced "${ch.from}"; no role on this resume runs past ${ch.earliest - 1}.`);
  }
  // Only prune skills when the experience section establishes which clouds were used.
  const allowedClouds = usedClouds;
  if (resumeData.technical_skills && typeof resumeData.technical_skills === "object") {
    for (const [cat, val] of Object.entries(resumeData.technical_skills)) {
      let { text, changes } = enforceEraOnList(val, latestYear, rules);
      for (const ch of changes) addFix(`Skills: removed "${ch.from}"; no role on this resume runs past ${ch.earliest - 1}.`);
      if (allowedClouds.size && typeof text === "string") {
        const kept = [];
        for (const item of text.split(",").map(x => x.trim()).filter(Boolean)) {
          const c = detectProviders(item);
          const provs = PROVIDERS.filter(p => c[p] > 0);
          if (provs.length && !provs.some(p => allowedClouds.has(p))) {
            addFix(`Skills: removed "${item}"; no role on this resume uses ${provs.map(p => PROVIDER_LABEL[p]).join("/")}.`);
            continue;
          }
          kept.push(item);
        }
        text = kept.join(", ");
      }
      resumeData.technical_skills[cat] = text;
    }
  }
  if (allowedClouds.size === 1 && typeof resumeData.professional_summary === "string") {
    const target = [...allowedClouds][0];
    const { text, changes } = swapCloud(resumeData.professional_summary, target);
    resumeData.professional_summary = text;
    for (const ch of changes) addFix(`Summary: changed "${ch.from}" to "${ch.to}" to match the cloud used in the experience section.`);
  }

  return { resumeData, fixes };
}

// Remaining problems after enforcement (should normally be empty).
function findConsistencyIssues(resumeData, domain, now = new Date()) {
  const issues = [];
  if (!resumeData || !Array.isArray(resumeData.experience)) return issues;
  const rules = eraRulesFor(domain);
  for (const exp of resumeData.experience) {
    const rn = COMPANY_RENAMES.find(r => r.match.test(String(exp.company || "").trim()));
    const endYM = parseYM(exp.end_date, now);
    if (rn && endYM != null && endYM < rn.since) issues.push(`${exp.company} (role ended ${exp.end_date}) was still called ${rn.former} at the time`);
  }
  for (const s of roleScopes(resumeData)) {
    const endYear = yearOf(parseYM(s.end, now));
    if (endYear == null) continue;
    for (const b of s.owner[s.key] || []) {
      if (typeof b !== "string") continue;
      for (const rule of rules) {
        if (endYear >= rule.earliest) continue;
        if (rule.regexes.some(re => { re.lastIndex = 0; return re.test(b); })) {
          const hit = rule.regexes.map(re => { re.lastIndex = 0; const m = b.match(new RegExp(re.source, re.flags.replace("g", ""))); return m && m[0]; }).find(Boolean) || rule.term;
          issues.push(`"${hit.trim()}" appears at ${s.company} (role ended ${s.end}) but was not in use until ${rule.earliest}`);
        }
      }
    }
    const known = companyCloud(s.company);
    for (const b of s.owner[s.key] || []) {
      const c = detectProviders(b);
      const provs = PROVIDERS.filter(p => c[p] > 0);
      if (known && provs.some(p => p !== known)) {
        issues.push(`${s.company} is known for ${PROVIDER_LABEL[known]} but a bullet mentions ${provs.filter(p => p !== known).map(p => PROVIDER_LABEL[p]).join("/")}`);
      } else if (provs.length > 1 && !MIGRATION_RE.test(b)) {
        issues.push(`${s.company}: one bullet mixes ${provs.map(p => PROVIDER_LABEL[p]).join(" and ")}`);
      }
    }
  }
  return [...new Set(issues)];
}

module.exports = {
  enforceConsistency,
  findConsistencyIssues,
  parseYM,
  companyCloud,
  // exported for tests
  _internal: { eraRulesFor, enforceEraOnText, swapCloud, cleanupText, ERA_RULES, COMPANY_CLOUD, CLOUD_EQUIVALENTS },
};
