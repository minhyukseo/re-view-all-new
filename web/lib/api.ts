// When running in Cloudflare Worker runtime, `process.env` values may not be
// inlined the same way as Node/Next. Use a safe public default instead of
// localhost to avoid server-side fetches failing in production.
const FALLBACK_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://community-aggregator.seomh81.workers.dev";

export function getApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;

  if (configuredBaseUrl && configuredBaseUrl.trim() !== "") {
    return configuredBaseUrl;
  }

  return FALLBACK_API_BASE_URL;
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    return normalizedPath;
  }

  return new URL(normalizedPath, baseUrl).toString();
}
