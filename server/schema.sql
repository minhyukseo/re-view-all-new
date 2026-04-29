-- Cloudflare D1 Database Schema
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_site TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  author TEXT,
  thumbnail TEXT,
  body_html TEXT,
  text_content TEXT,
  media_json TEXT,
  comments_json TEXT,
  detail_fetched_at DATETIME,
  created_at DATETIME DEFAULT (DATETIME('now', 'localtime')),
  crawled_at DATETIME DEFAULT (DATETIME('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_posts_source_site ON posts(source_site);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

CREATE TABLE IF NOT EXISTS crawl_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_site TEXT,
  url TEXT,
  message TEXT,
  created_at DATETIME DEFAULT (DATETIME('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_crawl_logs_created_at ON crawl_logs(created_at);
