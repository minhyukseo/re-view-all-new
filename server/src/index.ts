import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { load } from 'cheerio';

// Cloudflare Workers D1 Types (if @cloudflare/workers-types is not available as import)
interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<{ success: boolean; results?: T[]; error?: string }>;
  all<T = unknown>(): Promise<{ success: boolean; results?: T[]; error?: string }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<any[]>;
  exec(query: string): Promise<any>;
}

// Cheerio Types
type Cheerio<T> = any;
type CheerioAPI = any;
type Element = any;

type Bindings = {
  DB: D1Database;
  USER_AGENTS: string[];
  ENVIRONMENT?: string;
};

interface Post {
  id?: number;
  source_site: string;
  title: string;
  url: string;
  author: string;
  thumbnail?: string;
  body_html?: string;
  text_content?: string;
  media_json?: string;
  comments_json?: string;
  detail_fetched_at?: string;
  created_at?: string;
  crawled_at?: string;
}

interface MediaItem {
  type: 'image' | 'video';
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

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

const DEFAULT_POST_LIMIT = 20;
const MAX_POST_LIMIT = 100;
const MIN_POST_LIMIT = 1;
const MIN_POST_OFFSET = 0;
const DETAIL_FETCH_CONCURRENCY = 4;
const DB_BATCH_SIZE = 50;
const DB_BATCH_RETRY_COUNT = 2;
const POST_RETENTION_DAYS = 7;
const MAX_POSTS_PER_SITE = 300;
const POST_FEED_FETCH_CAP_PER_SITE = 200;

const TARGETS = [
  { id: "dogdrip", name: "개드립", url: "https://www.dogdrip.net/?mid=dogdrip&sort_index=popular" },
  { id: "dcinside", name: "디시인사이드", url: "https://gall.dcinside.com/board/lists/?id=dcbest&_dcbest=9" },
  { id: "todayhumor", name: "오늘의유머", url: "https://www.todayhumor.co.kr/board/list.php?table=humorbest" },
  { id: "theqoo", name: "더쿠", url: "https://theqoo.net/hot/category/512000937" },
  { id: "nate", name: "네이트판", url: "https://pann.nate.com/talk/ranking" },
  { id: "aagag", name: "AAGAG", url: "https://aagag.com/issue/" },
  { id: "bobaedream", name: "보배드림", url: "https://m.bobaedream.co.kr/board/new_writing/best" },
  { id: "ruliweb", name: "루리웹", url: "https://bbs.ruliweb.com/best/humor_only?orderby=regdate&range=" },
  { id: "ppomppu", name: "뽐뿌", url: "https://www.ppomppu.co.kr/zboard/zboard.php?id=humor" },
  { id: "mlbpark", name: "엠팍", url: "https://mlbpark.donga.com/mp/honor.php" },
  { id: "etoland", name: "이토랜드", url: "https://www.etoland.co.kr/bbs/board.php?bo_table=etohumor07&sca=%C0%AF%B8%D3" },
];

app.get('/api/posts', async (c) => {
  const limit = parseBoundedInteger(c.req.query('limit'), {
    defaultValue: DEFAULT_POST_LIMIT,
    min: MIN_POST_LIMIT,
    max: MAX_POST_LIMIT,
    fieldName: 'limit',
  });
  if ('error' in limit) {
    return c.json({ success: false, error: limit.error }, 400);
  }

  const offset = parseBoundedInteger(c.req.query('offset'), {
    defaultValue: MIN_POST_OFFSET,
    min: MIN_POST_OFFSET,
    max: 10_000,
    fieldName: 'offset',
  });
  if ('error' in offset) {
    return c.json({ success: false, error: offset.error }, 400);
  }

  const requestedSources = (c.req.query('sources') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const sourceOrder = getOrderedSourceSites(requestedSources);
  const results = await getInterleavedPosts(c.env.DB, {
    limit: limit.value,
    offset: offset.value,
    orderedSources: sourceOrder,
  });

  return c.json({
    success: true,
    results,
    hasMore: results.length === limit.value,
    nextOffset: offset.value + results.length,
  });
});

app.get('/api/posts/:id/detail', async (c) => {
  const postId = parseInt(c.req.param('id'), 10);
  if (Number.isNaN(postId)) {
    return c.json({ success: false, error: 'Invalid post id.' }, 400);
  }

  const post = await c.env.DB.prepare(
    'SELECT * FROM posts WHERE id = ?'
  ).bind(postId).first() as Post | null;

  if (!post) {
    return c.json({ success: false, error: 'Post not found' }, 404);
  }

  // Since text_content or body_html are already there, return directly
  if (post.text_content || post.body_html) {
    const media = parseStoredJson<MediaItem[]>(post.media_json, []);
    const comments = parseStoredJson<CommentItem[]>(post.comments_json, []);
    return c.json({
      success: true,
      result: {
        id: post.id,
        sourceSite: post.source_site,
        title: post.title,
        author: post.author,
        sourceUrl: post.url,
        createdAt: post.created_at || '',
        bodyHtml: post.body_html || '',
        textContent: post.text_content || '',
        media: parseStoredJson<MediaItem[]>(post.media_json, []),
        comments: parseStoredJson<CommentItem[]>(post.comments_json, []),
      },
    });
  }

  try {
    const detail = await fetchPostDetail(post, c.env);
    return c.json({ success: true, result: detail });
  } catch (error: any) {
    if (c.env.ENVIRONMENT === 'development') {
      return c.json({ success: false, error: error.message }, 500);
    }
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.get('/api/trigger-crawler', async (c) => {
  try {
    await handleCrawling(c.env);
    return c.json({ success: true, message: "Crawler triggered successfully." });
  } catch (error: any) {
    const isDevelopment = (c.env.ENVIRONMENT || 'production') === 'development';

    return c.json({
      success: false,
      error: error.message,
      ...(isDevelopment && error?.stack ? { stack: error.stack } : {}),
    }, 500);
  }
});

app.get('/api/crawl-site/:siteId', async (c) => {
  const siteId = c.req.param('siteId');
  const target = TARGETS.find((t) => t.id === siteId);

  if (!target) {
    return c.json({ success: false, error: `Unknown site: ${siteId}` }, 404);
  }

  try {
    console.log(`[Crawler] Fetching ${target.name}...`);
    const response = await fetch(target.url, {
      headers: buildHeaders(c.env, target.url),
    });

    if (!response.ok) {
      return c.json({ success: false, error: `Failed to fetch ${target.name}: ${response.status}` }, 500);
    }

    const html = target.id === 'etoland'
      ? new TextDecoder('euc-kr').decode(await response.arrayBuffer())
      : await response.text();
    const sitePosts = parseSitePosts(target.id, html);
    console.log(`[Crawler] Parsed ${sitePosts.length} posts from ${target.name}`);

    const pendingPosts = await filterPendingPosts(c.env.DB, sitePosts);
    console.log(`[Crawler] ${pendingPosts.length} new posts to fetch detail for`);

    const enrichedPosts = await mapWithConcurrency(
      pendingPosts,
      DETAIL_FETCH_CONCURRENCY,
      async (post) => {
        try {
          const detail = await fetchPostDetail(post, c.env);
          const fallbackThumbnail = post.thumbnail || detail.media.find((item) => item.type === 'image')?.url;
          return {
            ...post,
            title: detail.title || post.title,
            author: detail.author || post.author,
            thumbnail: fallbackThumbnail,
            body_html: detail.bodyHtml,
            text_content: detail.textContent,
            media_json: JSON.stringify(detail.media),
            comments_json: JSON.stringify(detail.comments),
            detail_fetched_at: new Date().toISOString(),
            created_at: normalizeCreatedAt(detail.createdAt || post.created_at),
          } satisfies Post;
        } catch (detailError) {
          console.error(`[Crawler] Failed to fetch detail for ${post.url}:`, detailError);
          return post;
        }
      }
    );

    if (enrichedPosts.length > 0) {
      await insertPostsBatch(c.env.DB, enrichedPosts);
    }

    return c.json({
      success: true,
      site: siteId,
      parsed: sitePosts.length,
      newPosts: pendingPosts.length,
      inserted: enrichedPosts.length,
    });
  } catch (error: any) {
    const isDevelopment = (c.env.ENVIRONMENT || 'production') === 'development';
    return c.json({
      success: false,
      error: error.message,
      ...(isDevelopment && error?.stack ? { stack: error.stack } : {}),
    }, 500);
  }
});

app.get('/api/backfill-missing-details', async (c) => {
  const limit = parseBoundedInteger(c.req.query('limit'), {
    defaultValue: 50,
    min: 1,
    max: 200,
    fieldName: 'limit',
  });
  if ('error' in limit) {
    return c.json({ success: false, error: limit.error }, 400);
  }

  const requestedSources = (c.req.query('sources') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const orderedSources = requestedSources.length > 0
    ? getOrderedSourceSites(requestedSources)
    : TARGETS.map((target) => target.id);

  try {
    const placeholders = orderedSources.map(() => '?').join(', ');
    const { results } = await c.env.DB.prepare(
      `SELECT *
       FROM posts
       WHERE detail_fetched_at IS NULL
         AND source_site IN (${placeholders})
       ORDER BY datetime(COALESCE(created_at, crawled_at)) DESC, id DESC
       LIMIT ?`
    ).bind(...orderedSources, limit.value).all<Post>();

    const targets = results || [];
    const enrichedPosts = await mapWithConcurrency(
      targets,
      DETAIL_FETCH_CONCURRENCY,
      async (post) => {
        try {
          const detail = await fetchPostDetail(post, c.env);
          const fallbackThumbnail =
            post.thumbnail ||
            detail.media.find((item) => item.type === 'image')?.url;

          return {
            ...post,
            title: detail.title || post.title,
            author: detail.author || post.author,
            thumbnail: fallbackThumbnail,
            body_html: detail.bodyHtml,
            text_content: detail.textContent,
            media_json: JSON.stringify(detail.media),
            comments_json: JSON.stringify(detail.comments),
            detail_fetched_at: new Date().toISOString(),
            created_at: normalizeCreatedAt(detail.createdAt || post.created_at),
          } satisfies Post;
        } catch (error) {
          console.error(`[Backfill] Failed to fetch detail for ${post.url}:`, error);
          return post;
        }
      }
    );

    if (enrichedPosts.length > 0) {
      await insertPostsBatch(c.env.DB, enrichedPosts);
    }

    return c.json({
      success: true,
      attempted: targets.length,
      updated: enrichedPosts.filter((post) => post.detail_fetched_at).length,
    });
  } catch (error: any) {
    const isDevelopment = (c.env.ENVIRONMENT || 'production') === 'development';
    return c.json({
      success: false,
      error: error.message,
      ...(isDevelopment && error?.stack ? { stack: error.stack } : {}),
    }, 500);
  }
});

function parseBoundedInteger(
  rawValue: string | undefined,
  options: { defaultValue: number; min: number; max: number; fieldName: string }
): { value: number } | { error: string } {
  if (rawValue === undefined || rawValue === '') {
    return { value: options.defaultValue };
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed)) {
    return { error: `${options.fieldName} must be an integer.` };
  }

  if (parsed < options.min || parsed > options.max) {
    return { error: `${options.fieldName} must be between ${options.min} and ${options.max}.` };
  }

  return { value: parsed };
}

function getOrderedSourceSites(requestedSources: string[]): string[] {
  const knownSites = new Map(TARGETS.map((target) => [target.id, target.name]));
  const sourceIds = requestedSources.length > 0
    ? requestedSources
    : TARGETS.map((target) => target.id);

  return [...new Set(sourceIds)].sort((left, right) => {
    const leftName = knownSites.get(left) || left;
    const rightName = knownSites.get(right) || right;
    return leftName.localeCompare(rightName, 'ko');
  });
}

async function getInterleavedPosts(
  db: D1Database,
  options: { limit: number; offset: number; orderedSources: string[] }
): Promise<Post[]> {
  if (options.orderedSources.length === 0) {
    return [];
  }

  const desiredCount = options.offset + options.limit;
  const perSiteFetchLimit = Math.min(
    POST_FEED_FETCH_CAP_PER_SITE,
    Math.max(
      options.limit,
      Math.ceil(desiredCount / options.orderedSources.length) + 2
    )
  );

  const siteBuckets = new Map<string, Post[]>();
  for (const sourceSite of options.orderedSources) {
    const { results } = await db.prepare(
      `SELECT id, source_site, title, url, author, thumbnail, created_at, crawled_at
       FROM posts
       WHERE source_site = ?
       ORDER BY datetime(COALESCE(created_at, crawled_at)) DESC, id DESC
       LIMIT ?`
    ).bind(sourceSite, perSiteFetchLimit).all<Post>();

    siteBuckets.set(sourceSite, results || []);
  }

  const interleaved: Post[] = [];
  let progressed = true;
  let roundIndex = 0;

  while (progressed && interleaved.length < desiredCount) {
    progressed = false;

    for (const sourceSite of options.orderedSources) {
      const bucket = siteBuckets.get(sourceSite) || [];
      const post = bucket[roundIndex];
      if (!post) {
        continue;
      }

      interleaved.push(post);
      progressed = true;

      if (interleaved.length >= desiredCount) {
        break;
      }
    }

    roundIndex += 1;
  }

  return interleaved.slice(options.offset, options.offset + options.limit);
}

async function insertPostsBatch(db: D1Database, posts: Post[]) {
  if (posts.length === 0) return;
  console.log(`[Batch Insert] Attempting to insert ${posts.length} posts...`);

  const stmt = db.prepare(
    `INSERT INTO posts (
      source_site,
      title,
      url,
      author,
      thumbnail,
      created_at,
      body_html,
      text_content,
      media_json,
      comments_json,
      detail_fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      source_site = excluded.source_site,
      title = excluded.title,
      author = excluded.author,
      thumbnail = CASE
        WHEN excluded.source_site = 'todayhumor' THEN excluded.thumbnail
        ELSE COALESCE(excluded.thumbnail, posts.thumbnail)
      END,
      created_at = COALESCE(excluded.created_at, posts.created_at),
      body_html = COALESCE(excluded.body_html, posts.body_html),
      text_content = COALESCE(excluded.text_content, posts.text_content),
      media_json = COALESCE(excluded.media_json, posts.media_json),
      comments_json = COALESCE(excluded.comments_json, posts.comments_json),
      detail_fetched_at = COALESCE(excluded.detail_fetched_at, posts.detail_fetched_at),
      crawled_at = DATETIME('now', 'localtime')`
  );

  for (let i = 0; i < posts.length; i += DB_BATCH_SIZE) {
    const chunk = posts.slice(i, i + DB_BATCH_SIZE);
    const statements = chunk.map((p) =>
      stmt.bind(
        p.source_site,
        p.title,
        p.url,
        p.author,
        p.thumbnail ?? null,
        p.created_at ?? null,
        p.body_html ?? null,
        p.text_content ?? null,
        p.media_json ?? null,
        p.comments_json ?? null,
        p.detail_fetched_at ?? null,
      )
    );
    let lastError: unknown;
    const chunkNumber = Math.floor(i / DB_BATCH_SIZE) + 1;

    for (let attempt = 1; attempt <= DB_BATCH_RETRY_COUNT + 1; attempt += 1) {
      try {
        await db.batch(statements);
        console.log(`[Batch Insert] Successfully processed chunk ${chunkNumber} on attempt ${attempt}`);
        lastError = undefined;
        break;
      } catch (err) {
        lastError = err;
        console.error(`[Batch Insert] Error on chunk ${chunkNumber}, attempt ${attempt}:`, err);
      }
    }

    if (lastError) {
      throw new Error(
        `[Batch Insert] Failed to persist chunk ${chunkNumber} after ${DB_BATCH_RETRY_COUNT + 1} attempts: ${String(lastError)}`
      );
    }
  }
}

function parseSitePosts(siteId: string, html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  try {
    const $ = load(html);

    if (siteId === 'dogdrip') {
      $('a.title-link[data-document-srl]').each((_, linkElement) => {
        const link = $(linkElement);
        const $row = link.closest('tr');
        const title = link.text().trim();
        const rawUrl = link.attr('href');
        const url = normalizeUrl(rawUrl, 'https://www.dogdrip.net');
        const author =
          $row.find('td.author a').first().text().trim() ||
          $row.find('.author .nickname').first().text().trim() ||
          $row.find('td.author').first().text().trim() ||
          '익명';

        if (!title || !url || url.includes('notice') || seenUrls.has(url)) {
          return;
        }

        seenUrls.add(url);
        posts.push({ source_site: siteId, title, url, author });
      });
    } else if (siteId === 'dcinside') {
      $('.ub-content').each((_, row) => {
        const $row = $(row);
        const numberText = $row.find('.gall_num').first().text().trim();
        const link = $row.find('.gall_tit a[view-msg]').first();
        const title = link.text().trim();
        const url = normalizeUrl(link.attr('href'), 'https://gall.dcinside.com');
        const author =
          $row.find('.gall_writer').attr('data-nick') ||
          $row.find('.gall_writer .nickname em').first().text().trim() ||
          $row.find('.gall_writer').text().trim() ||
          '익명';
        const createdAt =
          normalizeCreatedAt($row.find('.gall_date').attr('title')) ||
          normalizeCreatedAt($row.find('.gall_date').text().trim()) ||
          '';
        const thumbnail = normalizeUrl(
          $row.find('.gall_tit img').first().attr('src') ||
          $row.find('.gall_tit img').first().attr('data-src'),
          'https://gall.dcinside.com'
        );

        if (
          numberText === '공지' ||
          !title ||
          !url ||
          url.startsWith('javascript:') ||
          seenUrls.has(url)
        ) {
          return;
        }

        seenUrls.add(url);
        posts.push({
          source_site: siteId,
          title,
          url,
          author,
          created_at: createdAt,
          thumbnail: thumbnail || undefined,
        });
      });
    } else if (siteId === 'todayhumor') {
      $('table.table_list tr.view').each((_, row) => {
        const $row = $(row);
        const titleLink = $row.find('td.subject a[href*="/board/view.php"]').first();
        const title = titleLink.clone().find('.list_memo_count_span').remove().end().text().trim();
        const url = normalizeUrl(titleLink.attr('href'), 'https://www.todayhumor.co.kr/board/');
        const author = $row.find('td.name').first().text().trim() || '익명';
        const createdAt = normalizeCreatedAt(normalizeTodayhumorDate($row.find('td.date').first().text().trim()));

        if (!title || !url || seenUrls.has(url)) {
          return;
        }

        seenUrls.add(url);
        posts.push({
          source_site: siteId,
          title,
          url,
          author,
          created_at: createdAt,
        });
      });
    } else if (siteId === 'theqoo') {
      $('table.theqoo_board_table tbody tr').each((_, row) => {
        const $row = $(row);
        if ($row.hasClass('notice') || $row.hasClass('notice_expand')) {
          return;
        }

        const titleLink = $row.find('td.title > a').first();
        const title = titleLink.text().trim();
        const url = normalizeUrl(titleLink.attr('href'), 'https://theqoo.net');

        if (!title || !url || seenUrls.has(url)) {
          return;
        }

        seenUrls.add(url);
        posts.push({
          source_site: siteId,
          title,
          url,
          author: '무명의 더쿠',
        });
      });
    } else if (siteId === 'aagag') {
      $('a.article.c.t[href*="/issue/?idx="]').each((_, linkElement) => {
        const link = $(linkElement);
        const title = link.find('span.title').clone().find('.btmlayer').remove().end().text().trim();
        const url = normalizeUrl(link.attr('href'), 'https://aagag.com');
        const thumbStyle = link.find('.thumb').attr('style') || '';
        const thumbnailMatch = thumbStyle.match(/url\(([^)]+)\)/i);
        const thumbnail = normalizeUrl(thumbnailMatch?.[1]?.replace(/^['"]|['"]$/g, ''), 'https://aagag.com');

        if (!title || !url || seenUrls.has(url)) {
          return;
        }

        seenUrls.add(url);
        posts.push({
          source_site: siteId,
          title,
          url,
          author: '익명',
          thumbnail: thumbnail || undefined,
        });
      });
    } else if (siteId === 'ruliweb') {
      $('#best_body .board_list_table tbody tr.table_body').each((_, row) => {
        const $row = $(row);
        const link = $row.find('td.subject a.subject_link').first();
        const title =
          link.find('.subject_inner_text').first().text().trim() ||
          link.find('.text_over').first().text().trim() ||
          link.text().trim();
        const url = normalizeUrl(link.attr('href'), 'https://bbs.ruliweb.com');
        const author = $row.find('td.writer').first().text().trim() || '익명';
        const isHumorBest = url?.includes('/best/board/300143/read/') || false;

        if (!title || !url || !isHumorBest || seenUrls.has(url)) {
          return;
        }

        seenUrls.add(url);
        posts.push({
          source_site: siteId,
          title,
          url,
          author,
          thumbnail: normalizeUrl($row.find('img').first().attr('src'), 'https://bbs.ruliweb.com') || undefined,
        });
      });
    } else if (siteId === 'nate') {
      $('.cntList ul.post_wrap > li').each((_, item) => {
        const $item = $(item);
        const link = $item.find('dt h2 a').first();
        const title = link.attr('title')?.trim() || link.text().trim();
        const url = normalizeUrl(link.attr('href'), 'https://pann.nate.com');
        const thumbnail = normalizeUrl($item.find('.thumb img').attr('src'), 'https://pann.nate.com');

        if (!title || !url || seenUrls.has(url)) {
          return;
        }

        seenUrls.add(url);
        posts.push({
          source_site: siteId,
          title,
          url,
          author: '익명',
          thumbnail: thumbnail || undefined,
        });
      });
    } else if (siteId === 'bobaedream') {
      $('ul.rank > li').each((_, item) => {
        const $item = $(item);
        const link = $item.find('.info > a').first();
        const title = $item.find('.txt .cont').first().text().trim();
        const url = normalizeUrl(link.attr('href'), 'https://m.bobaedream.co.kr');
        const metaBlocks = $item.find('.txt2 .block');
        const author = metaBlocks.length >= 3
          ? $(metaBlocks[1]).text().trim()
          : (metaBlocks.length >= 2 ? $(metaBlocks[0]).text().trim() : '익명');

        if (!title || !url || url.includes('/view?code=') || seenUrls.has(url)) {
          return;
        }

        seenUrls.add(url);
        posts.push({
          source_site: siteId,
          title,
          url,
          author: author || '익명',
        });
      });
    } else if (siteId === 'ppomppu') {
      $('a[href*="view.php?id=humor&no="], a[href*="/zboard/view.php?id=humor&no="]').each((_, element) => {
        const link = $(element);
        const title = link.text().replace(/\s+/g, ' ').trim();
        const url = normalizeUrl(link.attr('href'), 'https://www.ppomppu.co.kr/zboard/');
        const $row = link.closest('tr');
        const author =
          $row.find('td[class*="name"]').first().text().trim() ||
          $row.find('a[href*="member_info"]').first().text().trim() ||
          '익명';
        const createdAt =
          normalizeCreatedAt($row.find('td[class*="date"]').attr('title')) ||
          normalizeCreatedAt($row.find('td[class*="date"]').first().text().trim()) ||
          '';
        const thumbnail = normalizeUrl(
          $row.find('img').first().attr('src') || $row.find('img').first().attr('data-src'),
          'https://www.ppomppu.co.kr'
        );

        if (
          !title ||
          !url ||
          title === '공지' ||
          url.includes('javascript:') ||
          seenUrls.has(url)
        ) {
          return;
        }

        seenUrls.add(url);
        posts.push({
          source_site: siteId,
          title,
          url,
          author,
          created_at: normalizeCreatedAt(createdAt),
          thumbnail: thumbnail || undefined,
        });
      });
    } else if (siteId === 'mlbpark') {
      $('.gather_list > li.items').each((_, element) => {
        const item = $(element);
        const link = item.find('.title a').first();
        const title = link.text().replace(/\s+/g, ' ').trim();
        const url = normalizeUrl(link.attr('href'), 'https://mlbpark.donga.com');
        const author = item.find('.info .user_name').first().text().trim() || '익명';
        const createdAt = normalizeCreatedAt(item.find('.info .date').first().text().trim()) || '';
        const thumbnail = normalizeUrl(item.find('.photo img').attr('src'), 'https://mlbpark.donga.com');

        if (!title || !url || seenUrls.has(url)) {
          return;
        }

        seenUrls.add(url);
        posts.push({
          source_site: siteId,
          title,
          url,
          author,
          created_at: normalizeCreatedAt(createdAt),
          thumbnail: thumbnail || undefined,
        });
      });
    } else if (siteId === 'etoland') {
      $('#mw_basic li.list').each((_, item) => {
        const $item = $(item);
        const link = $item.find('.subject a.subject_a').first();
        const title = link.text().replace(/\s+/g, ' ').trim();
        const url = normalizeUrl(link.attr('href'), 'https://www.etoland.co.kr');
        const authorNode = $item.find('.writer .member').first();
        const dateNode = $item.find('.datetime').first();
        const author = authorNode.text().trim() || '익명';
        const createdAt = normalizeCreatedAt(dateNode.text().replace(/\s+/g, ' ').trim());

        if (
          !title ||
          !url ||
          !url.includes('bo_table=etohumor07') ||
          !url.includes('wr_id=') ||
          url.includes('tb_tap=') ||
          !authorNode.length ||
          !dateNode.length ||
          seenUrls.has(url)
        ) {
          return;
        }

        seenUrls.add(url);
        posts.push({
          source_site: siteId,
          title,
          url,
          author,
          created_at: createdAt,
        });
      });
    }
  } catch (error) {
     console.error(`Parsing Error for ${siteId}:`, error);
  }
  return posts;
}

async function handleCrawling(env: Bindings) {
  for (const target of TARGETS) {
    try {
      console.log(`[Crawler] Fetching ${target.name}...`);
      const response = await fetch(target.url, {
        headers: buildHeaders(env, target.url),
      });

      if (!response.ok) {
        console.error(`[Crawler] Failed to fetch ${target.name}: ${response.status}`);
        continue;
      }

      const html = target.id === 'etoland'
        ? new TextDecoder('euc-kr').decode(await response.arrayBuffer())
        : await response.text();
      const sitePosts = parseSitePosts(target.id, html);
      console.log(`[Crawler] Parsed ${sitePosts.length} posts from ${target.name}`);

      const pendingPosts = await filterPendingPosts(env.DB, sitePosts);
      console.log(`[Crawler] ${target.name}: ${pendingPosts.length} posts require detail fetch`);

      if (pendingPosts.length === 0) {
        continue;
      }

      const enrichedPosts = await mapWithConcurrency(
        pendingPosts,
        DETAIL_FETCH_CONCURRENCY,
        async (post) => {
          try {
            const detail = await fetchPostDetail(post, env);
            const fallbackThumbnail =
              post.thumbnail ||
              detail.media.find((item) => item.type === 'image')?.url;
            return {
              ...post,
              title: detail.title || post.title,
              author: detail.author || post.author,
              thumbnail: fallbackThumbnail,
              body_html: detail.bodyHtml,
              text_content: detail.textContent,
              media_json: JSON.stringify(detail.media),
              comments_json: JSON.stringify(detail.comments),
              detail_fetched_at: new Date().toISOString(),
              created_at: normalizeCreatedAt(detail.createdAt || post.created_at),
            } satisfies Post;
          } catch (detailError) {
            console.error(`[Crawler] Failed to fetch detail for ${post.url}:`, detailError);
            return post;
          }
        }
      );

      await insertPostsBatch(env.DB, enrichedPosts);
    } catch (error) {
      console.error(`[Crawler] Error processing ${target.name}:`, error);
      continue;
    }
  }

  await pruneStoredPosts(env.DB);
}

async function filterPendingPosts(db: D1Database, posts: Post[]): Promise<Post[]> {
  if (posts.length === 0) return [];

  const existing = new Map<string, { detail_fetched_at?: string | null }>();

  for (let i = 0; i < posts.length; i += DB_BATCH_SIZE) {
    const chunk = posts.slice(i, i + DB_BATCH_SIZE);
    const placeholders = chunk.map(() => '?').join(', ');
    const stmt = db.prepare(
      `SELECT url, detail_fetched_at FROM posts WHERE url IN (${placeholders})`
    ).bind(...chunk.map((post) => post.url));
    const result = await stmt.all<{ url: string; detail_fetched_at?: string | null }>();

    for (const row of result.results || []) {
      existing.set(row.url, row);
    }
  }

  return posts.filter((post) => !existing.get(post.url)?.detail_fetched_at);
}

async function pruneStoredPosts(db: D1Database) {
  await db.prepare(
    `DELETE FROM posts WHERE crawled_at < DATETIME('now', 'localtime', ?)`
  ).bind(`-${POST_RETENTION_DAYS} days`).run();

  await db.prepare(
    `DELETE FROM posts WHERE id IN (
      SELECT id FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY source_site
            ORDER BY DATETIME(created_at) DESC, id DESC
          ) AS row_num
        FROM posts
      ) ranked_posts
      WHERE row_num > ?
    )`
  ).bind(MAX_POSTS_PER_SITE).run();
}

async function fetchPostDetail(post: Post, env: Bindings): Promise<PostDetail> {
  if (post.source_site === 'dogdrip') {
    return fetchDogdripDetail(post, env);
  }

  if (post.source_site === 'dcinside') {
    return fetchDcinsideDetail(post, env);
  }

  if (post.source_site === 'todayhumor') {
    return fetchTodayhumorDetail(post, env);
  }

  if (post.source_site === 'theqoo') {
    return fetchTheqooDetail(post, env);
  }

  if (post.source_site === 'aagag') {
    return fetchAagagDetail(post, env);
  }

  if (post.source_site === 'ruliweb') {
    return fetchRuliwebDetail(post, env);
  }

  if (post.source_site === 'nate') {
    return fetchNateDetail(post, env);
  }

  if (post.source_site === 'bobaedream') {
    return fetchBobaedreamDetail(post, env);
  }

  if (post.source_site === 'ppomppu') {
    return fetchPpomppuDetail(post, env);
  }

  if (post.source_site === 'mlbpark') {
    return fetchMlbparkDetail(post, env);
  }

  if (post.source_site === 'etoland') {
    return fetchEtolandDetail(post, env);
  }

  return fetchGenericDetail(post, env);
}

function buildHeaders(env: Bindings, referer?: string): HeadersInit {
  const userAgent = env.USER_AGENTS[Math.floor(Math.random() * env.USER_AGENTS.length)];
  const headers: HeadersInit = {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer || 'https://www.google.com/',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
  };

  if ((referer || '').includes('ppomppu.co.kr')) {
    headers['Sec-Fetch-Dest'] = 'document';
    headers['Sec-Fetch-Mode'] = 'navigate';
    headers['Sec-Fetch-Site'] = 'same-origin';
    headers['Sec-Fetch-User'] = '?1';
  }

  return headers;
}

async function fetchText(url: string, env: Bindings, referer?: string): Promise<{ html: string; headers: Headers }> {
  const response = await fetch(url, {
    headers: buildHeaders(env, referer),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch source: ${response.status}`);
  }

  return {
    html: await response.text(),
    headers: response.headers,
  };
}

async function fetchTextWithEncoding(
  url: string,
  env: Bindings,
  encoding: string,
  referer?: string
): Promise<{ html: string; headers: Headers }> {
  const response = await fetch(url, {
    headers: buildHeaders(env, referer),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch source: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const decoder = new TextDecoder(encoding);

  return {
    html: decoder.decode(buffer),
    headers: response.headers,
  };
}

function normalizeUrl(url: string | undefined, baseUrl: string): string | null {
  if (!url) return null;

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeTodayhumorDate(rawValue: string | undefined): string {
  const value = (rawValue || '').trim();
  if (!value) return '';

  const fullMatch = value.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (fullMatch) {
    const [, year, month, day, hour, minute, second = '00'] = fullMatch;
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  const shortMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (shortMatch) {
    const [, year, month, day, hour, minute] = shortMatch;
    return `20${year}-${month}-${day} ${hour}:${minute}:00`;
  }

  return value;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getKstNow(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '00';

  return new Date(
    `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}+09:00`
  );
}

function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

function normalizeCreatedAt(rawValue: string | undefined): string {
  const value = (rawValue || '').trim();
  if (!value) return '';

  const isoDate = new Date(value);
  if (!Number.isNaN(isoDate.getTime())) {
    return formatDate(isoDate);
  }

  const compact = value.match(/^(\d{4})\.(\d{2})\.(\d{2})[ .(]+(\d{2}):(\d{2})(?::(\d{2}))?\)?$/);
  if (compact) {
    const [, year, month, day, hour, minute, second = '00'] = compact;
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }

  const dotted = value.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (dotted) {
    const [, year, month, day] = dotted;
    return `${year}-${month}-${day} 00:00:00`;
  }

  const dateTime = value.match(/^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})(?:일)?(?:\s+|T)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dateTime) {
    const [, year, month, day, hour, minute, second = '00'] = dateTime;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}:${second}`;
  }

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return `${year}-${month}-${day} 00:00:00`;
  }

  const timeOnly = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnly) {
    const [, hour, minute, second = '00'] = timeOnly;
    const date = getKstNow();
    date.setUTCHours(Number(hour) - 9, Number(minute), Number(second), 0);
    return formatDate(date);
  }

  const relative = value.match(/^(\d{1,2})\s*(초|분|시간|일)전$/);
  if (relative) {
    const [, amountRaw, unit] = relative;
    const amount = Number(amountRaw);
    const date = getKstNow();
    if (unit === '초') date.setUTCSeconds(date.getUTCSeconds() - amount);
    if (unit === '분') date.setUTCMinutes(date.getUTCMinutes() - amount);
    if (unit === '시간') date.setUTCHours(date.getUTCHours() - amount);
    if (unit === '일') date.setUTCDate(date.getUTCDate() - amount);
    return formatDate(date);
  }

  return value;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

function extractMedia($root: Cheerio<Element>, baseUrl: string): MediaItem[] {
  const items: MediaItem[] = [];
  const seen = new Set<string>();
  const imageNodes = $root.find('img').add($root.filter('img'));
  const videoNodes = $root.find('video').add($root.filter('video'));
  const iframeNodes = $root.find('iframe').add($root.filter('iframe'));

  for (let index = 0; index < imageNodes.length; index += 1) {
    const node = imageNodes.eq(index);
    const src = normalizeUrl(
      node.attr('data-original') || node.attr('src') || node.attr('data-src'),
      baseUrl
    );
    if (!src || seen.has(src)) continue;
    seen.add(src);
    items.push({ type: 'image', url: src });
  }

  for (let index = 0; index < videoNodes.length; index += 1) {
    const node = videoNodes.eq(index);
    const src = normalizeUrl(node.attr('src') || node.find('source').attr('src'), baseUrl);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    items.push({ type: 'video', url: src });
  }

  for (let index = 0; index < iframeNodes.length; index += 1) {
    const node = iframeNodes.eq(index);
    const src = normalizeUrl(node.attr('src'), baseUrl);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    items.push({ type: 'video', url: src });
  }

  return items;
}

function extractTextWithBreaks(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function pickFirstContent(
  $: CheerioAPI,
  selectors: string[],
): Cheerio<Element> | null {
  for (const selector of selectors) {
    const match = $(selector).first();
    if (match.length) {
      return match;
    }
  }

  return null;
}

async function fetchGenericDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchText(post.url, env);
  const $ = load(html);

  const candidates = [
    'article',
    '.article',
    '.read_body',
    '.xe_content',
    '.document_',
    '.content',
    '.post-content',
    '.post_content',
    '.entry-content',
    '#article_1',
    '#content',
  ];

  let $content: Cheerio<Element> = $('body');
  for (const selector of candidates) {
    const match = $(selector).first();
    if (match.length) {
      $content = match;
      break;
    }
  }

  const bodyHtml = ($content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title: post.title,
    author: post.author,
    sourceUrl: post.url,
    createdAt: post.created_at || '',
    bodyHtml,
    textContent,
    media: extractMedia($content, post.url),
    comments: [],
  };
}

function parseDogdripComments($: CheerioAPI): CommentItem[] {
  const comments: CommentItem[] = [];

  $('.comment-item').each((_, element) => {
    const item = $(element);
    const id = item.attr('id')?.replace(/^comment_/, '') || '';
    const author =
      item.find('.comment-bar a').first().text().trim() ||
      item.find('.comment-bar').first().text().trim() ||
      '익명';
    const bodyHtml = item.find('.xe_content').first().html() || '';
    const body = extractTextWithBreaks(bodyHtml);
    const createdAt = item.find('time').attr('datetime') || item.find('time').text().trim() || '';
    const depth = item.hasClass('depth') ? 1 : 0;

    if (!id || !body) return;

    comments.push({
      id,
      author,
      body,
      createdAt,
      depth,
    });
  });

  return comments;
}

async function fetchDogdripDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchText(post.url, env, 'https://www.dogdrip.net/');
  const $ = load(html);
  const sourceUrl =
    normalizeUrl($('.article-head .fa-link').parent().find('a').attr('href'), 'https://www.dogdrip.net') ||
    normalizeUrl($('link[rel="canonical"]').attr('href'), 'https://www.dogdrip.net') ||
    post.url;

  const title = $('.article-head h4 a').first().text().trim() || post.title;
  const author =
    $('.title-toolbar a[href="#popup_menu_area"]').first().text().trim() ||
    post.author;
  const createdAt =
    $('.title-toolbar .fa-clock').closest('span').next('span').text().trim() ||
    $('.title-toolbar .text-muted').eq(1).text().trim() ||
    post.created_at ||
    '';
  const content = $('.article-wrapper .rhymix_content.xe_content').first().length
    ? $('.article-wrapper .rhymix_content.xe_content').first()
    : $('.rhymix_content.xe_content').first();
  const bodyHtml = (content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);
  const media = extractMedia(content, sourceUrl);
  const comments = parseDogdripComments($);

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author,
    sourceUrl,
    createdAt,
    bodyHtml,
    textContent,
    media,
    comments,
  };
}



function parseStoredJson<T>(rawValue: string | null | undefined, fallback: T): T {
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
}

function parseNateComments($scope: ReturnType<typeof load>): CommentItem[] {
  const comments: CommentItem[] = [];

  $scope('dl.cmt_item').each((_, element) => {
    const item = $scope(element);
    const rawId = item.find('dd.usertxt').attr('id') || item.attr('id') || '';
    const id = rawId.match(/(\d+)/)?.[1] || '';
    const author =
      item.find('.nameui').first().attr('title') ||
      item.find('.nameui').first().text().trim() ||
      '익명';
    const body = item.find('dd.usertxt span').first().text().replace(/\s+/g, ' ').trim();
    const createdAt = item.find('dt i').first().text().trim();

    if (!id || !body) {
      return;
    }

    comments.push({
      id,
      author,
      body,
      createdAt,
      depth: 0,
    });
  });

  return comments;
}

function parseDcComments(rawComments: any[]): CommentItem[] {
  if (!Array.isArray(rawComments)) return [];

  return rawComments.map((comment) => {
    const memo = String(comment.memo || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      id: String(comment.no || ''),
      author: String(comment.name || '익명'),
      body: memo,
      createdAt: String(comment.reg_date || ''),
      depth: Number(comment.depth || 0),
    };
  }).filter((comment) => comment.id && comment.body);
}

async function fetchDcinsideDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html, headers } = await fetchText(post.url, env);
  const $ = load(html);
  const sourceUrl = post.url;

  const title = $('.title_subject').first().text().trim() || post.title;
  const author =
    $('.gallview_head .gall_writer[data-loc="view"] .nickname em').first().text().trim() ||
    $('.gall_writer[data-loc="view"]').first().attr('data-nick') ||
    post.author;
  const createdAt = $('.gall_date').first().attr('title') || post.created_at || '';
  const content = $('.writing_view_box .write_div').first();
  const bodyHtml = (content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);
  const media = extractMedia(content, sourceUrl);

  const gallId = $('#id').attr('value') || new URL(sourceUrl).searchParams.get('id') || '';
  const articleNo = $('#no').attr('value') || new URL(sourceUrl).searchParams.get('no') || '';
  const e_s_n_o = $('#e_s_n_o').attr('value') || '';
  const gallType = $('#_GALLTYPE_').attr('value') || 'G';
  const secretArticleKey = $('#secret_article_key').attr('value') || '';

  let comments: CommentItem[] = [];

  if (gallId && articleNo && e_s_n_o) {
    const cookie = headers.get('set-cookie') || '';
    const cookieHeader = cookie
      .split(/,(?=[^;]+=[^;]+)/)
      .map((item) => item.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    const payload = new URLSearchParams({
      id: gallId,
      no: articleNo,
      cmt_id: gallId,
      cmt_no: articleNo,
      focus_cno: '',
      focus_pno: '',
      e_s_n_o,
      comment_page: '1',
      sort: '',
      prevCnt: '',
      board_type: '',
      _GALLTYPE_: gallType,
      secret_article_key: secretArticleKey,
    });

    const commentResponse = await fetch('https://gall.dcinside.com/board/comment/', {
      method: 'POST',
      headers: {
        ...buildHeaders(env, sourceUrl),
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://gall.dcinside.com',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookieHeader,
      },
      body: payload.toString(),
    });

    if (commentResponse.ok) {
      const commentJson = (await commentResponse.json()) as any;
      comments = parseDcComments(commentJson.comments || []);
    }
  }

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author,
    sourceUrl,
    createdAt,
    bodyHtml,
    textContent,
    media,
    comments,
  };
}

async function fetchTodayhumorDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchText(post.url, env, 'https://www.todayhumor.co.kr/board/list.php?table=humorbest');
  const $ = load(html);
  const sourceUrl =
    normalizeUrl($('link[rel="canonical"]').attr('href'), 'https://www.todayhumor.co.kr') ||
    post.url;
  const title =
    $('.viewSubjectDiv').clone().find('.board_icon_mini').remove().end().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    post.title;
  const author =
    $('#viewPageWriterNameSpan').clone().find('span').remove().end().text().trim() ||
    $('#viewPageWriterNameSpan').attr('name') ||
    post.author;
  const createdAt =
    normalizeCreatedAt(normalizeTodayhumorDate(
      $('.writerInfoContents div').filter((_, element) => $(element).text().includes('베스트   등록시간')).first().text()
        .replace('베스트   등록시간 :', '')
        .trim()
    )) ||
    post.created_at ||
    '';
  const content = $('.viewContent').first();
  const bodyHtml = (content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);
  const media = extractMedia(content, sourceUrl);

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author,
    sourceUrl,
    createdAt,
    bodyHtml,
    textContent,
    media,
    comments: [],
  };
}

async function fetchTheqooDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchText(post.url, env, 'https://theqoo.net/hot/category/512000937');
  const $ = load(html);
  const sourceUrl =
    $('meta[property="og:url"]').attr('content')?.trim() ||
    normalizeUrl($('link[rel="canonical"]').attr('href'), 'https://theqoo.net') ||
    post.url;
  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    post.title;
  const meta = $('.btm_area.clear').first();
  const author =
    meta.find('.side').first().contents().first().text().replace(/\s+/g, ' ').trim() ||
    post.author;
  const createdAt =
    normalizeCreatedAt(meta.find('.side.fr span').first().text().trim()) ||
    post.created_at ||
    '';
  const content = $('.rd_body .xe_content').first();
  const bodyHtml = (content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);
  const media = extractMedia(content, sourceUrl);

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author,
    sourceUrl,
    createdAt,
    bodyHtml,
    textContent,
    media,
    comments: [],
  };
}

function decodeAagagContent(rawContent: string): { bodyHtml: string; textContent: string; media: MediaItem[] } {
  const media: MediaItem[] = [];
  let bodyHtml = rawContent;

  bodyHtml = bodyHtml.replace(/\[sTag\](\{.*?\})\[\/sTag\]/g, (_, jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      const q = parsed?.q;
      if (!q) return '';

      if (parsed?.m === 'video') {
        const videoUrl = parsed?.src || parsed?.url || '';
        if (videoUrl) {
          media.push({ type: 'video', url: videoUrl });
          return `<video src="${videoUrl}" controls></video>`;
        }
        return '';
      }

      const ext =
        parsed?.o?.webp ? 'webp' :
        parsed?.o?.jpg ? 'jpg' :
        parsed?.o?.gif ? 'gif' :
        parsed?.o?.png ? 'png' :
        'jpg';
      const url = `https://i.aagag.com/o/${q}.${ext}`;
      media.push({ type: 'image', url });
      return `<img src="${url}" alt="">`;
    } catch {
      return '';
    }
  });

  bodyHtml = bodyHtml
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n');

  const textContent = extractTextWithBreaks(bodyHtml);
  return { bodyHtml, textContent, media };
}

async function fetchAagagDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchText(post.url, env, 'https://aagag.com/issue/');
  const $ = load(html);
  const sourceUrl =
    $('meta[property="og:url"]').attr('content')?.trim() ||
    post.url;
  const title =
    $('h1.title').first().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    post.title;
  const createdAt =
    normalizeCreatedAt($('meta[property="og:article:published_time"]').attr('content')?.trim()) ||
    post.created_at ||
    '';
  const contentMatch = html.match(/AAGAG_AA\.content = "([\s\S]*?)";/);
  const rawContent = contentMatch?.[1] || '';
  const decoded = decodeAagagContent(rawContent);

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author: post.author || '익명',
    sourceUrl,
    createdAt,
    bodyHtml: decoded.bodyHtml,
    textContent: decoded.textContent || title,
    media: decoded.media.length > 0
      ? decoded.media
      : extractMedia(load(`<div>${decoded.bodyHtml}</div>`)('div').first(), sourceUrl),
    comments: [],
  };
}

async function fetchRuliwebDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchText(post.url, env, 'https://bbs.ruliweb.com/best/humor_only?orderby=regdate&range=');
  const $ = load(html);
  const sourceUrl =
    $('input.article_url').attr('value')?.trim() ||
    $('meta[property="og:url"]').attr('content')?.trim() ||
    normalizeUrl($('link[rel="canonical"]').attr('href'), 'https://bbs.ruliweb.com') ||
    post.url;
  const title =
    $('.subject_text .subject_inner_text').first().text().trim() ||
    $('.subject_text').first().clone().find('.category_text').remove().end().text().trim() ||
    $('meta[property="og:title"]').attr('content')?.trim() ||
    post.title;
  const author =
    $('.user_info .nick').first().text().trim() ||
    $('.mini_profile .nick').first().text().trim() ||
    post.author;
  const createdAt =
    normalizeCreatedAt($('.user_info .regdate').first().text().trim()) ||
    normalizeCreatedAt($('.mini_profile .regdate').first().text().trim()) ||
    post.created_at ||
    '';
  const content = $('.board_main_view .view_content').first();
  const bodyHtml = (content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);
  const media = extractMedia(content, sourceUrl);

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author,
    sourceUrl,
    createdAt,
    bodyHtml,
    textContent,
    media,
    comments: [],
  };
}

async function fetchNateDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchText(post.url, env, 'https://pann.nate.com/talk/ranking');
  const $ = load(html);
  const sourceUrl = post.url;

  const title =
    $('.post-tit-info > h1').first().clone().find('img').remove().end().text().trim() ||
    post.title;
  const author = $('.post-tit-info .info .writer').first().text().trim() || post.author;
  const createdAt = normalizeCreatedAt($('.post-tit-info .info .date').first().text().trim()) || post.created_at || '';
  const content = $('#contentArea').first();
  const bodyHtml = (content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);
  const media = extractMedia(content, sourceUrl).filter((item) => !item.url.includes('pann3.link/'));

  const bestComments = parseNateComments(load($('#bepleDiv').html() || ''));
  const generalComments = parseNateComments(load($('#commentDiv').html() || ''));
  const comments = [...bestComments, ...generalComments].filter((comment, index, list) =>
    list.findIndex((candidate) => candidate.id === comment.id) === index
  );

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author,
    sourceUrl,
    createdAt,
    bodyHtml,
    textContent,
    media,
    comments,
  };
}

function parseBobaedreamComments($: ReturnType<typeof load>): CommentItem[] {
  const comments: CommentItem[] = [];
  const seenKeys = new Set<string>();

  $('.reply-area .reple_body > ul.list > li').each((index, element) => {
    const item = $(element);
    const body = item.find('.con_area .reply').first().text().replace(/\s+/g, ' ').trim();
    const author = item.find('.con_area .util .data4').first().text().trim() || '익명';
    const createdAt = normalizeCreatedAt(item.find('.con_area .util span').eq(1).text().replace(/\u00a0/g, ' ').trim());
    const replyButton = item.find('.util2 button').first().attr('onclick') || '';
    const id = replyButton.match(/view_repl\('(\d+)'/)?.[1] || `comment-${index}`;
    const depth = item.parents('.util4').length > 0 ? 1 : 0;

    if (!body) {
      return;
    }

    const dedupeKey = id !== `comment-${index}` ? `id:${id}` : `${author}|${createdAt}|${body}`;
    if (seenKeys.has(dedupeKey)) {
      return;
    }

    seenKeys.add(dedupeKey);
    comments.push({
      id,
      author,
      body,
      createdAt,
      depth,
    });
  });

  return comments;
}

async function fetchBobaedreamReplyComments(
  env: Bindings,
  sourceUrl: string,
  params: {
    selTb: string;
    mapCD: string;
    mapNO: string;
    ocode: string;
    ono: string;
    strOrder: string;
  },
  parentIds: string[],
): Promise<CommentItem[]> {
  if (parentIds.length === 0) {
    return [];
  }

  const replyLists = await mapWithConcurrency(
    parentIds,
    4,
    async (parentId) => {
      const replyUrl =
        `https://m.bobaedream.co.kr/board/comment_call_best/${params.selTb}/${params.mapCD}/${params.mapNO}/${params.ocode}/${params.ono}` +
        `?secondtime=Y&page=1&strOrder=${params.strOrder}&c_pos=${parentId}`;

      try {
        const { html } = await fetchText(replyUrl, env, sourceUrl);
        const parsed = parseBobaedreamComments(load(html));
        return parsed
          .filter((comment) => comment.id !== parentId)
          .map((comment) => ({ ...comment, depth: 1 }));
      } catch (error) {
        console.error(`[Crawler] Failed to fetch Bobaedream reply comments for ${sourceUrl} / ${parentId}:`, error);
        return [];
      }
    }
  );

  return replyLists.flat();
}

async function fetchBobaedreamDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchText(post.url, env, 'https://m.bobaedream.co.kr/board/new_writing/best');
  const $ = load(html);
  const sourceUrl = post.url;

  const title = $('article.article .article-tit .subject').first().text().trim() || post.title;
  const author = $('article.article .article-tit .util2 .info > span').first().text().trim() || post.author;
  const rawDate = $('article.article .article-tit .util time').first().attr('datetime') || '';
  const rawTime = $('article.article .article-tit .util time').first().text().trim();
  const createdAt = normalizeCreatedAt([rawDate, rawTime].filter(Boolean).join(' ').trim()) || post.created_at || '';
  const content = $('article.article .article-body').first();
  const bodyHtml = (content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);
  const media = extractMedia(content, sourceUrl);

  let comments: CommentItem[] = [];
  const commentTrigger = $('#reply-area .box2 a').first().attr('href') || '';
  const commentMatch = commentTrigger.match(
    /comment_call\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']*)',\s*'([^']*)'\)/
  );

  if (commentMatch) {
    const [, selTb, mapCD, mapNO, ocode, ono, page, strOrder] = commentMatch;
    const commentUrl =
      `https://m.bobaedream.co.kr/board/comment_call/${selTb}/${mapCD}/${mapNO}/${ocode}/${ono}` +
      `?secondtime=Y&page=${page}&strOrder=${strOrder}`;

    try {
      const { html: commentHtml } = await fetchText(commentUrl, env, sourceUrl);
      const rootComments = parseBobaedreamComments(load(commentHtml));
      const replyComments = await fetchBobaedreamReplyComments(
        env,
        sourceUrl,
        { selTb, mapCD, mapNO, ocode, ono, strOrder },
        rootComments.map((comment) => comment.id).filter((id) => /^\d+$/.test(id))
      );
      const seenIds = new Set<string>();
      comments = [...rootComments, ...replyComments].filter((comment) => {
        const key = `${comment.id}|${comment.depth}|${comment.author}|${comment.body}`;
        if (seenIds.has(key)) {
          return false;
        }
        seenIds.add(key);
        return true;
      });
    } catch (error) {
      console.error(`[Crawler] Failed to fetch Bobaedream comments for ${sourceUrl}:`, error);
    }
  }

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author,
    sourceUrl,
    createdAt,
    bodyHtml,
    textContent,
    media,
    comments,
  };
}

function parsePpomppuComments($: ReturnType<typeof load>): CommentItem[] {
  const comments: CommentItem[] = [];

  $('.comment_list tr[id], .comment_wrapper .comment_line').each((_, element) => {
    const item = $(element);
    const id =
      item.attr('id')?.match(/(\d+)/)?.[1] ||
      item.find('[id*="comment"]').attr('id')?.match(/(\d+)/)?.[1] ||
      '';
    const author =
      item.find('.member, .name, .comment_name').first().text().trim() ||
      item.find('a[href*="member_info"]').first().text().trim() ||
      '익명';
    const bodyHtml =
      item.find('.comment_text, .comment_content, .comment').first().html() ||
      '';
    const body = extractTextWithBreaks(bodyHtml);
    const createdAt =
      item.find('.date, .comment_date').first().text().trim() ||
      '';
    const depth = item.hasClass('reples') || item.hasClass('reply') ? 1 : 0;

    if (!id || !body) return;

    comments.push({ id, author, body, createdAt, depth });
  });

  return comments;
}

async function fetchPpomppuDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchText(post.url, env, 'https://www.ppomppu.co.kr/zboard/zboard.php?id=humor');
  const $ = load(html);
  const sourceUrl =
    normalizeUrl($('meta[property="og:url"]').attr('content'), 'https://www.ppomppu.co.kr') ||
    normalizeUrl($('link[rel="canonical"]').attr('href'), 'https://www.ppomppu.co.kr') ||
    post.url;
  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('.board-contents .board-title').first().text().trim() ||
    $('font.view_title2').first().text().trim() ||
    $('title').text().replace(/\s*-\s*뽐뿌.*$/, '').trim() ||
    post.title;
  const author =
    $('.writerInfoContents .nickname').first().text().trim() ||
    $('.board-contents .han').first().text().trim() ||
    $('a[href*="member_info"]').first().text().trim() ||
    post.author;
  const createdAt =
    $('.writerInfoContents .date').first().text().trim() ||
    $('.board-contents .date').first().text().trim() ||
    post.created_at ||
    '';

  const contentSelectors = [
    '.board-contents .board-contents-body',
    '.board-contents .han',
    '#realArticleView',
    '.board-contents',
    'td.board-contents',
    '#bbsContent',
  ];

  const content = pickFirstContent($, contentSelectors);
  if (!content) {
    throw new Error(`Ppomppu content container not found: ${post.url}`);
  }

  content.find('script, style, .ad_area, .board_vote_area, .comment_wrapper, .comment_list').remove();

  const bodyHtml = (content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);
  const media = extractMedia(content, sourceUrl);
  const comments = parsePpomppuComments($);

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author,
    sourceUrl,
    createdAt,
    bodyHtml,
    textContent,
    media,
    comments,
  };
}

function parseEtolandComments($: ReturnType<typeof load>): CommentItem[] {
  const comments: CommentItem[] = [];

  $('#comment_list_wrap a[name^="c_"]').each((_, element) => {
    const anchor = $(element);
    const id = anchor.attr('name')?.replace(/^c_/, '') || '';
    const table = anchor.nextAll('table').filter((_, item) => {
      return $(item).find('.mw_basic_comment_content, .mw_basic_comment_name').length > 0;
    }).first();

    if (!id || !table.length) {
      return;
    }

    const author = table.find('.mw_basic_comment_name .member').first().text().trim() || '익명';
    const createdAt = normalizeCreatedAt(table.find('.mw_basic_comment_datetime').first().text().replace(/\s+/g, ' ').trim());
    const bodyHtml = table.find('.mw_basic_comment_content [id^="view_"]').first().html() || '';
    const body = extractTextWithBreaks(bodyHtml);

    if (!body) {
      return;
    }

    comments.push({
      id,
      author,
      body,
      createdAt,
      depth: 0,
    });
  });

  return comments;
}

async function fetchEtolandDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchTextWithEncoding(post.url, env, 'euc-kr', 'https://www.etoland.co.kr/bbs/board.php?bo_table=etohumor07&sca=%C0%AF%B8%D3');
  const $ = load(html);
  const sourceUrl =
    $('meta[property="og:url"]').attr('content')?.trim() ||
    normalizeUrl($('link[rel="canonical"]').attr('href'), 'https://www.etoland.co.kr') ||
    post.url;
  const title =
    $('.board_title .subject').first().text().trim() ||
    $('.board_title').first().text().replace(/\s+/g, ' ').trim() ||
    $('meta[name="title"]').attr('content')?.trim() ||
    post.title;
  const author =
    $('.board_title .writer .member').first().text().trim() ||
    $('.view_introduce_left_id .member').first().text().trim() ||
    post.author;
  const createdAt =
    normalizeCreatedAt($('.board_title .datetime').first().text().replace(/\s+/g, ' ').trim()) ||
    post.created_at ||
    '';
  const content = $('#view_content').first();

  content.find('script, style').remove();

  const bodyHtml = (content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);
  const media = extractMedia(content, sourceUrl);
  const comments = parseEtolandComments($);

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author,
    sourceUrl,
    createdAt,
    bodyHtml,
    textContent,
    media,
    comments,
  };
}

function parseMlbparkComments($: ReturnType<typeof load>): CommentItem[] {
  const comments: CommentItem[] = [];

  $('.reply_list > div[id^="reply_"]').each((_, element) => {
    const item = $(element);
    const id = item.attr('id')?.replace(/^reply_/, '') || '';
    const author = item.find('.name').first().text().trim() || '익명';
    const createdAt = item.find('.date').first().text().trim() || '';
    const bodyNode = item.find('.re_txt').first().clone();
    bodyNode.find('.name_re').remove();
    const bodyHtml = bodyNode.html() || bodyNode.text().trim() || '';
    const body = extractTextWithBreaks(bodyHtml);
    const depth = item.hasClass('replied') ? 1 : 0;

    if (!id || !body) {
      return;
    }

    comments.push({
      id,
      author,
      body,
      createdAt,
      depth,
    });
  });

  return comments;
}

async function fetchMlbparkDetail(post: Post, env: Bindings): Promise<PostDetail> {
  const { html } = await fetchText(post.url, env, 'https://mlbpark.donga.com/mp/honor.php');
  const $ = load(html);
  const sourceUrl =
    $('meta[property="og:url"]').attr('content')?.trim() ||
    post.url;
  const title =
    $('meta[property="og:title"]').attr('content')?.replace(/\s*:\s*MLBPARK\s*$/, '').trim() ||
    $('.view_title').first().text().trim() ||
    $('.title').first().text().trim() ||
    post.title;
  const author =
    $('.text1 .nick').first().text().trim() ||
    $('.left_cont .nick').first().text().trim() ||
    post.author;
  const createdAt =
    normalizeCreatedAt($('.text3 .val').first().text().trim()) ||
    post.created_at ||
    '';
  const content = $('#contentDetail').first();

  content.find('.tool_cont, script, style').remove();

  const bodyHtml = (content.html() || '').trim();
  const textContent = extractTextWithBreaks(bodyHtml);
  const media = extractMedia(content, sourceUrl);
  const comments = parseMlbparkComments($);

  return {
    id: post.id || 0,
    sourceSite: post.source_site,
    title,
    author,
    sourceUrl,
    createdAt,
    bodyHtml,
    textContent,
    media,
    comments,
  };
}

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    ctx.waitUntil(handleCrawling(env));
  }
};
