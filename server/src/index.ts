import { Hono } from 'hono';
import { load } from 'cheerio';

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

const DEFAULT_POST_LIMIT = 20;
const MAX_POST_LIMIT = 100;
const MIN_POST_LIMIT = 1;
const MIN_POST_OFFSET = 0;

const TARGETS = [
  { id: "dogdrip", name: "개드립", url: "https://www.dogdrip.net/?mid=dogdrip&sort_index=popular" },
  { id: "dcinside", name: "디시인사이드", url: "https://gall.dcinside.com/board/lists/?id=dcbest&_dcbest=9" },
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

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).bind(limit.value, offset.value).all();

  return c.json({ success: true, results });
});

app.get('/api/posts/:id/detail', async (c) => {
  const postId = parseInt(c.req.param('id'), 10);
  if (Number.isNaN(postId)) {
    return c.json({ success: false, error: 'Invalid post id.' }, 400);
  }

  const post = await c.env.DB.prepare(
    'SELECT * FROM posts WHERE id = ?'
  ).bind(postId).first<Post>();

  if (!post) {
    return c.json({ success: false, error: 'Post not found.' }, 404);
  }

  try {
    const detail = await fetchPostDetail(post, c.env);
    return c.json({ success: true, result: detail });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
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

async function insertPostsBatch(db: D1Database, posts: Post[]) {
  if (posts.length === 0) return;
  console.log(`[Batch Insert] Attempting to insert ${posts.length} posts...`);

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO posts (source_site, title, url, author) VALUES (?, ?, ?, ?)"
  );

  const batchSize = 50;
  for (let i = 0; i < posts.length; i += batchSize) {
    const chunk = posts.slice(i, i + batchSize);
    const statements = chunk.map(p => stmt.bind(p.source_site, p.title, p.url, p.author));
    try {
       await db.batch(statements);
       console.log(`[Batch Insert] Successfully processed chunk ${i / batchSize + 1}`);
    } catch (err) {
       console.error(`[Batch Insert] Error on chunk ${i / batchSize + 1}:`, err);
    }
  }
}

function parseSitePosts(siteId: string, html: string): Post[] {
  const posts: Post[] = [];
  try {
    const $ = load(html);

    if (siteId === 'dogdrip') {
      $('tr').each((_, row) => {
        const $row = $(row);
        const titleCell = $row.find('td.title, .title').first();
        const link = titleCell.find('a').first();
        const title = link.text().trim();
        const rawUrl = link.attr('href');
        const url = normalizeUrl(rawUrl, 'https://www.dogdrip.net');
        const author =
          $row.find('td.author a').first().text().trim() ||
          $row.find('td.author').first().text().trim() ||
          '익명';

        if (!title || !url || url.includes('notice')) {
          return;
        }

        posts.push({ source_site: siteId, title, url, author });
      });
    } else if (siteId === 'dcinside') {
      $('.ub-content').each((_, row) => {
        const $row = $(row);
        const link = $row.find('.gall_tit a').first();
        const title = link.text().trim();
        const url = normalizeUrl(link.attr('href'), 'https://gall.dcinside.com');
        const author =
          $row.find('.gall_writer').attr('data-nick') ||
          $row.find('.gall_writer').text().trim() ||
          '익명';

        if (!title || !url) {
          return;
        }

        posts.push({ source_site: siteId, title, url, author });
      });
    }
  } catch (error) {
     console.error(`Parsing Error for ${siteId}:`, error);
  }
  return posts;
}

async function handleCrawling(env: Bindings) {
  let allPosts: Post[] = [];
  for (const target of TARGETS) {
    try {
      console.log(`[Crawler] Fetching ${target.name}...`);
      const userAgent = env.USER_AGENTS[Math.floor(Math.random() * env.USER_AGENTS.length)];
      
      const response = await fetch(target.url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://www.google.com/'
        }
      });

      if (!response.ok) {
        console.error(`[Crawler] Failed to fetch ${target.name}: ${response.status}`);
        continue;
      }

      const html = await response.text();
      const sitePosts = parseSitePosts(target.id, html);
      console.log(`[Crawler] Parsed ${sitePosts.length} posts from ${target.name}`);
      allPosts = allPosts.concat(sitePosts);
    } catch (error) {
       console.error(`[Crawler] Error processing ${target.name}:`, error);
    }
  }

  if (allPosts.length > 0) {
    await insertPostsBatch(env.DB, allPosts);
  }
}

async function fetchPostDetail(post: Post, env: Bindings): Promise<PostDetail> {
  if (post.source_site === 'dcinside') {
    return fetchDcinsideDetail(post, env);
  }

  return fetchGenericDetail(post, env);
}

function buildHeaders(env: Bindings, referer?: string): HeadersInit {
  const userAgent = env.USER_AGENTS[Math.floor(Math.random() * env.USER_AGENTS.length)];
  return {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': referer || 'https://www.google.com/',
  };
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

function normalizeUrl(url: string | undefined, baseUrl: string): string | null {
  if (!url) return null;

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractMedia($root: ReturnType<typeof load>, baseUrl: string): MediaItem[] {
  const items: MediaItem[] = [];
  const seen = new Set<string>();

  $root('img').each((_, element) => {
    const src = normalizeUrl($root(element).attr('src') || $root(element).attr('data-src'), baseUrl);
    if (!src || seen.has(src)) return;
    seen.add(src);
    items.push({ type: 'image', url: src });
  });

  $root('video').each((_, element) => {
    const src = normalizeUrl($root(element).attr('src') || $root(element).find('source').attr('src'), baseUrl);
    if (!src || seen.has(src)) return;
    seen.add(src);
    items.push({ type: 'video', url: src });
  });

  $root('iframe').each((_, element) => {
    const src = normalizeUrl($root(element).attr('src'), baseUrl);
    if (!src || seen.has(src)) return;
    seen.add(src);
    items.push({ type: 'video', url: src });
  });

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

  let $content = $('body');
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
  const author = $('.gall_writer[data-loc="view"]').first().attr('data-nick') || post.author;
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
      const commentJson = await commentResponse.json<any>();
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

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    ctx.waitUntil(handleCrawling(env));
  }
};
