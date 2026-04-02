// 사이트별 CSS 선택자 설정
export interface SiteSelectors {
  postList: string;
  title: string;
  url: string;
  author: string;
  createdAt?: string;
  thumbnail?: string;
  noticeFilter?: (element: any) => boolean;
}

export const SITE_SELECTORS: Record<string, SiteSelectors> = {
  dogdrip: {
    postList: 'a.title-link[data-document-srl]',
    title: 'a.title-link[data-document-srl]',
    url: 'a.title-link[data-document-srl]',
    author: 'td.author a, .author .nickname, td.author',
  },
  dcinside: {
    postList: '.ub-content',
    title: '.gall_tit a[view-msg]',
    url: '.gall_tit a[view-msg]',
    author: '.gall_writer',
    createdAt: '.gall_date',
    thumbnail: '.gall_tit img',
    noticeFilter: (element) => {
      const numberText = element.find('.gall_num').first().text().trim();
      return numberText === '공지';
    },
  },
  todayhumor: {
    postList: 'table.table_list tr.view',
    title: 'td.subject a[href*="/board/view.php"]',
    url: 'td.subject a[href*="/board/view.php"]',
    author: 'td.name',
    createdAt: 'td.date',
  },
  theqoo: {
    postList: 'table.theqoo_board_table tbody tr',
    title: 'td.title > a',
    url: 'td.title > a',
    author: '익명',
    noticeFilter: (element) => {
      return element.hasClass('notice') || element.hasClass('notice_expand');
    },
  },
  aagag: {
    postList: 'a.article.c.t[href*="/issue/?idx="]',
    title: 'span.title',
    url: 'a.article.c.t[href*="/issue/?idx="]',
    author: '익명',
    thumbnail: '.thumb',
  },
  ruliweb: {
    postList: '#best_body .board_list_table tbody tr.table_body',
    title: 'td.subject a.subject_link',
    url: 'td.subject a.subject_link',
    author: 'td.writer',
    thumbnail: 'img',
  },
  nate: {
    postList: '.cntList ul.post_wrap > li',
    title: 'dt h2 a',
    url: 'dt h2 a',
    author: '익명',
    thumbnail: '.thumb img',
  },
  bobaedream: {
    postList: 'ul.rank > li',
    title: '.txt .cont',
    url: '.info > a',
    author: '.txt2 .block',
  },
  ppomppu: {
    postList: 'a.baseList-title[href*="view.php?id=humor"]',
    title: 'a.baseList-title[href*="view.php?id=humor"]',
    url: 'a.baseList-title[href*="view.php?id=humor"]',
    author: 'td[class*="name"], a[href*="member_info"]',
    createdAt: 'td[class*="date"]',
    thumbnail: 'img',
    noticeFilter: (element) => {
      const title = element.text().replace(/\s+/g, ' ').trim();
      return title === '공지';
    },
  },
  mlbpark: {
    postList: '.gather_list > li.items',
    title: '.title a',
    url: '.title a',
    author: '.info .user_name',
    createdAt: '.info .date',
    thumbnail: '.photo img',
  },
  etoland: {
    postList: '#mw_basic li.list',
    title: '.subject a.subject_a',
    url: '.subject a.subject_a',
    author: '.writer .member',
    createdAt: '.datetime',
  },
};