import { load } from 'cheerio';

export interface Post {
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

export function parseDogdripPosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

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
    posts.push({ source_site: 'dogdrip', title, url, author });
  });

  return posts;
}

export function parseDcinsidePosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

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
      source_site: 'dcinside',
      title,
      url,
      author,
      created_at: createdAt,
      thumbnail: thumbnail || undefined,
    });
  });

  return posts;
}

export function parseTodayhumorPosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

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
      source_site: 'todayhumor',
      title,
      url,
      author,
      created_at: createdAt,
    });
  });

  return posts;
}

export function parseTheqooPosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

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
      source_site: 'theqoo',
      title,
      url,
      author: '무명의 더쿠',
    });
  });

  return posts;
}

export function parseAagagPosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

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
      source_site: 'aagag',
      title,
      url,
      author: '익명',
      thumbnail: thumbnail || undefined,
    });
  });

  return posts;
}

export function parseRuliwebPosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

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
      source_site: 'ruliweb',
      title,
      url,
      author,
      thumbnail: normalizeUrl($row.find('img').first().attr('src'), 'https://bbs.ruliweb.com') || undefined,
    });
  });

  return posts;
}

export function parseNatePosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

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
      source_site: 'nate',
      title,
      url,
      author: '익명',
      thumbnail: thumbnail || undefined,
    });
  });

  return posts;
}

export function parseBobaedreamPosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

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
      source_site: 'bobaedream',
      title,
      url,
      author: author || '익명',
    });
  });

  return posts;
}

export function parsePpomppuPosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

  $('a.baseList-title[href*="view.php?id=humor"]').each((_, element) => {
    const link = $(element);
    const titleSpan = link.find('span').first();
    const title = titleSpan.length ? titleSpan.text().replace(/\s+/g, ' ').trim() : link.text().replace(/\s+/g, ' ').trim();
    const rawUrl = link.attr('href');
    const url = normalizeUrl(rawUrl, 'https://www.ppomppu.co.kr/zboard/');
    
    // 공지사항 필터 (no 파라미터가 낮은 번호인 경우 공지)
    const noMatch = rawUrl?.match(/no=(\d+)/);
    const postNo = noMatch ? parseInt(noMatch[1]) : 0;
    
    if (
      !title ||
      !url ||
      title === '공지' ||
      url.includes('javascript:') ||
      postNo < 100000 || // 공지사항 필터링 (낮은 번호)
      seenUrls.has(url)
    ) {
      return;
    }

    seenUrls.add(url);
    posts.push({
      source_site: 'ppomppu',
      title,
      url,
      author: '익명',
    });
  });

  return posts;
}

export function parseMlbparkPosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

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
      source_site: 'mlbpark',
      title,
      url,
      author,
      created_at: normalizeCreatedAt(createdAt),
      thumbnail: thumbnail || undefined,
    });
  });

  return posts;
}

export function parseEtolandPosts(html: string): Post[] {
  const posts: Post[] = [];
  const seenUrls = new Set<string>();
  const $ = load(html);

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
      source_site: 'etoland',
      title,
      url,
      author,
      created_at: createdAt,
    });
  });

  return posts;
}

export function parseSitePosts(siteId: string, html: string): Post[] {
  try {
    let posts: Post[] = [];
    switch (siteId) {
      case 'dogdrip':
        posts = parseDogdripPosts(html);
        break;
      case 'dcinside':
        posts = parseDcinsidePosts(html);
        break;
      case 'todayhumor':
        posts = parseTodayhumorPosts(html);
        break;
      case 'theqoo':
        posts = parseTheqooPosts(html);
        break;
      case 'aagag':
        posts = parseAagagPosts(html);
        break;
      case 'ruliweb':
        posts = parseRuliwebPosts(html);
        break;
      case 'nate':
        posts = parseNatePosts(html);
        break;
      case 'bobaedream':
        posts = parseBobaedreamPosts(html);
        break;
      case 'ppomppu':
        posts = parsePpomppuPosts(html);
        break;
      case 'mlbpark':
        posts = parseMlbparkPosts(html);
        break;
      case 'etoland':
        posts = parseEtolandPosts(html);
        break;
      default:
        console.error(`[Parser] Unknown site: ${siteId}`);
        return [];
    }
    
    if (posts.length === 0) {
      console.warn(`[Parser] No posts found for ${siteId}. HTML length: ${html.length}. Possible selector mismatch.`);
    } else {
      console.log(`[Parser] Successfully parsed ${posts.length} posts from ${siteId}`);
    }
    
    return posts;
  } catch (error) {
    console.error(`[Parser] Error parsing ${siteId}:`, error);
    return [];
  }
}

// 댓글 파싱 함수들
export interface CommentItem {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  depth: number;
}

export function parseTodayhumorComments(html: string): CommentItem[] {
  const comments: CommentItem[] = [];
  const $ = load(html);

  $('table.comment_table tr.comment_item').each((_, element) => {
    const item = $(element);
    const id = item.attr('id')?.replace('comment_', '') || '';
    const author = item.find('td.comment_name span.name').first().text().trim() || '익명';
    const bodyHtml = item.find('td.comment_content').first().html() || '';
    const body = extractTextWithBreaks(bodyHtml);
    const createdAt = item.find('td.comment_date').first().text().trim() || '';
    const depth = item.hasClass('re_comment') ? 1 : 0;

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

export function parseTheqooComments(html: string): CommentItem[] {
  const comments: CommentItem[] = [];
  const $ = load(html);

  $('div.comment_item').each((_, element) => {
    const item = $(element);
    const id = item.attr('data-comment-srl') || '';
    const author = item.find('.comment_info .nick').first().text().trim() || '익명';
    const bodyHtml = item.find('.comment_content').first().html() || '';
    const body = extractTextWithBreaks(bodyHtml);
    const createdAt = item.find('.comment_info .date').first().text().trim() || '';
    const depth = item.hasClass('re') ? 1 : 0;

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

export function parseAagagComments(html: string): CommentItem[] {
  const comments: CommentItem[] = [];
  const $ = load(html);

  $('div.comment').each((_, element) => {
    const item = $(element);
    const id = item.attr('id')?.replace('comment_', '') || '';
    const author = item.find('.comment_author').first().text().trim() || '익명';
    const bodyHtml = item.find('.comment_body').first().html() || '';
    const body = extractTextWithBreaks(bodyHtml);
    const createdAt = item.find('.comment_date').first().text().trim() || '';
    const depth = 0;

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

export function parseRuliwebComments(html: string): CommentItem[] {
  const comments: CommentItem[] = [];
  const $ = load(html);

  $('table.comment_table tbody tr').each((_, element) => {
    const item = $(element);
    const id = item.attr('id')?.replace('comment_', '') || '';
    const author = item.find('td.writer').first().text().trim() || '익명';
    const bodyHtml = item.find('td.comment').first().html() || '';
    const body = extractTextWithBreaks(bodyHtml);
    const createdAt = item.find('td.date').first().text().trim() || '';
    const depth = item.hasClass('re') ? 1 : 0;

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
