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

// --- Extended mode formatting (3-4 page, design-forward resume) ---
const FORMAT_EXTENDED = {
  page: {
    margins: {
      top: 540,       // 0.375 inch
      bottom: 540,
      left: 720,      // 0.5 inch
      right: 720,
    },
  },
  bullets_per_role: { min: 14, max: 20 },
  max_pages: 4,
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

  // --- Anti-slop penalties (deducted from bullet score) ---
  slop_penalties: [
    // Banned words from ANTI_SLOP config (hard severity)
    { pattern: /\b(?:delve|pivotal|underscore|landscape|foster|testament|leverage[ds]?|leveraging|spearhead(?:ed|ing)?|harness(?:ed|ing)?|elevat(?:e[ds]?|ing)|bolster(?:ed|ing)?|utiliz(?:e[ds]?|ing)|tapestry|intricate|groundbreaking|transformative|innovative|revolutioniz(?:e[ds]?|ing)|synergy|paradigm)\b/i, points: -3, label: "AI buzzword (hard ban)" },
    // Banned words (soft severity)
    { pattern: /\b(?:robust|seamless|comprehensive|cutting[\s-]?edge|world[\s-]?class|best[\s-]?in[\s-]?class|holistic)\b/i, points: -1, label: "AI buzzword (soft ban)" },
    // Trailing -ing clause: bullet ends with ", [verb]ing ..."
    { pattern: /,\s+(?:enabling|ensuring|improving|reducing|establishing|standardizing|accelerating|driving|achieving|enhancing|facilitating|streamlining|optimizing|maximizing|empowering|fostering)\b.*$/i, points: -2, label: "trailing -ing clause" },
    // Adjective triplet: "scalable, resilient, and performant"
    { pattern: /\w+,\s+\w+,\s+and\s+\w+\s+(?:system|platform|architecture|solution|framework|infrastructure|pipeline|service)/i, points: -2, label: "adjective triplet" },
    // Metric stacking: 3+ numbers in one bullet
    { pattern: /\d.*\d.*\d.*\d/i, points: -1, label: "metric stacking (4+ numbers)" },
    // Generic filler phrases
    { pattern: /\b(?:proven track record|deep expertise|track record of|passionate about|with a strong focus on|known for)\b/i, points: -2, label: "generic filler phrase" },
  ],

  // --- Authenticity bonuses (rewarded for human signals) ---
  authenticity_bonuses: [
    // Specific pain point or story detail (casual/human phrasing)
    { pattern: /\b(?:the (?:tricky|hard|annoying|painful|messy) part|kept breaking|silently fail|stopped? (?:working|crashing)|workaround|hack that|still use[ds]?|ended up)\b/i, points: 2, label: "specific pain point (human voice)" },
    // Mentions a specific team or person by role
    { pattern: /\b(?:the \w+ team|on-call|oncall|our team|my team|the team)\b/i, points: 1, label: "team context (human voice)" },
    // Short, punchy bullet (under 120 chars) with substance
    { pattern: /^.{40,120}$/i, points: 1, label: "concise bullet" },
  ],

  // --- Role-level penalties (applied in scoreResume, not scoreBullet) ---
  role_level_penalties: {
    // If every bullet in a role has a number, penalize each bullet by this amount
    all_metrics_penalty_per_bullet: -1,
    all_metrics_label: "every bullet has a metric (AI pattern)",
  },

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
    // Found in baseline tests — summary clichés
    { phrase: "proven track record", severity: "hard" },
    { phrase: "deep expertise", severity: "hard" },
    { phrase: "track record of", severity: "hard" },
    { phrase: "known for", severity: "hard" },
    { phrase: "at scale", severity: "soft" },
    { phrase: "end-to-end", severity: "soft" },
    { phrase: "above and beyond", severity: "soft" },
    { phrase: "key stakeholders", severity: "soft" },
    // Found in baseline tests — trailing clause clichés
    { phrase: "enabling faster", severity: "hard" },
    { phrase: "enabling teams", severity: "hard" },
    { phrase: "ensuring compliance", severity: "hard" },
    { phrase: "improving developer", severity: "hard" },
    { phrase: "accelerating the team", severity: "hard" },
    { phrase: "establishing best practices", severity: "hard" },
    { phrase: "standardizing communication patterns", severity: "hard" },
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
      description: "CRITICAL: Ending a bullet with ', enabling...', ', reducing...', ', improving...', ', ensuring...', ', establishing...', ', standardizing...', ', accelerating...' or any other dangling -ing clause. This is the MOST COMMON AI tell found in testing. At least 2-3 bullets per role MUST NOT end with a participial clause.",
      example_bad: "Led migration to microservices, reducing deploy times and enabling independent releases",
      example_good: "Led migration to microservices. Deploy times dropped from 2 hours to 15 minutes.",
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
      description: "CRITICAL: When every single bullet in a role has a percentage, dollar amount, or numeric comparison — this is the #1 sign of an AI resume. STRICTLY ENFORCE: for each role, at least 2 bullets MUST have ZERO numbers, ZERO percentages, ZERO dollar amounts. These bullets should describe what was built, how it worked, or what problem it solved — in plain words only.",
      example_bad: "Reduced X by 72%... improved Y by 340%... saving $420K... from 1.2s to 180ms... (every single bullet has a number)",
      example_good: "4 out of 6 bullets have metrics. The other 2 say things like 'Owned the on-call rotation for the payments team — wrote the runbook that new engineers still use' (no numbers, just real context).",
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

  // --- Verb overuse limits ---
  verb_overuse: {
    description: "Do NOT start more than 2 bullets across the entire resume with the same verb. Vary your verbs. 'Architected' and 'Designed' are especially overused by AI — use 'Built', 'Set up', 'Wrote', 'Put together', or 'Created' instead for most bullets.",
    max_per_verb: 2,
  },

  // --- Summary anti-patterns ---
  summary_rules: {
    description: "The professional summary must NOT follow the AI template of '[N]+ years of experience [verb]-ing [buzzwords] at scale'. Write it like a human would: mention what you're good at, what kind of problems you like, or what you're looking for — not a keyword dump.",
    banned_patterns: [
      "[N]+ years of experience [verb]-ing",
      "Proven track record of/in",
      "Deep expertise in",
      "Known for [verb]-ing",
      "passionate about",
      "with a strong focus on",
    ],
    example_bad: "Staff-level platform engineer with 7+ years of experience designing distributed systems at scale. Proven track record leading microservices migrations. Deep expertise in Java, Go, and Kubernetes.",
    example_good: "I've spent most of my career making backend systems faster and less painful to deploy. Currently at Stripe working on payment infrastructure. Before that, I helped Airbnb's search team ship ranking models. I like hard infrastructure problems and teams that ship daily.",
  },

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
    extended:            { max: 9,  per: "14-20", description: "At most 7-9 of 14-20 bullets per role should have hard metrics" },
    "optimize-extended": { max: 9,  per: "14-20", description: "At most 7-9 of 14-20 bullets per role should have hard metrics" },
  },
};

// --- Curated verb fragments used verbatim in prompt text ---
// (Distinct from ACTION_VERBS/WEAK_VERBS which drive scoring.)
// Domain packs may override these so functional resumes use functional verbs.
const PROMPT_VERBS = {
  strong_long:
    "Built, Designed, Developed, Led, Reduced, Improved, Architected, Deployed, Automated, Migrated, Optimized, Created",
  strong_short: "Built, Designed, Developed, Led, Reduced, Improved",
  weak:
    "Assisted, Helped, Participated, Supported, Maintained, Wrote, Served, Completed, Handled, Utilized, Worked, Collaborated, Contributed, Stood",
  weak_short:
    "Assisted, Helped, Participated, Supported, Maintained, Wrote, Served, Completed, Handled, Utilized, Worked, Collaborated, Contributed",
};

// --- Implicit-keyword inference rules block (injected into keyword placement) ---
// Software-engineering defaults. Domain packs replace this wholesale.
const IMPLICIT_KEYWORD_RULES = `IMPLICIT KEYWORD RULES:
- If the JD says "distributed systems" → include at least 2 of: Kafka, gRPC, service mesh, event-driven, message queue
- If the JD says "cloud infrastructure" → include at least 2 of: Terraform, Pulumi, CloudFormation, IaC
- If the JD says "observability" → include at least 2 of: Prometheus, Grafana, Datadog, distributed tracing, OpenTelemetry
- If the JD says "CI/CD" → include at least 1 of: Jenkins, GitHub Actions, ArgoCD, CircleCI
- If the JD says "microservices" → include at least 2 of: Docker, Kubernetes, service discovery, API gateway, container orchestration
- If the JD mentions a seniority level (Staff, Principal, Lead) → the summary and first bullets must reflect that scope: org-wide impact, cross-team leadership, technical roadmap ownership`;

// --- Domain packs (sparse overlays; base config IS the "software" pack) ---
// resolveDomain() in domains.js merges a pack onto the base config.
// software:{} ⇒ identity passthrough (zero regression by construction).
const DOMAIN_PACKS = {
  software: {},

  // ───────────────────────── Salesforce ─────────────────────────
  salesforce: {
    prompt_verbs: {
      strong_long:
        "Configured, Built, Designed, Implemented, Customized, Automated, Led, Delivered, Migrated, Integrated, Documented, Architected",
      strong_short: "Configured, Built, Designed, Implemented, Delivered, Led",
    },
    action_verbs_add: {
      technical: ["Configured", "Customized", "Implemented", "Automated", "Integrated"],
      problem_solving: ["Analyzed", "Mapped", "Validated", "Tested"],
      communication: ["Gathered", "Documented", "Facilitated", "Translated"],
    },
    scoring_rules_replace: {
      "programming language": {
        pattern: /\b(?:Apex|SOQL|SOSL|JavaScript|LWC|Lightning Web Components?|Aura|Visualforce|Java|Bash)\b/i,
      },
      "technology name": {
        pattern: /\b(?:Salesforce|Sales Cloud|Service Cloud|Experience Cloud|Marketing Cloud|Data Cloud|Field Service|Revenue Cloud|CPQ|Agentforce|Slack|Flow Builder|Flow|Process Builder|Workflow Rules?|Validation Rules?|Apex Triggers?|Batch Apex|Platform Events?|Lightning|Aura|Visualforce|SFDX|Salesforce CLI|Data Loader|Workbench|Copado|Gearset|Flosum|OmniStudio|AppExchange|Permission Sets?|Sharing Rules?|Approval Process|Record Types?|Einstein|MuleSoft|Pardot|Marketing Cloud Account Engagement)\b/i,
      },
    },
    tech_timeline: {
      "salesforce lightning": { earliest: 2015 },
      "lightning experience": { earliest: 2015 },
      "lightning web components": { earliest: 2019 },
      "lwc": { earliest: 2019 },
      "flow builder": { earliest: 2019 },
      "process builder": { earliest: 2015 },
      "salesforce cpq": { earliest: 2016 },
      "salesforce dx": { earliest: 2017 },
      "sfdx": { earliest: 2017 },
      "data cloud": { earliest: 2022 },
      "agentforce": { earliest: 2024 },
      "einstein": { earliest: 2016 },
      "omnistudio": { earliest: 2021 },
    },
    skill_categories: [
      "Salesforce Clouds",
      "Development (Apex/LWC)",
      "Automation & Configuration",
      "Integration & Data",
      "DevOps & Tools",
      "Methodology & Certifications",
    ],
    implicit_keyword_rules: `IMPLICIT KEYWORD RULES (Salesforce ecosystem):
- If the JD says "automation" or "no-code" → include at least 2 of: Flow Builder, Process Builder, validation rules, approval processes, assignment rules
- If the JD says "custom development" or "code" → include at least 2 of: Apex, SOQL, LWC, triggers, batch Apex, Apex REST
- If the JD says "integration" → include at least 2 of: REST/SOAP APIs, MuleSoft, Platform Events, middleware, Bulk API
- If the JD says "data migration" → include at least 2 of: Data Loader, Workbench, ETL, data mapping, deduplication
- If the JD says "deployment" or "release" → include at least 2 of: SFDX, change sets, Copado/Gearset, sandboxes, CI/CD
- If the JD says "Sales/Service/Experience Cloud" → reference the matching cloud features (opportunity management, case management, communities/portals) explicitly
- If the JD mentions Admin → emphasize profiles, permission sets, role hierarchy, OWD, reports & dashboards
- If the JD mentions Architect → emphasize data modeling, sharing & visibility, governance, integration patterns, large data volumes`,
    domain_context: `SALESFORCE DOMAIN — write for the Salesforce ecosystem. This candidate is a Salesforce professional (Administrator / Functional Consultant / Developer / Architect), NOT a generic software engineer. Hard rules:
- Use exact Salesforce terminology, never paraphrased: write "Flow Builder" (not "workflow tool"), "Lightning Web Components" / "LWC", "validation rules", "permission sets", "sharing rules", "Apex", "SOQL". The literal term is what the ATS matches.
- Frame work as declarative-first configuration plus targeted Apex, org/release management, sandbox-to-prod deployments, UAT, and business requirements gathering — NOT microservices, distributed systems, or Kubernetes.
- Realistic career model: a mix of Salesforce consultancies/SIs and in-house Salesforce teams; certifications are a top recruiter signal; many professionals come from business/operations backgrounds, not CS.
- Bullets should name the cloud (Sales/Service/Experience Cloud), the objects/automation touched, and the business process improved (lead-to-cash, case deflection, onboarding).`,
    it_services_firms: [
      "Accenture", "Deloitte Digital", "Slalom", "Capgemini",
      "Cognizant", "IBM iX", "Silverline", "Coastal Cloud",
    ],
    certifications: [
      "Salesforce Certified Administrator",
      "Salesforce Certified Advanced Administrator",
      "Salesforce Certified Platform App Builder",
      "Salesforce Certified Platform Developer I",
      "Salesforce Certified Platform Developer II",
      "Salesforce Certified JavaScript Developer I",
      "Salesforce Certified Sales Cloud Consultant",
      "Salesforce Certified Service Cloud Consultant",
      "Salesforce Certified Experience Cloud Consultant",
      "Salesforce Certified CPQ Specialist",
      "Salesforce Certified Application Architect",
      "Salesforce Certified System Architect",
    ],
    education: {
      masters: {
        degree: "Master of Business Administration",
        school: "Arizona State University",
        location: "Tempe, AZ",
        graduated: "May 2016",
      },
      bachelors: {
        degree: "Bachelor of Business Administration in Information Systems",
        school: "University of Arizona",
        location: "Tucson, AZ",
        graduated: "May 2013",
      },
    },
    anti_slop: {
      tone: `Write like a Salesforce consultant updating their resume between client calls — practical and specific. Name the clouds, objects, and automations you actually touched, and the business process you fixed. Mention the messy data, the legacy org, the permission model nobody understood, the go-live that ran long. Don't write like a Salesforce marketing deck. Real implementations have scope cuts, data issues, and hypercare.`,
      banned_phrases_add: [
        { phrase: "360-degree view of the customer", severity: "hard" },
        { phrase: "single source of truth", severity: "soft" },
        { phrase: "digital transformation journey", severity: "hard" },
        { phrase: "empower business users", severity: "soft" },
      ],
      authenticity_bonuses_add: [
        { pattern: /\b(?:go-live|hypercare|cutover|fit-gap|user stor(?:y|ies)|sandbox|UAT|data migration|change set|managed package|org|admin handoff|backlog)\b/i, points: 1, label: "Salesforce delivery context (authentic voice)" },
      ],
    },
  },

  // ───────────────────────── Workday ─────────────────────────
  workday: {
    prompt_verbs: {
      strong_long:
        "Configured, Designed, Implemented, Built, Led, Delivered, Migrated, Integrated, Documented, Tested, Analyzed, Mapped",
      strong_short: "Configured, Designed, Implemented, Led, Delivered, Migrated",
    },
    action_verbs_add: {
      technical: ["Configured", "Implemented", "Integrated", "Migrated"],
      problem_solving: ["Analyzed", "Mapped", "Validated", "Tested"],
      communication: ["Gathered", "Documented", "Facilitated", "Translated"],
    },
    scoring_rules_replace: {
      "programming language": {
        pattern: /\b(?:XSLT|XML|XPath|SQL|Java|Workday Studio|EIB|Core Connectors?|PECI|PICOF|Web Services?|SOAP|REST)\b/i,
      },
      "technology name": {
        pattern: /\b(?:Workday|EIB|Core Connectors?|Workday Studio|Studio|BIRT|Calculated Fields?|Business Process(?: Framework)?|Condition Rules?|Security Groups?|Report Writer|Advanced Reports?|Matrix Reports?|Composite Reports?|Dashboards?|Discovery Boards?|PECI|PICOF|Cloud Connect|Document Transformation|Workday Extend|Prism Analytics|Adaptive Planning|HCM|Financials?|Payroll|Compensation|Benefits|Absence|Time Tracking|Recruiting|Talent|Tenant|Workday Pro|Workday Community)\b/i,
      },
    },
    tech_timeline: {
      "workday": { earliest: 2006 },
      "workday hcm": { earliest: 2006 },
      "workday financials": { earliest: 2007 },
      "workday payroll": { earliest: 2008 },
      "workday studio": { earliest: 2010 },
      "core connectors": { earliest: 2011 },
      "eib": { earliest: 2009 },
      "birt": { earliest: 2010 },
      "prism analytics": { earliest: 2017 },
      "workday extend": { earliest: 2020 },
      "adaptive planning": { earliest: 2018 },
      "peci": { earliest: 2014 },
      "picof": { earliest: 2013 },
    },
    skill_categories: [
      "Workday Modules",
      "Integrations",
      "Reporting & Analytics",
      "Configuration & Security",
      "Methodology & Tools",
      "Certifications",
    ],
    implicit_keyword_rules: `IMPLICIT KEYWORD RULES (Workday ecosystem):
- If the JD says "integrations" → include at least 2 of: EIB, Core Connectors, Workday Studio, Document Transformation, web services (SOAP/REST), XSLT
- If the JD says "reporting" → include at least 2 of: Report Writer, Advanced/Matrix/Composite reports, Calculated Fields, BIRT, dashboards
- If the JD says "security" → include at least 2 of: security groups, domain security policies, business process security policies, segregation of duties
- If the JD says "business process" → include at least 2 of: Business Process Framework, condition rules, approval steps, notifications
- If the JD says "data conversion" → include at least 2 of: iLoads, EIB, data mapping, validation, mock conversions
- If the JD mentions a module (HCM, Payroll, Financials, Benefits, Time Tracking, Recruiting) → reference that module's real configuration objects explicitly
- If the JD mentions "deployment" or "implementation" → reference Workday Launch/deployment methodology, tenant strategy (Sandbox/Implementation/Prod), and semi-annual release (R1/R2) adoption`,
    domain_context: `WORKDAY DOMAIN — write for the Workday ecosystem. This candidate is a Workday professional (HCM / Integrations / Financials / Reporting / Security Consultant or SME), NOT a generic software engineer. Hard rules:
- Use exact Workday terminology, never paraphrased: "EIB" (not "data import tool"), "Core Connectors", "Workday Studio", "BIRT", "Calculated Fields", "Business Process Framework", "security groups", "tenant". The literal term is what the ATS matches.
- Frame work as tenant configuration, integration build/maintenance, report development, business process design, requirements workshops, fit-gap analysis, data conversion, UAT/parallel testing, go-live and post-production support — NOT microservices or distributed systems.
- Realistic career model: longer tenure (often 8–15 years), employers skew to Workday partners/SIs (Deloitte, Accenture, Cognizant, Kainos, Alight, PwC, IBM) and large enterprises; backgrounds are frequently HR, Finance, or Business rather than Computer Science. Workday certification is partner-gated, so most individuals do NOT list it unless the certifications flag is on.
- Bullets should name the module, the integration/report/business process built, and the HR/Finance outcome (faster onboarding, accurate payroll, clean reporting).`,
    it_services_firms: [
      "Deloitte", "Accenture", "Cognizant", "Kainos",
      "PwC", "IBM", "Alight Solutions", "Collaborative Solutions",
    ],
    certifications: [
      "Workday Pro - HCM",
      "Workday Pro - Integrations",
      "Workday Pro - Financials",
      "Workday Pro - Reporting",
      "Workday Pro - Security",
      "Workday Pro - Payroll",
    ],
    education: {
      masters: {
        degree: "Master of Science in Human Resource Management",
        school: "Pennsylvania State University",
        location: "University Park, PA",
        graduated: "May 2014",
      },
      bachelors: {
        degree: "Bachelor of Business Administration in Finance",
        school: "Indiana University",
        location: "Bloomington, IN",
        graduated: "May 2011",
      },
    },
    anti_slop: {
      tone: `Write like a Workday consultant updating their resume between client engagements — practical and specific. Name the modules, the integrations, the reports, and the client's real pain (the legacy HRIS, the messy org structure, the security model nobody had documented, the payroll parallel that didn't tie out). Don't write like a Workday sales deck. Real implementations have scope cuts, conversion issues, and go-live firefights.`,
      banned_phrases_add: [
        { phrase: "power of one", severity: "hard" },
        { phrase: "one source of truth", severity: "soft" },
        { phrase: "people-first", severity: "soft" },
        { phrase: "digital HR transformation", severity: "hard" },
      ],
      authenticity_bonuses_add: [
        { pattern: /\b(?:go-live|hypercare|cutover|fit-gap|parallel testing|mock conversion|requirements workshop|tenant|sandbox|UAT|production support|R[12] release|configuration workbook)\b/i, points: 1, label: "Workday delivery context (authentic voice)" },
      ],
    },
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
  FORMAT_EXTENDED,
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
  PROMPT_VERBS,
  IMPLICIT_KEYWORD_RULES,
  DOMAIN_PACKS,
};