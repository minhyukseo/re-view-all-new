const FALLBACK_API_BASE_URL = "http://localhost:8787";

export function getApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined") {
    return "";
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
