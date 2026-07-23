const state = {
  data: null,
  activeTag: '',
  activeBook: '',
  activeSeries: '',
  tagsExpanded: false,
  query: '',
  currentPath: ''
};

const scriptElement = document.currentScript || document.querySelector('script[src$="sermons.js"]');
const sermonsBaseUrl = scriptElement ? new URL('../', scriptElement.src) : new URL('/sermons/', window.location.origin);
const resourceRecommendations = [
  {
    title: '以斯拉释经网',
    url: 'https://www.yisila.net/',
    description: '中文释经、讲章与研经资源'
  },
  {
    title: '良友资源库',
    url: 'https://r.729ly.net/',
    description: '华语信仰、讲道与门训资源'
  },
  {
    title: 'Gospel in Life',
    url: 'https://gospelinlife.com/',
    description: '提摩太·凯勒讲道与福音资源'
  }
];
const oldTestamentBooks = [
  '创世记', '出埃及记', '利未记', '民数记', '申命记', '约书亚记', '士师记', '路得记',
  '撒母耳记上', '撒母耳记下', '列王纪上', '列王纪下', '历代志上', '历代志下',
  '以斯拉记', '尼希米记', '以斯帖记', '约伯记', '诗篇', '箴言', '传道书', '雅歌',
  '以赛亚书', '耶利米书', '耶利米哀歌', '以西结书', '但以理书', '何西阿书',
  '约珥书', '阿摩司书', '俄巴底亚书', '约拿书', '弥迦书', '那鸿书', '哈巴谷书',
  '西番雅书', '哈该书', '撒迦利亚书', '玛拉基书'
];
const newTestamentBooks = [
  '马太福音', '马可福音', '路加福音', '约翰福音', '使徒行传', '罗马书',
  '哥林多前书', '哥林多后书', '加拉太书', '以弗所书', '腓立比书', '歌罗西书',
  '帖撒罗尼迦前书', '帖撒罗尼迦后书', '提摩太前书', '提摩太后书', '提多书',
  '腓利门书', '希伯来书', '雅各书', '彼得前书', '彼得后书', '约翰一书',
  '约翰二书', '约翰三书', '犹大书', '启示录'
];

const els = {
  listView: document.querySelector('#list-view'),
  readerView: document.querySelector('#reader-view'),
  search: document.querySelector('#search-input'),
  bookToggle: document.querySelector('#book-toggle'),
  selectedBook: document.querySelector('#selected-book'),
  bookPanel: document.querySelector('#book-panel'),
  bookOptions: document.querySelector('#book-options'),
  clearBook: document.querySelector('#clear-book'),
  seriesFilter: document.querySelector('#series-filter'),
  seriesCloud: document.querySelector('#series-cloud'),
  clearSeries: document.querySelector('#clear-series'),
  tagCloud: document.querySelector('#tag-cloud'),
  toggleTags: document.querySelector('#toggle-tags'),
  clearFilter: document.querySelector('#clear-filter'),
  resultCount: document.querySelector('#result-count'),
  sermonList: document.querySelector('#sermon-list'),
  emptyTemplate: document.querySelector('#empty-template'),
  backToList: document.querySelector('#back-to-list'),
  readerDate: document.querySelector('#reader-date'),
  readerTitle: document.querySelector('#reader-title'),
  readerTags: document.querySelector('#reader-tags'),
  readerContent: document.querySelector('#reader-content')
};

function sermonsUrl(path) {
  return new URL(path, sermonsBaseUrl).toString();
}

function pathFromLocation() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const hashPath = params.get('read');
  if (hashPath) return hashPath;

  const basePath = new URL(sermonsBaseUrl).pathname.replace(/\/$/, '');
  const readPrefix = `${basePath}/read/`;
  if (!window.location.pathname.startsWith(readPrefix)) return '';

  const slug = decodeURIComponent(window.location.pathname.slice(readPrefix.length).replace(/\/$/, ''));
  const sermon = state.data && state.data.sermons.find(item => {
    const sharePath = String(item.sharePath || '').replace(/^read\//, '').replace(/\/$/, '');
    return sharePath === slug;
  });

  return sermon ? sermon.path : '';
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const html = [];
  let paragraph = [];
  let list = null;
  let blockquote = [];
  let code = [];
  let inCode = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    html.push(`<${list.type}>${list.items.map(item => `<li>${inlineMarkdown(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  }

  function flushBlockquote() {
    if (!blockquote.length) return;
    html.push(`<blockquote>${markdownToHtml(blockquote.join('\n'))}</blockquote>`);
    blockquote = [];
  }

  function flushCode() {
    if (!code.length) return;
    html.push(`<pre><code>$&#123;escapeHtml(code.join('\n'))&#125;</code></pre>`);
    code = [];
  }

  lines.forEach(line => {
    if (line.startsWith('```')) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        flushParagraph();
        flushList();
        flushBlockquote();
        inCode = true;
      }
      return;
    }

    if (inCode) {
      code.push(line);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushBlockquote();
      return;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blockquote.push(quote[1]);
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      flushBlockquote();
      const type = unordered ? 'ul' : 'ol';
      if (!list || list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((unordered || ordered)[1]);
      return;
    }

    flushList();
    flushBlockquote();
    paragraph.push(line.trim());
  });

  flushParagraph();
  flushList();
  flushBlockquote();
  flushCode();

  return html.join('\n');
}

function relatedSermonsHtml(related) {
  if (!related || !related.length) return '';

  return `<section class="related-sermons" aria-label="相似讲章">
    <h3>相似讲章</h3>
    <div class="related-list">
      ${related.map(item => `<a class="related-card" href="${sermonsUrl(item.sharePath)}">
        <time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date))}</time>
        <strong>${escapeHtml(item.title)}</strong>
        ${item.tags && item.tags.length ? `<span>${item.tags.map(tag => escapeHtml(tag)).join(' ')}</span>` : ''}
      </a>`).join('')}
    </div>
  </section>`;
}

function resourceRecommendationsHtml() {
  return `<section class="resource-recommendations" aria-label="优秀资源推荐">
    <h3>优秀资源推荐</h3>
    <div class="related-list">
      ${resourceRecommendations.map(item => `<a class="related-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.description)}</span>
      </a>`).join('')}
    </div>
  </section>`;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

function normalizeBookText(value) {
  return String(value).replace(/^#/, '').trim();
}

function sermonHasBook(sermon, book) {
  if (!book) return true;
  return sermon.tags.some(tag => normalizeBookText(tag) === book);
}

function filteredSermons() {
  const query = state.query.trim().toLowerCase();
  return state.data.sermons.filter(sermon => {
    const tagMatch = !state.activeTag || sermon.tags.includes(state.activeTag);
    const bookMatch = sermonHasBook(sermon, state.activeBook);
    const seriesMatch = !state.activeSeries || sermon.series === state.activeSeries;
    const queryMatch = !query || sermon.searchText.includes(query);
    return tagMatch && bookMatch && seriesMatch && queryMatch;
  });
}

function renderBookOptions() {
  els.bookOptions.innerHTML = '';

  [
    { title: '旧约', books: oldTestamentBooks },
    { title: '新约', books: newTestamentBooks }
  ].forEach(group => {
    const section = document.createElement('section');
    section.className = 'book-group';
    section.innerHTML = `<h3>${escapeHtml(group.title)}</h3>`;

    const grid = document.createElement('div');
    grid.className = 'book-grid';

    group.books.forEach(book => {
      const button = document.createElement('button');
      button.className = `book-option${state.activeBook === book ? ' is-active' : ''}`;
      button.type = 'button';
      button.textContent = book;
      button.addEventListener('click', () => {
        state.activeBook = state.activeBook === book ? '' : book;
        els.bookPanel.hidden = true;
        render();
      });
      grid.append(button);
    });

    section.append(grid);
    els.bookOptions.append(section);
  });
}

function renderBookFilter() {
  els.selectedBook.textContent = state.activeBook || '全部书卷';
  els.clearBook.hidden = !state.activeBook;
  els.bookToggle.classList.toggle('is-active', Boolean(state.activeBook));
  els.bookToggle.setAttribute('aria-expanded', String(!els.bookPanel.hidden));
  renderBookOptions();
}

function renderTags() {
  els.tagCloud.innerHTML = '';

  const visibleTags = state.tagsExpanded ? state.data.tags : state.data.tags.slice(0, 12);

  visibleTags.forEach(tag => {
    const button = document.createElement('button');
    button.className = `tag-button${state.activeTag === tag.name ? ' is-active' : ''}`;
    button.type = 'button';
    button.textContent = `${tag.name} ${tag.count}`;
    button.addEventListener('click', () => {
      state.activeTag = state.activeTag === tag.name ? '' : tag.name;
      render();
    });
    els.tagCloud.append(button);
  });

  els.toggleTags.hidden = state.data.tags.length <= 12;
  els.toggleTags.textContent = state.tagsExpanded ? '收起标签' : `更多标签（${state.data.tags.length - 12}）`;
  els.clearFilter.hidden = !state.activeTag && !state.activeBook && !state.activeSeries && !state.query;
}

function renderSeries() {
  els.seriesCloud.innerHTML = '';

  const series = state.data.series || [];
  els.seriesFilter.hidden = !series.length;

  series.forEach(item => {
    const button = document.createElement('button');
    button.className = `tag-button series-button${state.activeSeries === item.name ? ' is-active' : ''}`;
    button.type = 'button';
    button.textContent = `${item.name} ${item.count}`;
    button.addEventListener('click', () => {
      state.activeSeries = state.activeSeries === item.name ? '' : item.name;
      render();
    });
    els.seriesCloud.append(button);
  });

  els.clearSeries.hidden = !state.activeSeries;
}

function renderSermonList() {
  const sermons = filteredSermons();
  els.sermonList.innerHTML = '';
  els.resultCount.textContent = `共 ${sermons.length} 篇讲章`;

  if (!sermons.length) {
    els.sermonList.append(els.emptyTemplate.content.cloneNode(true));
    return;
  }

  sermons.forEach(sermon => {
    const card = document.createElement('button');
    card.className = 'sermon-card';
    card.type = 'button';
    const seriesPill = sermon.series ? `<span class="tag-pill series-pill">${escapeHtml(sermon.series)}</span>` : '';
    card.innerHTML = `
      <time datetime="${escapeHtml(sermon.date)}">${escapeHtml(formatDate(sermon.date))}</time>
      <h2>${escapeHtml(sermon.title)}</h2>
      ${sermon.excerpt ? `<p>${escapeHtml(sermon.excerpt)}</p>` : ''}
      <div class="reader-tags">${seriesPill}${sermon.tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>
    `;
    card.addEventListener('click', () => openSermon(sermon.path));
    els.sermonList.append(card);
  });
}

function render() {
  renderBookFilter();
  renderSeries();
  renderTags();
  renderSermonList();
}

function showList(push = true) {
  state.currentPath = '';
  els.readerView.classList.remove('is-active');
  els.listView.classList.add('is-active');
  document.title = '讲章翻译检索';
  if (push) history.pushState({}, '', sermonsBaseUrl);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function openSermon(path, push = true) {
  const sermon = state.data.sermons.find(item => item.path === path);
  if (!sermon) return showList(push);

  state.currentPath = path;
  const response = await fetch(sermonsUrl(sermon.itemPath));
  if (!response.ok) {
    els.readerContent.innerHTML = '<p>无法读取这篇讲章，请确认讲章 JSON 文件已经发布。</p>';
  } else {
    const item = await response.json();
    els.readerContent.innerHTML = `${markdownToHtml(item.content || '')}${relatedSermonsHtml(item.related)}${resourceRecommendationsHtml()}`;
  }

  els.readerDate.textContent = formatDate(sermon.date);
  els.readerTitle.textContent = sermon.title;
  els.readerTags.innerHTML = `${sermon.series ? `<span class="tag-pill series-pill">${escapeHtml(sermon.series)}</span>` : ''}${sermon.tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}`;
  els.listView.classList.remove('is-active');
  els.readerView.classList.add('is-active');
  document.title = `${sermon.title} - 讲章翻译检索`;

  if (push) {
    history.pushState({ path }, '', sermonsUrl(sermon.sharePath || `#read=${encodeURIComponent(path)}`));
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function boot() {
  const response = await fetch(sermonsUrl('data/sermons.json'));
  state.data = await response.json();

  els.search.addEventListener('input', event => {
    state.query = event.target.value;
    render();
  });

  els.bookToggle.addEventListener('click', () => {
    els.bookPanel.hidden = !els.bookPanel.hidden;
  });

  els.clearBook.addEventListener('click', () => {
    state.activeBook = '';
    els.bookPanel.hidden = true;
    render();
  });

  els.clearSeries.addEventListener('click', () => {
    state.activeSeries = '';
    render();
  });

  els.toggleTags.addEventListener('click', () => {
    state.tagsExpanded = !state.tagsExpanded;
    renderTags();
  });

  els.clearFilter.addEventListener('click', () => {
    state.activeTag = '';
    state.activeBook = '';
    state.activeSeries = '';
    state.query = '';
    els.bookPanel.hidden = true;
    els.search.value = '';
    render();
  });

  document.addEventListener('click', event => {
    if (!els.bookPanel.hidden && !event.target.closest('.book-filter')) {
      els.bookPanel.hidden = true;
    }
  });

  els.backToList.addEventListener('click', () => showList());
  window.addEventListener('popstate', () => {
    const path = pathFromLocation();
    if (path) openSermon(path, false);
    else showList(false);
  });

  render();

  const path = pathFromLocation();
  if (path) openSermon(path, false);
}

boot().catch(error => {
  console.error(error);
  els.sermonList.innerHTML = '<p>讲章索引加载失败，请先运行 <code>npm run sermons:index</code>。</p>';
});
