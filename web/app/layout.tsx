import type { Metadata } from "next";
import { Sparkles, Compass, Layers, Mail } from "lucide-react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "REVIEW ALL | 모던 커뮤니티 애그리게이터",
  description: "트렌딩 게시글을 가장 빠르고 아름답게 탐색하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="dark">
      <body className="antialiased selection:bg-indigo-500/30">
        <div className="fixed inset-0 z-[-1] bg-background">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        </div>

        <header className="fixed top-0 w-full h-16 border-b border-white/5 bg-background/50 backdrop-blur-xl z-50 transition-all">
          <div className="max-w-[1600px] mx-auto h-full px-6 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
                 <Layers size={18} strokeWidth={2.5} />
              </div>
              <span className="font-bold text-lg tracking-tight text-white">REVIEW ALL</span>
            </Link>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/list" className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                <Compass size={16} />
                <span>탐색</span>
              </Link>
              <button className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                <Sparkles size={16} />
                <span>프리미엄</span>
              </button>
              <button className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                <Mail size={16} />
                <span>문의</span>
              </button>
            </nav>

            <div className="flex items-center gap-3">
               <button className="hidden sm:block px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                 로그인
               </button>
               <Link href="/list" className="px-5 py-2 text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition-all backdrop-blur-md">
                 시작하기
               </Link>
            </div>
          </div>
        </header>
        
        <main className="pt-16 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
