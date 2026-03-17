import Link from "next/link";
import { ArrowRight, Zap, Target, Globe } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-24 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-8">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        실시간 데이터 동기화 중
      </div>

      <h1 className="text-5xl md:text-7xl font-extrabold text-center tracking-tight mb-8 leading-tight">
        <span className="text-zinc-100">모든 커뮤니티 트렌드를</span><br/>
        <span className="text-gradient">단 하나의 뷰에서.</span>
      </h1>

      <p className="text-lg md:text-xl text-zinc-400 text-center max-w-2xl mb-12 leading-relaxed">
        복잡하고 파편화된 인터넷 세상, 이제 한 번의 스크롤로 가장 인기있는 국내 주요 커뮤니티의 소식을 빠르고 세련되게 탐색하세요.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 mb-24">
        <Link 
          href="/list"
          className="px-8 py-4 bg-zinc-100 text-zinc-900 rounded-full font-bold text-lg flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-transform shadow-xl shadow-white/5"
        >
          트렌드 탐색하기 <ArrowRight size={20} />
        </Link>
        <Link 
          href="/video"
          className="px-8 py-4 bg-surface border border-white/10 text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 hover:bg-surfaceHover transition-colors"
        >
          영상뷰어 모드
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
         <div className="glass-panel p-8 rounded-3xl">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-6">
              <Zap size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">압도적인 속도</h3>
            <p className="text-zinc-400 leading-relaxed text-sm">Server Components와 Edge 네트워크를 활용하여 데이터를 눈 깜짝할 새 가져옵니다.</p>
         </div>
         <div className="glass-panel p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full"></div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 mb-6">
              <Globe size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">14+ 지원 사이트</h3>
            <p className="text-zinc-400 leading-relaxed text-sm">국내 가장 영향력 있는 커뮤니티의 인기글만 고도로 선별하여 수집합니다.</p>
         </div>
         <div className="glass-panel p-8 rounded-3xl">
            <div className="w-12 h-12 bg-pink-500/20 rounded-2xl flex items-center justify-center text-pink-400 mb-6">
              <Target size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">모던 UI/UX</h3>
            <p className="text-zinc-400 leading-relaxed text-sm">눈의 피로를 최소화하는 우아한 다크 테마와 매끄러운 마이크로 인터랙션을 제공합니다.</p>
         </div>
      </div>
    </div>
  );
}
