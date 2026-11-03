const PROVIDERS = {
  openai: { env: "OPENAI_BASE_URL", base: "https://api.openai.com", path: "chat/completions" },
  anthropic: { env: "ANTHROPIC_BASE_URL", base: "https://api.anthropic.com", path: "messages" },
};

function llmEndpoint(provider) {
  const { env, base, path } = PROVIDERS[provider];
  const configured = process.env[env]?.trim() || base;
  const root = configured.replace(/\/+$/, "").replace(/\/v1$/, "");
  return `${root}/v1/${path}`;
}

module.exports = { llmEndpoint };
