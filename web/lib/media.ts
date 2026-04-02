import { buildApiUrl } from "@/lib/api";

function isBlockedCdnHost(hostname: string): boolean {
  if (/^dcimg\d+\.dcinside\.(co\.kr|com)$/.test(hostname)) return true;
  if (hostname === "image.dcinside.com") return true;
  if (hostname === "nstatic.dcinside.com") return true;
  if (hostname.includes("dogdrip.net")) return true;
  if (hostname.includes("fmkorea.com")) return true;
  if (hostname.includes("theqoo.net")) return true;
  return false;
}

/**
 * 디시, 개드립 등 외부 유출 차단 CDN은 API Worker 프록시 URL로 바꾼다.
 */
/** 크롤 시점에 lazy 플레이스홀더만 저장된 항목 (재수집 전까지 DB에 남을 수 있음) */
export function isDcinsideLazyPlaceholderUrl(url: string): boolean {
  return url.includes("nstatic.dcinside.com") && url.includes("gallview_loading");
}

export function getProxiedImageUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return url;
    if (!isBlockedCdnHost(u.hostname)) return url;
    return buildApiUrl(`/api/proxy-media?url=${encodeURIComponent(url)}`);
  } catch {
    return url;
  }
}

/** @deprecated Use getProxiedImageUrl instead */
export const proxiedDcinsideImageUrl = getProxiedImageUrl;
