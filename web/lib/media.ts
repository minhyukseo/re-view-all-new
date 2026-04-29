import { buildApiUrl } from "@/lib/api";

function isBlockedCdnHost(hostname: string): boolean {
  if (/^dcimg\d+\.dcinside\.(co\.kr|com)$/.test(hostname)) return true;
  if (hostname === "image.dcinside.com") return true;
  if (hostname === "nstatic.dcinside.com") return true;
  if (hostname.includes("dogdrip.net")) return true;
  if (hostname.includes("fmkorea.com")) return true;
  if (hostname.includes("theqoo.net")) return true;
  if (hostname.includes("ppomppu.co.kr")) return true;
  if (hostname.includes("etoland.co.kr")) return true;
  if (hostname.includes("mlbpark.donga.com")) return true;
  if (hostname.includes("bobaedream.co.kr")) return true;
  return false;
}

/**
 * 디시, 개드립 등 외부 유출 차단 CDN은 API Worker 프록시 URL로 바꾼다.
 */
/** 크롤 시점에 lazy 플레이스홀더만 저장된 항목 (재수집 전까지 DB에 남을 수 있음) */
export function isDcinsideLazyPlaceholderUrl(url: string): boolean {
  return url.includes("nstatic.dcinside.com") && url.includes("gallview_loading");
}

export function getProxiedImageUrl(url: string, options: { width?: number; still?: boolean } = {}): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return url;
    if (!isBlockedCdnHost(u.hostname)) {
       // 차단되지 않은 호스트라도 리사이징이 필요한 경우 wsrv.nl을 직접 사용할 수 있음
       if (options.width || (options.still && url.toLowerCase().endsWith('.gif'))) {
          const wsrvUrl = new URL('https://wsrv.nl/');
          wsrvUrl.searchParams.set('url', url);
          if (options.width) wsrvUrl.searchParams.set('w', String(options.width));
          if (options.still && url.toLowerCase().endsWith('.gif')) wsrvUrl.searchParams.set('n', '-1');
          wsrvUrl.searchParams.set('output', 'webp');
          return wsrvUrl.toString();
       }
       return url;
    }

    const params = new URLSearchParams({ url });
    if (options.width) params.set('w', String(options.width));
    if (options.still) params.set('still', 'true');

    return buildApiUrl(`/api/proxy-media?${params.toString()}`);
  } catch {
    return url;
  }
}

/** @deprecated Use getProxiedImageUrl instead */
export const proxiedDcinsideImageUrl = getProxiedImageUrl;
