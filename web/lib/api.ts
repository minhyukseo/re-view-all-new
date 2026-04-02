// When running in Cloudflare Worker runtime, `process.env` values may not be
// inlined the same way as Node/Next. Use a safe public default instead of
// localhost to avoid server-side fetches failing in production.
const FALLBACK_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://community-aggregator.seomh81.workers.dev";

export function getApiBaseUrl() {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;

  if (configuredBaseUrl && configuredBaseUrl.trim() !== "") {
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

export interface FetchWithRetryOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { timeout = 5000, retries = 3, retryDelay = 1000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return fetchWithRetry(url, { ...options, retries: retries - 1 });
    }
    
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (retries > 0 && error instanceof Error && error.name === 'AbortError') {
      console.warn(`Request timeout after ${timeout}ms, retrying... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return fetchWithRetry(url, { ...options, retries: retries - 1 });
    }
    
    throw error;
  }
}
