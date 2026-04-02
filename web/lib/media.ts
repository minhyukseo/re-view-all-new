import { buildApiUrl } from "@/lib/api";

function isDcinsideCdnHost(hostname: string): boolean {
  if (/^dcimg\d+\.dcinside\.(co\.kr|com)$/.test(hostname)) return true;
  if (hostname === "image.dcinside.com") return true;
  if (hostname === "nstatic.dcinside.com") return true;
  return false;
}

/**
 * 디시 이미지 CDN은 타 사이트 Referer에서 403을 반환한다. API Worker 프록시 URL로 바꾼다.
 */
/** 크롤 시점에 lazy 플레이스홀더만 저장된 항목 (재수집 전까지 DB에 남을 수 있음) */
export function isDcinsideLazyPlaceholderUrl(url: string): boolean {
  return url.includes("nstatic.dcinside.com") && url.includes("gallview_loading");
}

export function proxiedDcinsideImageUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return url;
    if (!isDcinsideCdnHost(u.hostname)) return url;
    return buildApiUrl(`/api/proxy-media?url=${encodeURIComponent(url)}`);
  } catch {
    return url;
  }
}
