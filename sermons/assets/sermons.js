const state = {
  data: null,
  activeTag: '',
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

const els = {
  listView: document.querySelector('#list-view'),
  readerView: document.querySelector('#reader-view'),
  search: document.querySelector('#search-input'),
  tagCloud: document.querySelector('#tag-cloud'),
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

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
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

function filteredSermons() {
  const query = state.query.trim().toLowerCase();
  return state.data.sermons.filter(sermon => {
    const tagMatch = !state.activeTag || sermon.tags.includes(state.activeTag);
    const queryMatch = !query || sermon.searchText.includes(query);
    return tagMatch && queryMatch;
  });
}

function renderTags() {
  els.tagCloud.innerHTML = '';

  state.data.tags.forEach(tag => {
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

  els.clearFilter.hidden = !state.activeTag && !state.query;
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
    card.innerHTML = `
      <time datetime="${escapeHtml(sermon.date)}">${escapeHtml(formatDate(sermon.date))}</time>
      <h2>${escapeHtml(sermon.title)}</h2>
      ${sermon.excerpt ? `<p>${escapeHtml(sermon.excerpt)}</p>` : ''}
      <div class="reader-tags">${sermon.tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>
    `;
    card.addEventListener('click', () => openSermon(sermon.path));
    els.sermonList.append(card);
  });
}

function render() {
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
  els.readerTags.innerHTML = sermon.tags.map(tag => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('');
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

  els.clearFilter.addEventListener('click', () => {
    state.activeTag = '';
    state.query = '';
    els.search.value = '';
    render();
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
