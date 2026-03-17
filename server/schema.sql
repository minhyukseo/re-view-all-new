-- Cloudflare D1 Database Schema
-- 커뮤니티 게시글 메타데이터를 저장하기 위한 테이블 구조

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_site TEXT NOT NULL,           -- 사이트 식별자 (예: dogdrip, dcinside)
  title TEXT NOT NULL,                  -- 게시글 제목
  url TEXT UNIQUE NOT NULL,             -- 원문 URL (중복 적재 방지 필수)
  author TEXT,                          -- 작성자
  thumbnail TEXT,                       -- 목록용 썸네일 이미지 URL (있을 경우)
  body_html TEXT,                       -- 크롤링한 본문 HTML
  text_content TEXT,                    -- 본문 텍스트
  media_json TEXT,                      -- 본문 미디어 JSON 배열
  comments_json TEXT,                   -- 댓글 JSON 배열
  detail_fetched_at DATETIME,           -- 상세 수집 시각
  created_at DATETIME DEFAULT (DATETIME('now', 'localtime')), -- 원문 작성 시간
  crawled_at DATETIME DEFAULT (DATETIME('now', 'localtime'))  -- 시스템 수집 시간
);

CREATE TABLE IF NOT EXISTS post_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_url TEXT UNIQUE NOT NULL,
  source_site TEXT NOT NULL,
  title TEXT,
  author TEXT,
  content_html TEXT,
  content_text TEXT,
  media_json TEXT,
  created_at TEXT,
  crawled_at DATETIME DEFAULT (DATETIME('now', 'localtime'))
);

-- 인덱스 생성: 필터링 및 정렬 성능 최적화
CREATE INDEX IF NOT EXISTS idx_posts_source_site ON posts(source_site);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_post_contents_source_site ON post_contents(source_site);
