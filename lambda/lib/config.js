// ============================================================================
// config.js — All hardcoded rules for the resume generator
// Based on: Top 10 school templates, Google XYZ formula, ATS rules,
//           FAANG recruiter insights, industry classification
// ============================================================================

// --- API Configuration ---
// Three modes:
//   1. "proxy"      — Coworkers use this. Hits your Vercel URL with a passphrase. No API key needed.
//   2. "openrouter"  — Direct OpenRouter call. User has their own OpenRouter key.
//   3. "anthropic"   — Direct Anthropic call. User has their own Anthropic key (legacy).
//
// Environment variables:
//   MODE=proxy          PROXY_URL=https://your-app.vercel.app  TEAM_PASSPHRASE=team-resume-2026
//   MODE=openrouter     OPENROUTER_API_KEY=sk-or-...           MODEL=anthropic/claude-sonnet-4-20250514
//   MODE=anthropic      ANTHROPIC_API_KEY=sk-ant-...

const API = {
  // Default model — change this when new models drop
  default_model: "google/gemini-3-pro-preview",

  // All available models on OpenRouter (update this list as new models release)
  // Format: "provider/model-name" — this is how OpenRouter identifies models
  models: {
    // Anthropic
    "claude-sonnet":     "anthropic/claude-sonnet-4.5",
    "claude-haiku":      "anthropic/claude-sonnet-4.5",
    "claude-opus":       "anthropic/claude-opus-4.5",
    // OpenAI
    "gpt-4o":            "openai/gpt-4o",
    "gpt-4o-mini":       "openai/gpt-4o-mini",
    "gpt-4.1":           "openai/gpt-4.1",
    "gpt-4.1-mini":      "openai/gpt-4.1-mini",
    "o3-mini":           "openai/o3-mini",
    // Google
    "gemini-3-pro":      "google/gemini-3-pro-preview",
    "gemini-2.5-pro":    "google/gemini-2.5-pro",
    "gemini-2-flash":    "google/gemini-2.0-flash-001",
    // DeepSeek
    "deepseek-v3":       "deepseek/deepseek-chat",
    "deepseek-r1":       "deepseek/deepseek-reasoner",
    // Meta
    "llama-3.3-70b":     "meta-llama/llama-3.3-70b-instruct",
    // Mistral
    "mistral-large":     "mistralai/mistral-large-2411",
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
    start: "Aug 2017",
    end: "May 2019",
  },
  bachelors: {
    degree: "Bachelor of Technology in Computer Science and Engineering",
    school: "Vellore Institute of Technology",
    location: "Vellore, India",
    start: "Jul 2013",
    end: "May 2017",
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
  summary: "PROFESSIONAL SUMMARY",
  skills: "TECHNICAL SKILLS",
  experience: "PROFESSIONAL EXPERIENCE",
  education: "EDUCATION",
  certifications: "CERTIFICATIONS",
  projects: "PROJECTS",
};

// --- Google XYZ bullet patterns ---
const XYZ_PATTERNS = [
  "[Verb] [what] by [metric] by [how]",
  "[Verb] [what], resulting in [metric]",
  "[Verb] [what] using [technology], achieving [metric]",
  "Led [scope] to [verb] [what], resulting in [metric]",
];

// --- Action verbs by category ---
const ACTION_VERBS = {
  technical: [
    "Architected", "Built", "Designed", "Developed", "Engineered",
    "Implemented", "Deployed", "Automated", "Migrated", "Integrated",
    "Refactored", "Optimized", "Scaled", "Configured", "Containerized",
  ],
  leadership: [
    "Led", "Spearheaded", "Drove", "Championed", "Orchestrated",
    "Pioneered", "Established", "Directed",
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
    "Collaborated", "Partnered", "Coordinated", "Aligned", "Integrated",
  ],
};

// --- Bullet quality scoring ---
const QUALITY_SCORING = {
  rules: [
    { pattern: /\d+%/, points: 2, label: "percentage improvement" },
    { pattern: /\$[\d,]+[KkMmBb]?/, points: 2, label: "dollar amount" },
    { pattern: /from\s+\d.*to\s+\d/i, points: 2, label: "baseline comparison" },
    { pattern: /team of \d+|(\d+)\s*(engineers?|developers?|members?)/i, points: 1, label: "team size" },
    { pattern: /\b(?:Java|Python|Go|Rust|SQL|JavaScript|TypeScript|C\+\+|Ruby|Scala|Kotlin|Swift|PHP|Bash|Shell)\b/i, points: 1, label: "programming language" },
    { pattern: /\b(?:AWS|Azure|GCP|Docker|Kubernetes|Kafka|Redis|Spring|React|Angular|Vue|Node\.?js|Next\.?js|Terraform|Jenkins|PostgreSQL|MySQL|MongoDB|DynamoDB|Cassandra|Lambda|S3|EC2|ECS|EKS|SQS|SNS|CloudFormation|CloudWatch|Redshift|ElastiCache|Datadog|Splunk|GraphQL|REST|gRPC|RabbitMQ|Elasticsearch|Nginx|GitHub Actions|CircleCI|ArgoCD|Helm|Prometheus|Grafana|HikariCP|Hibernate|JUnit|Mockito|FastAPI|Django|Flask|Express)\b/i, points: 1, label: "technology name" },
  ],
  verb_check_points: 1,
  no_metric_penalty: -2,
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
  QUALITY_SCORING,
  COMPETITOR_MAPS,
  CLOUD_ECOSYSTEMS,
  TECH_TIMELINE,
  SKILL_CATEGORIES,
  SOFT_SKILL_RULES,
};