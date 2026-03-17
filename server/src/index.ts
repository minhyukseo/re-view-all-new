import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  USER_AGENTS: string[];
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

const app = new Hono<{ Bindings: Bindings }>();

const TARGETS = [
  { id: "dogdrip", name: "개드립", url: "https://www.dogdrip.net/?mid=dogdrip&sort_index=popular" },
  { id: "dcinside", name: "디시인사이드", url: "https://gall.dcinside.com/board/lists/?id=dcbest&_dcbest=9" },
];

app.get('/api/posts', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM posts ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).bind(limit, offset).all();

  return c.json({ success: true, results });
});

app.get('/api/trigger-crawler', async (c) => {
  try {
    await handleCrawling(c.env);
    return c.json({ success: true, message: "Crawler triggered successfully." });
  } catch (error: any) {
    return c.json({ success: false, error: error.message, stack: error.stack }, 500);
  }
});

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
    if (siteId === 'dogdrip') {
      const rows = html.split('<tr');
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        let title = '', url = '', author = '';
        
        const titBlockStart = row.indexOf('class="title');
        if (titBlockStart !== -1) {
            const hrefStart = row.indexOf('href="', titBlockStart);
            if (hrefStart !== -1) {
                const hrefEnd = row.indexOf('"', hrefStart + 6);
                url = row.substring(hrefStart + 6, hrefEnd);
                
                const titleStart = row.indexOf('>', hrefEnd);
                const titleEnd = row.indexOf('</a>', titleStart);
                title = row.substring(titleStart + 1, titleEnd).replace(/<[^>]+>/g, '').trim();
            }
        }

        const writerBlockStart = row.indexOf('class="author');
        if (writerBlockStart !== -1) {
            const nickStart = row.indexOf('>', writerBlockStart);
            if (nickStart !== -1) { // Ensure nickStart is valid
                const aStart = row.indexOf('<a', nickStart);
                if (aStart !== -1) {
                    const innerNickStart = row.indexOf('>', aStart);
                    const innerNickEnd = row.indexOf('</a>', innerNickStart);
                    if (innerNickStart !== -1 && innerNickEnd !== -1) { // Ensure innerNickStart and innerNickEnd are valid
                        author = row.substring(innerNickStart + 1, innerNickEnd).replace(/<[^>]+>/g, '').trim();
                    }
                } else {
                    const nickEnd = row.indexOf('</td>', nickStart);
                    if (nickEnd !== -1) { // Ensure nickEnd is valid
                        author = row.substring(nickStart + 1, nickEnd).replace(/<[^>]+>/g, '').trim();
                    }
                }
            }
        }

        if (title && url) {
           if (url.startsWith('/')) url = 'https://www.dogdrip.net' + url;
           else if (!url.startsWith('http')) url = 'https://www.dogdrip.net/' + url;
           if (!url.includes('notice')) posts.push({ source_site: siteId, title, url, author: author || '익명' });
        }
      }
    } else if (siteId === 'dcinside') {
      const rows = html.split('class="ub-content');
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        let title = '', url = '', author = '';
        
        const titBlockStart = row.indexOf('class="gall_tit');
        if (titBlockStart !== -1) {
            const hrefStart = row.indexOf('href="', titBlockStart);
            if (hrefStart !== -1) {
                const hrefEnd = row.indexOf('"', hrefStart + 6);
                url = row.substring(hrefStart + 6, hrefEnd);
                
                const titleStart = row.indexOf('>', hrefEnd);
                const titleEnd = row.indexOf('</a>', titleStart);
                title = row.substring(titleStart + 1, titleEnd).replace(/<[^>]+>/g, '').trim();
            }
        }

        const writerBlockStart = row.indexOf('class="gall_writer');
        if (writerBlockStart !== -1) {
            const nickStart = row.indexOf('data-nick="', writerBlockStart);
            if (nickStart !== -1) {
                const nickEnd = row.indexOf('"', nickStart + 11);
                author = row.substring(nickStart + 11, nickEnd);
            }
        }

        if (title && url) {
             if (url.startsWith('/')) url = 'https://gall.dcinside.com' + url;
             else if (!url.startsWith('http')) url = 'https://gall.dcinside.com/' + url;
             posts.push({ source_site: siteId, title, url, author: author || '익명' });
        }
      }
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

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    ctx.waitUntil(handleCrawling(env));
  }
};
