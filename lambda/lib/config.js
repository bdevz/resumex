// ============================================================================
// config.js — All hardcoded rules for the resume generator
// Based on: Top 10 school templates, Google XYZ formula, ATS rules,
//           FAANG recruiter insights, industry classification
// ============================================================================

// --- API Configuration ---
// Uses Anthropic Messages API directly.
//
// Environment variables:
//   ANTHROPIC_API_KEY   — Your Anthropic API key (sk-ant-...)
//   SHARED_PASSPHRASE   — Passphrase shared with team

const API = {
  // Default model
  default_model: "claude-opus-4-6",

  // Available Anthropic models
  models: {
    "claude-opus":       "claude-opus-4-20250514",
    "claude-sonnet":     "claude-sonnet-4-20250514",
    "claude-haiku":      "claude-haiku-4-5-20251001",
  },
};

const CONTACT = {
  name: "Firstname Lastname",
  phone: "(555) 123-4567",
  email: "firstname.lastname@email.com",
  linkedin: "linkedin.com/in/firstnamelastname",
  github: "github.com/firstnamelastname",
};

// --- Education defaults ---
const EDUCATION = {
  masters: {
    degree: "Master of Science in Computer Science",
    school: "University of Texas at Arlington",
    location: "Arlington, TX",
    graduated: "May 2019",
  },
  bachelors: {
    degree: "Bachelor of Technology in Computer Science and Engineering",
    school: "Vellore Institute of Technology",
    location: "Vellore, India",
    graduated: "May 2017",
  },
};

// --- IT services firms (pick randomly or let LLM choose) ---
const IT_SERVICES_FIRMS = [
  "Cognizant Technology Solutions",
  "Tata Consultancy Services",
  "Infosys",
  "Wipro",
  "Accenture",
  "HCL Technologies",
  "Tech Mahindra",
];

// --- Timeline defaults for 6-7 year profile ---
// Working backward from current date (Feb 2026)
const TIMELINE = {
  total_years: { min: 6, max: 7 },
  career_start: "Jul 2019", // post-Masters graduation
  roles: {
    current: { min_months: 18, max_months: 28 },
    previous: { min_months: 18, max_months: 28 },
    it_services_total: { min_months: 24, max_months: 36 },
    it_services_client: { min_months: 12, max_months: 20 },
  },
  companies: { min: 3, max: 4 },
};

// --- Formatting constants (ATS-compliant, school-endorsed) ---
const FORMAT = {
  page: {
    width: 12240,      // US Letter 8.5" in DXA
    height: 15840,     // US Letter 11" in DXA
    margins: {
      top: 720,        // 0.5 inch
      bottom: 720,
      left: 1080,      // 0.75 inch
      right: 1080,
    },
  },
  fonts: {
    name: { face: "Calibri", size: 26 },         // 13pt
    contact: { face: "Calibri", size: 20 },       // 10pt
    section_heading: { face: "Calibri", size: 22 }, // 11pt bold
    company: { face: "Calibri", size: 21 },       // 10.5pt bold
    title: { face: "Calibri", size: 21 },         // 10.5pt italic
    body: { face: "Calibri", size: 20 },          // 10pt
    education: { face: "Calibri", size: 20 },     // 10pt
    skills_category: { face: "Calibri", size: 20 }, // 10pt bold
    skills_items: { face: "Calibri", size: 20 },    // 10pt
  },
  // Section ordering for mid-level (3-7yr)
  section_order: [
    "contact",
    "summary",
    "skills",
    "experience",
    "education",
    "certifications",
  ],
  bullets_per_role: { min: 6, max: 8 },
  max_pages: 2,
  // Right tab stop position for date alignment (content width)
  right_tab: 10080, // 12240 - 1080 - 1080 = 10080 DXA
};

// --- XL mode formatting (keyword-heavy, 3-page resume) ---
const FORMAT_XL = {
  page: {
    margins: {
      top: 576,       // 0.4 inch
      bottom: 576,
      left: 720,      // 0.5 inch
      right: 720,
    },
  },
  bullets_per_role: { min: 10, max: 15 },
  max_pages: 3,
};

// --- ATS section headers (recognized by all major ATS) ---
const ATS_HEADERS = {
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  certifications: "Certifications",
  projects: "Projects",
};

// --- Google XYZ bullet patterns ---
const XYZ_PATTERNS = [
  "[Verb] [what] by [metric] by [how]",
  "[Verb] [what], resulting in [metric]",
  "[Verb] [what] using [technology], achieving [metric]",
  "Led [scope] to [verb] [what], resulting in [metric]",
  // Business-value variants
  "[Verb] [what] serving [scale], achieving [business outcome]",
  "[Verb] [scope initiative], partnering with [stakeholders] to deliver [result]",
  "[Verb] [what] achieving [compliance/SLA], resulting in [business impact]",
];

// --- Action verbs by category ---
const ACTION_VERBS = {
  technical: [
    "Architected", "Built", "Designed", "Developed", "Engineered",
    "Implemented", "Deployed", "Automated", "Migrated", "Integrated",
    "Refactored", "Optimized", "Scaled", "Configured", "Containerized",
    "Created", "Executed", "Launched", "Modernized", "Consolidated",
  ],
  leadership: [
    "Led", "Drove", "Established", "Directed", "Managed", "Oversaw",
    "Transformed", "Delivered", "Owned",
  ],
  impact: [
    "Achieved", "Secured", "Enabled", "Accelerated", "Improved",
    "Increased", "Decreased", "Reduced", "Saved", "Enforced",
  ],
  communication: [
    "Presented", "Authored", "Facilitated", "Documented", "Translated",
    "Negotiated", "Articulated",
  ],
  problem_solving: [
    "Diagnosed", "Resolved", "Debugged", "Investigated", "Optimized",
    "Refactored", "Streamlined", "Eliminated", "Reduced",
  ],
  mentoring: [
    "Mentored", "Coached", "Trained", "Guided", "Onboarded", "Cultivated",
  ],
  collaboration: [
    "Partnered", "Coordinated", "Aligned", "Integrated",
  ],
};

// Verbs that should NOT count as "strong" (community consensus: passive, vague, or fluffy)
const WEAK_VERBS = [
  "aided", "assisted", "coded", "collaborated", "communicated", "exposed",
  "helped", "participated", "programmed", "ran", "used", "utilized",
  "worked", "maintained", "supported", "completed", "handled", "performed",
  "wrote", "served", "stood", "contributed",
];

// --- Bullet quality scoring ---
const QUALITY_SCORING = {
  rules: [
    // Technical metrics
    { pattern: /\d+%/, points: 2, label: "percentage improvement" },
    { pattern: /\$[\d,]+[KkMmBb]?/, points: 2, label: "dollar amount" },
    { pattern: /from\s+\d.*to\s+\d/i, points: 2, label: "baseline comparison" },
    { pattern: /team of \d+|(\d+)\s*(engineers?|developers?|members?)/i, points: 1, label: "team size" },
    { pattern: /\b(?:Java|Python|Go|Rust|SQL|JavaScript|TypeScript|C\+\+|Ruby|Scala|Kotlin|Swift|PHP|Bash|Shell|Apex|SOQL|SOSL|HTML|CSS|XML|JSON|C#|R|Perl|Dart|Lua)\b/i, points: 1, label: "programming language" },
    { pattern: /\b(?:AWS|Azure|GCP|Docker|Kubernetes|Kafka|Redis|Spring|React|Angular|Vue|Node\.?js|Next\.?js|Terraform|Jenkins|PostgreSQL|MySQL|MongoDB|DynamoDB|Cassandra|Lambda|S3|EC2|ECS|EKS|SQS|SNS|CloudFormation|CloudWatch|Redshift|ElastiCache|Datadog|Splunk|GraphQL|REST|gRPC|RabbitMQ|Elasticsearch|Nginx|GitHub Actions|CircleCI|ArgoCD|Helm|Prometheus|Grafana|HikariCP|Hibernate|JUnit|Mockito|FastAPI|Django|Flask|Express|Salesforce|Lightning|LWC|Visualforce|Copado|MuleSoft|Informatica|ServiceNow|SAP|Jira|Confluence|SFDX|Heroku|Aura|Data Loader|Postman|SonarQube|Snowflake|Databricks|Tableau|Power BI|Looker|Airflow|dbt|Fivetran|Segment|Twilio|Stripe|Okta|Auth0|Vercel|Netlify|Firebase|Supabase)\b/i, points: 1, label: "technology name" },
    // Business value (capped at business_group_cap total)
    { pattern: /\b\d[\d,.]*[KkMmBb]?\+?\s*(?:\w+\s+)?(?:users?|customers?|residents?|clients?|employees?|patients?|subscribers?|accounts?|merchants?|transactions?|requests?|members?|records?|orders?|vehicles?|devices?|endpoints?|applications?|services?|departments?|stores?|locations?|regions?|citizens?|constituents?|beneficiaries?|agencies?|organizations?|tenants?|partners?|vendors?|sites?|markets?|countries?|teams?|projects?)\b/i, points: 2, label: "scale/reach metric", group: "business" },
    { pattern: /\b(?:compliance|regulatory|SOC\s*2|FedRAMP|HIPAA|PCI[\s-]?DSS|GDPR|SOX|ISO\s*27001|CCPA|CJIS|FISMA|NIST|ADA)\b/i, points: 1, label: "compliance/regulatory", group: "business" },
    { pattern: /\b(?:stakeholder|executive|C-suite|CTO|CFO|CEO|CIO|CISO|VP|director|cross[\s-]?functional|cross[\s-]?team)\b/i, points: 1, label: "stakeholder engagement", group: "business" },
    { pattern: /\b(?:revenue|adoption|retention|satisfaction|NPS|CSAT|SLA|uptime|availability|reliability|churn|conversion|engagement)\b/i, points: 1, label: "business outcome", group: "business" },
    { pattern: /\b(?:enterprise[\s-]?wide|org[\s-]?wide|company[\s-]?wide|global|nationwide|organization[\s-]?wide)\b/i, points: 1, label: "strategic scope", group: "business" },
  ],
  business_group_cap: 3,
  verb_check_points: 1,
  no_metric_penalty: 0,
  over_200_chars_penalty: -1,
  thresholds: {
    excellent: 7,
    good: 5,
    needs_improvement: 3,
  },
};

// --- Competitor maps by industry ---
const COMPETITOR_MAPS = {
  "e-commerce": ["Amazon", "Walmart", "Shopify", "Target", "eBay", "Etsy", "Wayfair", "Chewy", "MercadoLibre", "Best Buy"],
  "retail": ["Walmart", "Target", "Costco", "Amazon", "Kroger", "Home Depot", "Lowe's", "Macy's"],
  "networking": ["Cisco", "Juniper Networks", "Arista Networks", "Palo Alto Networks", "Fortinet", "F5 Networks", "HPE Aruba"],
  "pharma": ["Johnson & Johnson", "Merck", "Pfizer", "Bristol-Myers Squibb", "AbbVie", "Eli Lilly", "Roche", "Novartis", "AstraZeneca", "Amgen"],
  "cloud": ["Amazon Web Services", "Microsoft Azure", "Google Cloud Platform", "Oracle Cloud", "Salesforce", "ServiceNow", "Workday", "Snowflake", "Datadog"],
  "fintech": ["Stripe", "Block", "PayPal", "Adyen", "Plaid", "Affirm", "Chime", "Robinhood", "Fidelity", "Goldman Sachs"],
  "banking": ["JPMorgan Chase", "Goldman Sachs", "Morgan Stanley", "Bank of America", "Citigroup", "Wells Fargo", "Capital One", "US Bank"],
  "social": ["Meta", "Snap", "TikTok", "Pinterest", "X", "Reddit", "Discord", "LinkedIn"],
  "enterprise-software": ["SAP", "Oracle", "Microsoft", "ServiceNow", "Splunk", "Palantir", "Workday", "Salesforce"],
  "semiconductors": ["Intel", "AMD", "NVIDIA", "Qualcomm", "TSMC", "Samsung", "Micron", "Broadcom", "Texas Instruments"],
  "automotive": ["Tesla", "Rivian", "Waymo", "Mobileye", "Cruise", "Aptiv", "Zoox", "Ford", "GM"],
  "gaming": ["EA", "Activision Blizzard", "Ubisoft", "Take-Two", "Epic Games", "Roblox", "Unity", "Valve"],
  "healthcare": ["UnitedHealth Group", "CVS Health", "Cigna", "Humana", "Anthem", "Epic Systems", "Cerner"],
  "insurance": ["Progressive", "Allstate", "State Farm", "Geico", "Liberty Mutual", "MetLife", "Prudential"],
  "telecom": ["AT&T", "Verizon", "T-Mobile", "Comcast", "Charter", "Lumen Technologies"],
  "media": ["Netflix", "Disney", "Warner Bros Discovery", "Paramount", "NBCUniversal", "Spotify", "YouTube"],
  "logistics": ["FedEx", "UPS", "DHL", "Amazon Logistics", "XPO Logistics", "Flexport", "C.H. Robinson"],
  "travel": ["Booking Holdings", "Expedia", "Airbnb", "Tripadvisor", "Sabre", "Amadeus", "Travelport"],
  "food-delivery": ["DoorDash", "Uber Eats", "Grubhub", "Instacart", "Gopuff"],
  "cybersecurity": ["CrowdStrike", "Palo Alto Networks", "Fortinet", "Zscaler", "SentinelOne", "Okta", "Splunk"],
};

// --- Cloud platform ecosystems (to enforce consistency) ---
const CLOUD_ECOSYSTEMS = {
  aws: {
    label: "Amazon Web Services (AWS)",
    services: ["EC2", "S3", "Lambda", "RDS", "DynamoDB", "CloudFormation", "ECS", "EKS", "SQS", "SNS", "CloudWatch", "IAM", "API Gateway", "Step Functions", "Kinesis", "Redshift", "Aurora", "ElastiCache"],
    ci_cd: ["AWS CodePipeline", "AWS CodeBuild", "AWS CodeDeploy"],
    container: ["Amazon ECS", "Amazon EKS"],
    db: ["Amazon RDS", "Amazon DynamoDB", "Amazon Aurora", "Amazon Redshift", "Amazon ElastiCache"],
  },
  azure: {
    label: "Microsoft Azure",
    services: ["Azure App Service", "Azure Functions", "Azure SQL", "Cosmos DB", "Azure Blob Storage", "AKS", "Azure DevOps", "Azure Event Hub", "Azure Service Bus", "Azure Monitor", "Azure AD", "Azure API Management"],
    ci_cd: ["Azure DevOps Pipelines", "Azure Repos"],
    container: ["Azure Kubernetes Service (AKS)", "Azure Container Instances"],
    db: ["Azure SQL Database", "Cosmos DB", "Azure Cache for Redis"],
  },
  gcp: {
    label: "Google Cloud Platform (GCP)",
    services: ["Cloud Run", "Cloud Functions", "BigQuery", "Cloud Storage", "GKE", "Pub/Sub", "Cloud SQL", "Firestore", "Cloud Spanner", "Cloud Logging", "Cloud IAM"],
    ci_cd: ["Cloud Build", "Cloud Deploy"],
    container: ["Google Kubernetes Engine (GKE)", "Cloud Run"],
    db: ["Cloud SQL", "BigQuery", "Firestore", "Cloud Spanner"],
  },
};

// --- Technology timeline validation ---
// Prevents anachronisms like "10 years of GenAI"
const TECH_TIMELINE = {
  "generative ai": { earliest: 2022 },
  "chatgpt": { earliest: 2022 },
  "openai api": { earliest: 2020 },
  "langchain": { earliest: 2022 },
  "llm": { earliest: 2022 },
  "rag": { earliest: 2023 },
  "vector database": { earliest: 2022 },
  "github copilot": { earliest: 2021 },
  "terraform": { earliest: 2015 },
  "kubernetes": { earliest: 2015 },
  "docker": { earliest: 2014 },
  "react": { earliest: 2013 },
  "next.js": { earliest: 2016 },
  "vue.js": { earliest: 2014 },
  "svelte": { earliest: 2019 },
  "go": { earliest: 2012 },
  "rust": { earliest: 2015 },
  "graphql": { earliest: 2015 },
  "deno": { earliest: 2020 },
  "bun": { earliest: 2022 },
  "aws lambda": { earliest: 2014 },
  "azure functions": { earliest: 2016 },
  "snowflake": { earliest: 2015 },
  "databricks": { earliest: 2015 },
  "apache kafka": { earliest: 2011 },
  "apache spark": { earliest: 2014 },
  "spring boot": { earliest: 2014 },
  "microservices": { earliest: 2012 },
};

// --- Skill categories for the Technical Skills section ---
const SKILL_CATEGORIES = [
  "Languages",
  "Frameworks & Libraries",
  "Cloud & DevOps",
  "Databases",
  "Tools & Practices",
];

// --- Soft skill frequency rules ---
const SOFT_SKILL_RULES = {
  min_leadership_per_role: 1,
  min_communication_per_two_roles: 1,
  min_mentoring_per_senior_role: 1,
};

// --- Anti-AI-slop writing rules (config-driven, injected into all prompts) ---
const ANTI_SLOP = {
  banned_words: [
    { word: "delve", severity: "hard" },
    { word: "pivotal", severity: "hard" },
    { word: "underscore", severity: "hard" },
    { word: "landscape", severity: "hard" },
    { word: "foster", severity: "hard" },
    { word: "testament", severity: "hard" },
    { word: "leverage", severity: "hard" },
    { word: "spearhead", severity: "hard" },
    { word: "harness", severity: "hard" },
    { word: "elevate", severity: "hard" },
    { word: "bolster", severity: "hard" },
    { word: "utilize", severity: "hard" },
    { word: "tapestry", severity: "hard" },
    { word: "intricate", severity: "hard" },
    { word: "groundbreaking", severity: "hard" },
    { word: "transformative", severity: "hard" },
    { word: "innovative", severity: "hard" },
    { word: "revolutionize", severity: "hard" },
    { word: "synergy", severity: "hard" },
    { word: "paradigm", severity: "hard" },
    { word: "robust", severity: "soft" },
    { word: "seamless", severity: "soft" },
    { word: "comprehensive", severity: "soft" },
    { word: "cutting-edge", severity: "soft" },
    { word: "world-class", severity: "soft" },
    { word: "best-in-class", severity: "soft" },
    { word: "holistic", severity: "soft" },
  ],

  banned_phrases: [
    { phrase: "not just X, but Y", severity: "hard" },
    { phrase: "plays a vital role", severity: "hard" },
    { phrase: "stands as a testament", severity: "hard" },
    { phrase: "it's important to note", severity: "hard" },
    { phrase: "from X to Y (rhetorical, not metric)", severity: "hard" },
    { phrase: "driving innovation", severity: "hard" },
    { phrase: "ensuring seamless", severity: "hard" },
    { phrase: "state-of-the-art", severity: "hard" },
    { phrase: "in today's fast-paced", severity: "hard" },
    { phrase: "at the forefront of", severity: "hard" },
    { phrase: "end-to-end", severity: "soft" },
    { phrase: "above and beyond", severity: "soft" },
    { phrase: "key stakeholders", severity: "soft" },
  ],

  structural_patterns: [
    {
      name: "adjective_triplet",
      description: "Three adjectives in a row separated by commas",
      example_bad: "Built a scalable, resilient, and performant API gateway",
      example_good: "Built an API gateway that handled 50K concurrent connections without falling over",
      severity: "hard",
    },
    {
      name: "trailing_ing_clause",
      description: "Dangling -ing clause tacked onto the end that adds no specifics",
      example_bad: "Migrated 12 services to Kubernetes, ensuring high availability and compliance",
      example_good: "Migrated 12 services to Kubernetes — two of them had zero-downtime requirements that forced us to run blue-green deploys for 3 weeks",
      severity: "hard",
    },
    {
      name: "em_dash_overuse",
      description: "More than one em dash in a single bullet",
      example_bad: "Designed a caching layer — Redis-based — that reduced latency — improving UX significantly",
      example_good: "Designed a Redis caching layer that cut API response times from 1.2s to 180ms",
      severity: "soft",
    },
    {
      name: "every_bullet_has_metric",
      description: "When every single bullet in a role has a percentage, dollar amount, or numeric comparison — this is the #1 sign of an AI resume",
      example_bad: "Reduced X by 72%... improved Y by 340%... saving $420K... from 1.2s to 180ms...",
      example_good: "4 out of 6 bullets have metrics. The rest describe what was built and why it mattered.",
      severity: "hard",
    },
    {
      name: "metric_stacking",
      description: "Cramming multiple unrelated metrics into one bullet",
      example_bad: "Reduced latency by 40%, increased throughput by 200%, saving $1.2M annually while improving NPS by 15 points",
      example_good: "Reduced API latency by 40% by adding a Redis read-through cache in front of the payments table",
      severity: "hard",
    },
  ],

  examples: [
    {
      bad: "Spearheaded a transformative cloud migration initiative leveraging Kubernetes and Terraform, resulting in a 60% reduction in infrastructure costs",
      good: "Moved 14 services from EC2 to EKS over 4 months — the hardest part was untangling the shared RDS instance that three teams depended on",
      why: "The bad version uses 'spearheaded', 'transformative', 'leveraging', 'initiative' — four AI tells in one sentence. The good version sounds like someone who actually did the work.",
    },
    {
      bad: "Drove innovation by implementing a robust microservices architecture, ensuring seamless scalability and enhanced system reliability",
      good: "Broke a Rails monolith into 6 services so deploys stopped taking down the whole app every Thursday",
      why: "The bad version is all buzzwords. The good version has a specific pain point (Thursday deploys) that no AI would invent.",
    },
    {
      bad: "Leveraged cutting-edge machine learning algorithms to optimize customer engagement metrics, achieving a 45% improvement in retention rates",
      good: "Built a churn prediction model using XGBoost that flagged at-risk accounts 2 weeks before they cancelled — the CS team used it to save about 30% of them",
      why: "Specificity beats superlatives. Name the model, name the team, describe the workflow.",
    },
  ],

  tone: `Write like a tired engineer updating their resume at 11pm, not like a marketing copywriter.
Be specific and plain. If something was hard, say it was hard. If the scope was small, don't inflate it.
A human resume has personality — it mentions the annoying migration, the team that was skeptical, the workaround that became permanent.
Never make every bullet sound triumphant. Real work is messy.`,

  max_metric_ratio: {
    standard:      { max: 4, per: "6-8",   description: "At most 4 of 6-8 bullets per role should have hard metrics" },
    xl:            { max: 5, per: "10-15",  description: "At most 5 of 10-15 bullets per role should have hard metrics" },
    optimize:      { max: 4, per: "6-8",    description: "At most 4 of 6-8 bullets per role should have hard metrics" },
    "optimize-xl": { max: 7, per: "10-15",  description: "At most 5-7 of 10-15 bullets per role should have hard metrics" },
  },
};

module.exports = {
  API,
  CONTACT,
  EDUCATION,
  IT_SERVICES_FIRMS,
  TIMELINE,
  FORMAT,
  FORMAT_XL,
  ATS_HEADERS,
  XYZ_PATTERNS,
  ACTION_VERBS,
  WEAK_VERBS,
  QUALITY_SCORING,
  COMPETITOR_MAPS,
  CLOUD_ECOSYSTEMS,
  TECH_TIMELINE,
  SKILL_CATEGORIES,
  SOFT_SKILL_RULES,
  ANTI_SLOP,
};