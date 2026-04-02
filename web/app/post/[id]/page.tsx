import Link from "next/link";
import { ArrowLeft, ExternalLink, MessageSquare, Image as ImageIcon, Video } from "lucide-react";
import { buildApiUrl } from "@/lib/api";
import { isDcinsideLazyPlaceholderUrl, proxiedDcinsideImageUrl } from "@/lib/media";

interface MediaItem {
  type: "image" | "video";
  url: string;
}

interface CommentItem {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  depth: number;
}

interface PostDetail {
  id: number;
  sourceSite: string;
  title: string;
  author: string;
  sourceUrl: string;
  createdAt: string;
  bodyHtml: string;
  textContent: string;
  media: MediaItem[];
  comments: CommentItem[];
}

async function getPostDetail(id: string): Promise<PostDetail | null> {
  try {
    const url = buildApiUrl(`/api/posts/${id}/detail`);
    console.log(`[PostDetail] Fetching from: ${url}`);

    const res = await fetch(url, {
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[PostDetail] Fetch failed with status: ${res.status} ${res.statusText} for URL: ${url}`);
      console.error(`[PostDetail] Error body: ${errorText}`);
      return null;
    }

    const data = await res.json();
    if (!data.success || !data.result) {
      console.error(`[PostDetail] API returned error or empty result:`, data.error || "No result");
      return null;
    }

    return data.result;
  } catch (error) {
    console.error("[PostDetail] Exception during fetch:", error);
    return null;
  }
}

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const detail = await getPostDetail(params.id);

  if (!detail) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/list" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={16} />
          <span>목록으로</span>
        </Link>
        <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-900/50 p-8 text-zinc-300">
          게시글 상세를 불러오지 못했습니다.
        </div>
      </div>
    );
  }

  const textBlocks = detail.textContent
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const displayMedia = detail.media.filter(
    (item) => !(item.type === "image" && isDcinsideLazyPlaceholderUrl(item.url))
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/list" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={16} />
          <span>목록으로</span>
        </Link>
        <a
          href={detail.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/20 transition-colors"
        >
          <ExternalLink size={16} />
          <span>원문 보기</span>
        </a>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-zinc-900/60 p-8 shadow-2xl">
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
          <span>{detail.sourceSite}</span>
          <span>•</span>
          <span>{detail.author || "익명"}</span>
          {detail.createdAt ? (
            <>
              <span>•</span>
              <span>{detail.createdAt}</span>
            </>
          ) : null}
        </div>

        <h1 className="mt-4 text-3xl font-bold text-white leading-tight">{detail.title}</h1>

        {displayMedia.length > 0 ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <ImageIcon size={16} />
              <span>미디어 {displayMedia.length}개</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {displayMedia.map((item, index) => (
                <div key={`${item.type}-${item.url}-${index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  {item.type === "image" ? (
                    <img
                      src={proxiedDcinsideImageUrl(item.url)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-video">
                      {item.url.includes("youtube.com") || item.url.includes("youtu.be") || item.url.includes("player") ? (
                        <iframe src={item.url} className="h-full w-full" allowFullScreen />
                      ) : (
                        <video src={item.url} controls className="h-full w-full" />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
            <Video size={16} />
            <span>본문</span>
          </div>
          <div className="space-y-4 text-[15px] leading-7 text-zinc-200">
            {(textBlocks.length ? textBlocks : [detail.textContent]).filter(Boolean).map((block, index) => (
              <p key={`${index}-${block.slice(0, 24)}`} className="whitespace-pre-wrap break-words">
                {block}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-zinc-900/60 p-8 shadow-2xl">
        <div className="flex items-center gap-2 text-lg font-semibold text-white">
          <MessageSquare size={18} />
          <span>댓글 {detail.comments.length}개</span>
        </div>

        {detail.comments.length > 0 ? (
          <div className="mt-6 space-y-3">
            {detail.comments.map((comment) => (
              <article
                key={comment.id}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                style={{ marginLeft: `${Math.min(comment.depth, 3) * 20}px` }}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                  <span className="font-medium text-zinc-200">{comment.author || "익명"}</span>
                  {comment.createdAt ? <span>{comment.createdAt}</span> : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">
                  {comment.body}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">현재 불러온 댓글이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
