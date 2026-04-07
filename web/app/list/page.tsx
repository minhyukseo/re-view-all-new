"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { PostCard } from "@/components/PostCard";
import { buildApiUrl, fetchWithRetry } from "@/lib/api";
import { Activity, Thermometer, DollarSign, Filter, RefreshCw } from "lucide-react";
import { FilterModal } from "@/components/FilterModal";

interface Post {
  id: number;
  source_site: string;
  title: string;
  url: string;
  author: string;
  created_at: string;
  crawled_at?: string;
}

const PAGE_SIZE = 24;

const COMMUNITIES = [
  { id: "dogdrip", name: "개드립" },
  { id: "dcinside", name: "디시인사이드" },
  { id: "theqoo", name: "더쿠" },
  { id: "ruliweb", name: "루리웹" },
  { id: "ppomppu", name: "뽐뿌" },
  { id: "mlbpark", name: "엠엘비파크" },
  { id: "bobaedream", name: "보배드림" },
  { id: "todayhumor", name: "오늘의유머" },
  { id: "nate", name: "네이트판" },
  { id: "aagag", name: "AAGAG" },
  { id: "etoland", name: "이토랜드" },
];

export default function ListPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>(
    COMMUNITIES.map(c => c.id)
  );
  const [sortMode, setSortMode] = useState<"interleaved" | "latest">("interleaved");
  const [error, setError] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestInFlightRef = useRef(false);

  const fetchPosts = useCallback(async (nextOffset = 0, mode: "replace" | "append" = "replace", forceRefresh = false) => {
    if (requestInFlightRef.current) {
      return;
    }

    if (selectedCommunities.length === 0) {
      setPosts([]);
      setOffset(0);
      setHasMore(false);
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    requestInFlightRef.current = true;
    if (mode === "replace") {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // --- 캐시 재사용 로직 (SessionStorage) + 만료 시간 (5분) ---
      if (mode === "replace" && !forceRefresh && typeof window !== "undefined") {
        const cached = sessionStorage.getItem("re_view_all_cache");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5분
            const now = Date.now();
            
            const isFilterMatch = JSON.stringify(parsed.selectedCommunities) === JSON.stringify(selectedCommunities);
            const isModeMatch = parsed.sortMode === sortMode;
            const isFresh = now - (parsed.timestamp || 0) < CACHE_EXPIRATION_MS;

            if (isFilterMatch && isModeMatch && isFresh) {
              console.log("[DEBUG] Loaded from fresh sessionStorage cache");
              setPosts(parsed.posts);
              setOffset(parsed.offset);
              setHasMore(parsed.hasMore);
              requestInFlightRef.current = false;
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.error("Cache parsing error", e);
          }
        }
      }
      // ---------------------------------

      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
        mode: sortMode,
      });

      if (selectedCommunities.length > 0) {
        params.set("sources", selectedCommunities.join(","));
      }

      const apiUrl = buildApiUrl(`/api/posts?${params.toString()}`);
      console.log('[DEBUG] Fetching posts from:', apiUrl);

      const res = await fetchWithRetry(
        apiUrl,
        { 
          cache: "no-store",
          timeout: 10000,
          retries: 3,
          retryDelay: 1000,
        }
      );
      if (res.ok) {
        const data = (await res.json()) as any;
        const nextPosts = data.results || [];
        
        setPosts(prev => mode === "replace" ? nextPosts : [...prev, ...nextPosts]);
        setHasMore(Boolean(data.hasMore));
        setOffset(data.nextOffset || nextOffset + nextPosts.length);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || `API Error: ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to load posts:", err);
      setError("게시글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      requestInFlightRef.current = false;
      if (mode === "replace") {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [selectedCommunities, sortMode]);

  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setHasMore(true);
    fetchPosts(0, "replace");
  }, [fetchPosts, sortMode]); // sortMode 변경 시 재요청

  useEffect(() => {
    const node = sentinelRef.current;
    const root = listContainerRef.current;
    if (!node || !hasMore || isLoading || isLoadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }

        fetchPosts(offset, "append");
      },
      {
        root,
        rootMargin: "400px 0px",
        threshold: 0,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchPosts, hasMore, isLoading, isLoadingMore, offset]);

  // --- 상태가 변경될 때마다 캐시에 저장 (타임스탬프 포함) ---
  useEffect(() => {
    if (posts.length > 0 && typeof window !== "undefined") {
      sessionStorage.setItem("re_view_all_cache", JSON.stringify({
        posts,
        offset,
        selectedCommunities,
        hasMore,
        sortMode,
        timestamp: Date.now()
      }));
    }
  }, [posts, offset, selectedCommunities, hasMore, sortMode]);
  // ------------------------------------

  const toggleCommunity = (id: string) => {
    setSelectedCommunities(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const filteredPosts = posts;
  const hasActiveFilters = selectedCommunities.length > 0;
  const emptyState = posts.length === 0
    ? {
        title: "아직 수집된 게시글이 없습니다.",
        description: "실데이터가 들어오면 여기에 최신 게시글이 표시됩니다. 잠시 후 새로고침해 주세요.",
      }
    : !hasActiveFilters
      ? {
          title: "선택된 커뮤니티가 없습니다.",
          description: "필터에서 하나 이상 선택하면 게시글을 다시 볼 수 있습니다.",
        }
      : {
          title: "현재 조건에 맞는 게시글이 없습니다.",
          description: "필터 설정을 조정하거나 잠시 후 다시 시도해 주세요.",
        };

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
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs text-zinc-500">Active Sources</div>
                <button 
                  onClick={() => setIsFilterOpen(true)}
                  className="px-2 py-0.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-md text-[10px] font-bold text-zinc-300 flex items-center gap-1 transition-all"
                >
                  <Filter size={10} />
                  필터
                </button>
              </div>
              <div className="text-xl font-bold text-white">{selectedCommunities.length} / {COMMUNITIES.length}</div>
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
            <button 
              onClick={() => setSortMode("interleaved")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm transition-all ${sortMode === "interleaved" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-white"}`}
            >
              Trending
            </button>
            <button 
              onClick={() => setSortMode("latest")}
              className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm transition-all ${sortMode === "latest" ? "bg-zinc-100 text-zinc-900" : "text-zinc-400 hover:text-white"}`}
            >
              Latest
            </button>
          </div>
          <button 
            onClick={() => {
              setPosts([]);
              setOffset(0);
              setHasMore(true);
              fetchPosts(0, "replace", true);
            }}
            disabled={isLoading || isLoadingMore}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-sm font-bold hover:bg-indigo-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading || isLoadingMore ? "animate-spin" : ""} />
            {isLoading || isLoadingMore ? "Refreshing..." : "새로고침"}
          </button>
        </div>
        
        <div ref={listContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 pb-20 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-zinc-500 animate-pulse font-medium">
              게시글을 불러오는 중입니다...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-red-400">
               <span className="text-4xl mb-4">⚠️</span>
               <p className="font-medium">{error}</p>
               <button 
                 onClick={() => {
                   setError(null);
                   fetchPosts(0, "replace");
                 }}
                 className="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full text-sm font-bold hover:bg-red-500/20 transition-all"
               >
                 다시 시도
               </button>
            </div>
          ) : filteredPosts.length > 0 ? (
            filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
               <span className="text-4xl mb-4">📭</span>
               <p className="font-medium">{emptyState.title}</p>
               <p className="text-xs mt-1">{emptyState.description}</p>
            </div>
          )}

          {!isLoading && filteredPosts.length > 0 ? (
            <div ref={sentinelRef} className="py-6 text-center text-xs text-zinc-500">
              {isLoadingMore ? "게시글을 더 불러오는 중입니다..." : hasMore ? "스크롤하면 더 불러옵니다." : "마지막 게시글까지 확인했습니다."}
            </div>
          ) : null}
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

      {/* Community Filter Modal */}
      <FilterModal 
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        communities={COMMUNITIES}
        selectedIds={selectedCommunities}
        onToggle={toggleCommunity}
        onSelectAll={() => setSelectedCommunities(COMMUNITIES.map(c => c.id))}
        onDeselectAll={() => setSelectedCommunities([])}
      />
    </div>
  );
}
