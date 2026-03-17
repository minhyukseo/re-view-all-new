import { PostCard } from "@/components/PostCard";
import { Activity, Thermometer, DollarSign } from "lucide-react";

interface Post {
  id: number;
  source_site: string;
  title: string;
  url: string;
  author: string;
  created_at: string;
}

export default async function ListPage() {
  let posts: Post[] = [];
  try {
    const res = await fetch("http://localhost:8787/api/posts?limit=50", { cache: "no-store", next: { revalidate: 0 } });
    if (res.ok) {
        const data = await res.json();
        posts = data.results || [];
    }
  } catch (err) {
    console.error("Failed to load posts:", err);
  }

  // Fallback dummy data if crawler hasn't run yet
  if (posts.length === 0) {
    posts = [
      { id: 1, source_site: "dogdrip", title: "최근 프론트엔드 개발 트렌드 요약", url: "#", author: "dev_user", created_at: new Date().toISOString() },
      { id: 2, source_site: "theqoo", title: "오늘자 역대급 하늘 사진", url: "#", author: "skylover", created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 3, source_site: "dcinside", title: "새로 나온 신형 스마트폰 벤치마크 유출", url: "#", author: "tech_guru", created_at: new Date(Date.now() - 7200000).toISOString() },
      { id: 4, source_site: "arcalive", title: "요즘 유행하는 밈 총정리", url: "#", author: "meme_master", created_at: new Date(Date.now() - 14400000).toISOString() },
      { id: 5, source_site: "fmkorea", title: "주말 예능 시청률 현황", url: "#", author: "tv_fan", created_at: new Date(Date.now() - 28800000).toISOString() },
    ];
  }

  return (
    <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-8 p-6 h-[calc(100vh-4rem)]">
      {/* Left Sidebar */}
      <aside className="hidden lg:flex flex-col gap-4 overflow-y-auto pb-8 pr-2">
        <div className="glass-panel p-5 rounded-3xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Dashboard</h3>
            <Activity size={16} className="text-indigo-400" />
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Today's Posts</div>
              <div className="text-3xl font-extrabold text-white">1,204<span className="text-sm text-indigo-400 ml-1">+12%</span></div>
            </div>
            <div className="h-px w-full bg-white/5"></div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Active Sources</div>
              <div className="text-xl font-bold text-white">14 / 14</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-3xl space-y-4">
           <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Weather</div>
              <Thermometer size={16} className="text-orange-400" />
           </div>
           <div>
              <div className="text-lg font-bold text-white">Seoul, KR</div>
              <div className="text-zinc-400 text-sm">3°C · Clear Sky</div>
           </div>
        </div>

        <div className="glass-panel p-5 rounded-3xl space-y-4">
           <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Exchange</div>
              <DollarSign size={16} className="text-emerald-400" />
           </div>
           <div className="space-y-2">
              <div className="flex justify-between items-end">
                 <span className="text-sm font-medium text-zinc-400">USD/KRW</span>
                 <span className="text-lg font-mono font-bold text-white">1,467.50</span>
              </div>
              <div className="flex justify-between items-end">
                 <span className="text-sm font-medium text-zinc-400">JPY/KRW</span>
                 <span className="text-lg font-mono font-bold text-white">934.12</span>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <section className="flex flex-col h-[calc(100vh-6rem)] bg-surface/30 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md shadow-2xl relative">
        <div className="p-4 border-b border-white/5 bg-surface/80 backdrop-blur-xl flex items-center justify-between z-10 sticky top-0">
          <div className="flex bg-white/5 rounded-full p-1 border border-white/5">
            <button className="px-4 py-1.5 bg-zinc-100 text-zinc-900 rounded-full text-sm font-bold shadow-sm transition-all">Trending</button>
            <button className="px-4 py-1.5 text-zinc-400 hover:text-white rounded-full text-sm font-medium transition-all">Latest</button>
          </div>
          <button className="hidden sm:block px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-sm font-bold hover:bg-indigo-500/20 transition-colors">
            Auto-Refresh
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </section>

      {/* Right Sidebar - Trending Tags */}
      <aside className="hidden xl:flex flex-col gap-4 overflow-y-auto pb-8 pr-2">
         <div className="glass-panel p-5 rounded-3xl">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Hot Keywords</h3>
            <div className="flex flex-wrap gap-2">
               {["#프론트엔드", "#애플", "#특가", "#유머", "#일상", "#IT기기", "#리뷰", "#이슈", "#AI", "#넷플릭스"].map(tag => (
                  <span key={tag} className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-full text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer transition-colors">
                     {tag}
                  </span>
               ))}
            </div>
         </div>

         <div className="glass-panel p-5 rounded-3xl flex-1 flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
               <span className="text-2xl">✨</span>
            </div>
            <h4 className="font-bold text-white mb-2">프리미엄 기능</h4>
            <p className="text-zinc-500 text-sm leading-relaxed mb-4">광고 없는 환경과 실시간 알림 기능을 제공합니다.</p>
            <button className="w-full py-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all">
               알아보기
            </button>
         </div>
      </aside>
    </div>
  );
}
