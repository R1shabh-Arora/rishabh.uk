const sectionMeta = {
  mustRead: {
    title: 'Must read / watch',
    subtitle: 'Highest-value items first. If you only have a few minutes, start here.'
  },
  worthASkim: {
    title: 'Worth a skim',
    subtitle: 'Useful signal, but not all of it deserves a full deep dive.'
  },
  skipUnlessNiche: {
    title: 'Skip unless niche',
    subtitle: 'Interesting edge cases, but probably not the best use of your time today.'
  }
};

const actionLabelMap = {
  'read now': 'READ NOW',
  skim: 'SKIM',
  skip: 'SKIP',
  watch: 'WATCH',
  'summary is enough': 'SUMMARY ENOUGH'
};

const scoreNoteMap = {
  5: 'Must pay attention',
  4: 'Worth your time',
  3: 'Decent but optional',
  2: 'Low signal',
  1: 'Ignore unless niche'
};

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatDate(dateString) {
  if (!dateString) return 'Unknown time';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return escapeHtml(dateString);
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/London'
  }).format(date);
}

function confidenceClass(value = '') {
  const normalized = String(value).toLowerCase();
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('low')) return 'low';
  return 'medium';
}

function scoreClass(score) {
  return `score-${Number(score) || 0}`;
}

function actionClass(action = '') {
  return slugify(action);
}

function renderTags(tags = []) {
  if (!tags.length) return '';
  return `
    <div class="tag-list">
      ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
    </div>
  `;
}

function renderMetaPills(item, isVideo = false) {
  const pills = [];

  if (item.source && !isVideo) {
    pills.push(`<span class="pill">${escapeHtml(item.source)}</span>`);
  }

  if (item.creator && isVideo) {
    pills.push(`<span class="pill">${escapeHtml(item.creator)}</span>`);
  }

  if (item.category) {
    pills.push(`<span class="pill">${escapeHtml(item.category)}</span>`);
  }

  if (item.basis && isVideo) {
    pills.push(`<span class="pill">${escapeHtml(item.basis)}</span>`);
  }

  if (item.published) {
    pills.push(`<span class="pill">${escapeHtml(formatDate(item.published))}</span>`);
  }

  return pills.join('');
}

function renderActionPill(action = '') {
  const normalized = String(action).toLowerCase();
  return `<span class="action-pill ${actionClass(normalized)}">${escapeHtml(actionLabelMap[normalized] || normalized)}</span>`;
}

function renderScorePill(score) {
  return `<span class="score-pill ${scoreClass(score)}">Signal ${escapeHtml(String(score))}/5</span>`;
}

function renderConfidencePill(confidence = 'medium') {
  return `<span class="confidence-pill ${confidenceClass(confidence)}">${escapeHtml(confidence)} confidence</span>`;
}

function renderNewsCard(item) {
  return `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="item-meta">${renderMetaPills(item)}</div>
          <h3 class="card-title"><a href="${escapeHtml(item.link || '#')}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
        </div>
        <div class="meta-stack">
          ${renderScorePill(item.score)}
          ${renderActionPill(item.action)}
        </div>
      </div>
      <div class="card-copy">
        <p>${escapeHtml(item.summary)}</p>
        <p><strong>Why it matters:</strong> ${escapeHtml(item.whyItMatters)}</p>
        <p><strong>Verdict:</strong> ${escapeHtml(scoreNoteMap[item.score] || 'Worth a look')}</p>
      </div>
      ${renderTags(item.tags)}
    </article>
  `;
}

function renderVideoCard(item) {
  return `
    <article class="card">
      <div class="card-head">
        <div>
          <div class="item-meta">${renderMetaPills(item, true)}</div>
          <h3 class="card-title"><a href="${escapeHtml(item.link || '#')}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a></h3>
        </div>
        <div class="meta-stack">
          ${renderScorePill(item.score)}
          ${renderActionPill(item.action)}
          ${renderConfidencePill(item.confidence)}
        </div>
      </div>
      <div class="card-copy">
        <p>${escapeHtml(item.summary)}</p>
        <p><strong>Worth your time?</strong> ${escapeHtml(item.worthIt)}</p>
      </div>
      ${renderTags(item.tags)}
    </article>
  `;
}

function renderSection(key, items) {
  const meta = sectionMeta[key];
  if (!meta) return '';

  return `
    <section class="panel section">
      <div class="section-header">
        <div>
          <div class="kicker">${escapeHtml(key.toUpperCase())}</div>
          <h2 class="section-title">${escapeHtml(meta.title)}</h2>
          <p class="section-subtitle">${escapeHtml(meta.subtitle)}</p>
        </div>
        <span class="badge"><strong>${items.length}</strong> items</span>
      </div>
      ${items.length ? `<div class="cards-grid">${items.map(renderNewsCard).join('')}</div>` : '<div class="empty-state">No items in this bucket for the current briefing.</div>'}
    </section>
  `;
}

function flattenNews(news = {}) {
  return Object.values(news).flat();
}

function averageScore(items = []) {
  if (!items.length) return '0.0';
  const total = items.reduce((sum, item) => sum + (Number(item.score) || 0), 0);
  return (total / items.length).toFixed(1);
}

export function renderDashboard(data) {
  const news = data.news || {};
  const videos = data.videos || [];
  const allNews = flattenNews(news);
  const totalItems = allNews.length + videos.length;
  const mustReadCount = (news.mustRead || []).length;
  const signalScore = averageScore([...allNews, ...videos]);
  const generatedAt = formatDate(data.meta?.generatedAt);

  return `
    <div class="dashboard">
      <section class="panel hero">
        <div class="hero-inner">
          <div>
            <div class="kicker">${escapeHtml(data.meta?.status || 'LIVE FEED')}</div>
            <h1 class="hero-title">${escapeHtml(data.meta?.title || 'Signal Feed')}<br /><span>${escapeHtml(data.meta?.subtitle || 'Cyber • AI • Watchlist')}</span></h1>
            <p class="hero-subtitle">A curated, opinionated dashboard for filtering cyber, AI, and creator noise into time-worthy signal.</p>
            <div class="badges">
              <span class="badge"><strong>${escapeHtml(data.meta?.window || 'Rolling window')}</strong></span>
              <span class="badge"><strong>${generatedAt}</strong> last refresh</span>
              <span class="badge"><strong>${escapeHtml(data.meta?.refreshSchedule || 'Daily')}</strong></span>
              <span class="badge"><strong>${escapeHtml(data.meta?.confidence || 'mixed confidence')}</strong></span>
            </div>
          </div>
          <div class="hero-side">
            <div class="side-card">
              <h3>Operator note</h3>
              <p>${escapeHtml(data.meta?.operatorNote || 'Aggressively filtered. Fewer items, more signal.')}</p>
            </div>
            <div class="side-card">
              <h3>What this optimizes for</h3>
              <p>${escapeHtml(data.meta?.optimization || 'Practical relevance, technical depth, and whether the item is actually worth your time today.')}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="metrics-grid">
        <div class="metric panel">
          <span class="metric-label">Total signal</span>
          <h2 class="metric-value">${totalItems}</h2>
          <div class="metric-note">news + video items surfaced</div>
        </div>
        <div class="metric panel">
          <span class="metric-label">Must read</span>
          <h2 class="metric-value glow-text">${mustReadCount}</h2>
          <div class="metric-note">highest-priority items</div>
        </div>
        <div class="metric panel">
          <span class="metric-label">Watchlist</span>
          <h2 class="metric-value">${videos.length}</h2>
          <div class="metric-note">creator uploads worth triaging</div>
        </div>
        <div class="metric panel">
          <span class="metric-label">Average signal</span>
          <h2 class="metric-value">${signalScore}/5</h2>
          <div class="metric-note">quality-weighted across surfaced items</div>
        </div>
      </section>

      <section class="panel section">
        <div class="section-header">
          <div>
            <div class="kicker">Executive summary</div>
            <h2 class="section-title">What matters right now</h2>
            <p class="section-subtitle">Compressed takeaways before you decide what to open.</p>
          </div>
        </div>
        <ul class="summary-list">
          ${(data.executiveSummary || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>

      ${renderSection('mustRead', news.mustRead || [])}
      ${renderSection('worthASkim', news.worthASkim || [])}
      ${renderSection('skipUnlessNiche', news.skipUnlessNiche || [])}

      <section class="panel section">
        <div class="section-header">
          <div>
            <div class="kicker">Creator watchlist</div>
            <h2 class="section-title">YouTube triage</h2>
            <p class="section-subtitle">Videos are ranked by likely value, not by upload novelty alone.</p>
          </div>
          <span class="badge"><strong>${videos.length}</strong> videos</span>
        </div>
        ${videos.length ? `<div class="cards-grid">${videos.map(renderVideoCard).join('')}</div>` : '<div class="empty-state">No videos surfaced for this refresh.</div>'}
      </section>

      <section class="panel section">
        <div class="section-header">
          <div>
            <div class="kicker">Blind spots</div>
            <h2 class="section-title">Confidence & constraints</h2>
            <p class="section-subtitle">What the pipeline could not verify cleanly on this pass.</p>
          </div>
        </div>
        <ul class="note-list">
          ${(data.blindSpots || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>

      <section class="panel section">
        <div class="section-header">
          <div>
            <div class="kicker">Sources</div>
            <h2 class="section-title">Feed coverage</h2>
            <p class="section-subtitle">The dashboard is only useful if the intake is broad enough and the filtering is ruthless enough.</p>
          </div>
        </div>
        <ul class="sources-list">
          ${(data.sourcesUsed || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </section>

      <p class="footer-note">Built for Rishabh. Neon outside, ruthless filtering inside.</p>
    </div>
  `;
}
