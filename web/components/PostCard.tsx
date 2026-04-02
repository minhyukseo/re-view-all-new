import Link from "next/link";
import { ArrowUpRight, Layers } from "lucide-react";
import { formatRelativeTime } from "@/lib/time";
import { decodeHtmlEntities } from "@/lib/decode";

interface Post {
  id: number;
  source_site: string;
  title: string;
  url: string;
  author: string;
  created_at: string;
}

const SITE_COLORS: Record<string, string> = {
  dogdrip: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  dcinside: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  theqoo: "text-pink-400 bg-pink-400/10 border-pink-400/20",
  nate: "text-red-400 bg-red-400/10 border-red-400/20",
  ppomppu: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  mlbpark: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  ruliweb: "text-lime-400 bg-lime-400/10 border-lime-400/20",
  bobaedream: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  fmkorea: "text-sky-400 bg-sky-400/10 border-sky-400/20",
  arcalive: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

const SITE_LABELS: Record<string, string> = {
  dogdrip: "개드립",
  nate: "네이트판",
  theqoo: "더쿠",
  dcinside: "디시인사이드",
  ppomppu: "뽐뿌",
  mlbpark: "엠팍",
  ruliweb: "루리웹",
  bobaedream: "보배드림",
  fmkorea: "에펨코리아",
  arcalive: "아카라이브",
};

export function PostCard({ post }: { post: Post }) {
  const colorClass = SITE_COLORS[post.source_site] || "text-zinc-400 bg-zinc-400/10 border-zinc-400/20";
  const label = SITE_LABELS[post.source_site] || post.source_site;

  const timeInfo = formatRelativeTime(post.created_at);

  return (
    <Link 
      href={`/post/${post.id}`}
      className="block p-5 bg-zinc-900/40 border border-white/5 rounded-2xl hover:bg-zinc-800/60 hover:border-white/10 transition-all group relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity transform -translate-x-full group-hover:translate-x-0"></div>
      
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colorClass}`}>
              {label}
            </span>
            {timeInfo ? <span className="text-zinc-500 text-xs font-medium">{timeInfo}</span> : null}
            {timeInfo ? <span className="text-zinc-600 text-xs hidden sm:inline">•</span> : null}
            <span className="text-zinc-400 text-xs truncate max-w-[120px] hidden sm:inline">{decodeHtmlEntities(post.author || "익명")}</span>
            <span className="ml-auto flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded text-[10px] font-bold">
               NEW
            </span>
          </div>
          
          <h3 className="text-base font-semibold text-zinc-200 group-hover:text-white transition-colors leading-relaxed truncate">
            {decodeHtmlEntities(post.title)}
          </h3>
          
          <div className="mt-3 flex items-center gap-4 text-xs font-medium text-zinc-500">
             <div className="flex items-center gap-1.5 group-hover:text-indigo-400 transition-colors">
               <ArrowUpRight size={14} />
               <span>상세보기</span>
             </div>
          </div>
        </div>
        
        {/* Thumbnail Placeholder */}
        <div className="hidden sm:block shrink-0 w-24 h-24 rounded-xl bg-zinc-900/80 border border-white/5 overflow-hidden group-hover:border-white/20 transition-colors relative shadow-inner">
           <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent"></div>
           <div className="w-full h-full flex items-center justify-center text-zinc-700">
             <Layers size={20} />
           </div>
        </div>
      </div>
    </Link>
  );
}
