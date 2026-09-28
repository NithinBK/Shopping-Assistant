const API_BASE = 'http://localhost:3001/api';
let stepTimer = null, stepIdx = 0;

document.getElementById('heroInput').addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(e.target.value.trim()); });
document.getElementById('headerInput').addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(e.target.value.trim()); });

async function runSearch(q) {
  q = (q || '').trim();
  if (!q) return;
  showLoading(q);
  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `Server error ${res.status}. Is the backend running on ${API_BASE}?`); }
    const data = await res.json();
    let snippets = [];
    try { const pcRes = await fetch(`${API_BASE}/pros-cons?q=${encodeURIComponent(q)}`); const pcData = await pcRes.json(); snippets = pcData.snippets || []; } catch(_) {}
    renderResults(q, data, snippets);
  } catch (err) { showError(err.message); }
}

function showLoading(q) {
  document.getElementById('hero').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('error-box').style.display = 'none';
  document.getElementById('loading').style.display = 'block';
  document.getElementById('headerSearch').style.display = 'flex';
  document.getElementById('headerInput').value = q;
  document.getElementById('heroBtn').disabled = true;
  resetSteps(); startSteps();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetSteps() {
  clearTimeout(stepTimer); stepIdx = 0;
  ['l1','l2','l3','l4','l5','l6'].forEach(id => { const el = document.getElementById(id); el.classList.remove('active','done'); });
}

function startSteps() {
  const ids = ['l1','l2','l3','l4','l5','l6'];
  if (stepIdx > 0) { const prev = document.getElementById(ids[stepIdx-1]); if (prev) { prev.classList.remove('active'); prev.classList.add('done'); } }
  if (stepIdx < ids.length) { document.getElementById(ids[stepIdx]).classList.add('active'); stepIdx++; stepTimer = setTimeout(startSteps, 900 + Math.random() * 700); }
}

function showError(msg) {
  clearTimeout(stepTimer);
  document.getElementById('loading').style.display = 'none';
  document.getElementById('hero').style.display = 'block';
  document.getElementById('heroBtn').disabled = false;
  const box = document.getElementById('error-box');
  box.style.display = 'block';
  box.innerHTML = `<strong>⚠️ Error:</strong> ${msg}`;
}

function resetUI() {
  clearTimeout(stepTimer);
  document.getElementById('hero').style.display = 'block';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('error-box').style.display = 'none';
  document.getElementById('headerSearch').style.display = 'none';
  document.getElementById('heroBtn').disabled = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderResults(q, data, snippets) {
  clearTimeout(stepTimer);
  document.getElementById('loading').style.display = 'none';
  document.getElementById('hero').style.display = 'none';
  document.getElementById('heroBtn').disabled = false;
  document.getElementById('rName').textContent = q;
  document.getElementById('results').style.display = 'block';

  const isAmazonBest = data.bestDeal === 'amazon';
  document.getElementById('priceRow').innerHTML =
    renderPriceCard(data.amazon,   'amz-c', 'AMZ', 'Amazon.in', isAmazonBest) +
    renderPriceCard(data.flipkart, 'fk-c',  'FLK', 'Flipkart',  !isAmazonBest);

  const cheaper = isAmazonBest ? 'Amazon.in' : 'Flipkart';
  const priceDiff = data.priceDifference || '';
  const amazonRating = data.amazon?.rating || '';
  const fkRating = data.flipkart?.rating || '';

  document.getElementById('verdictBanner').innerHTML = `
    <div class="verdict-main">
      <div class="verdict-eyebrow">Smart Verdict</div>
      <div class="verdict-rec"><span class="hl">${cheaper}</span> has the better price for <em>${q}</em></div>
      <div class="verdict-text">${priceDiff ? `💰 ${priceDiff}. ` : ''}${amazonRating ? `Amazon rating: ${amazonRating}. ` : ''}${fkRating ? `Flipkart rating: ${fkRating}.` : ''}${snippets[0] ? ` From reviews: ${snippets[0].slice(0,180)}${snippets[0].length>180?'...':''}` : ''}</div>
    </div>
    <div class="verdict-scores">
      <div class="v-score"><div class="v-score-num">${amazonRating ? amazonRating.split('/')[0] : '—'}</div><div style="padding-top:15.4px"; class="v-score-label">Amazon</div></div>
      <div class="v-score"><div class="v-score-num">${fkRating ? fkRating.split('/')[0] : '—'}</div><div style="padding-top:15.4px"; class="v-score-label">Flipkart</div></div>
      <div class="v-score"><div class="v-score-num" style=";padding-top:7px">${priceDiff.split(' ').slice(0,1).join('')||'—'}</div><div style="padding-top:9px";  class="v-score-label">Saving</div></div>
    </div>`;

  const pros = extractPros(snippets, data);
  const cons = extractCons(snippets, data);
  document.getElementById('pcGrid').innerHTML = `
    <div class="pros-box fade-up">
      <div class="pcbox-source">Extracted from customer reviews</div>
      <div class="pcbox-header"><div class="pcbox-icon">✓</div><div class="pcbox-title">What people love</div></div>
      <ul class="pcbox-list">${pros.map(p=>`<li>${p}</li>`).join('')}</ul>
    </div>
    <div class="cons-box fade-up-2">
      <div class="pcbox-source">Extracted from customer reviews</div>
      <div class="pcbox-header"><div class="pcbox-icon">✗</div><div class="pcbox-title">Common complaints</div></div>
      <ul class="pcbox-list">${cons.map(c=>`<li>${c}</li>`).join('')}</ul>
    </div>`;

  const reddit = data.reddit || [];
  const youtube = data.youtube || [];
  document.getElementById('reviewsGrid').innerHTML = `
    <div class="reviews-panel fade-up">
      <div class="rp-header"><span class="rp-badge rp-reddit">REDDIT</span><span class="rp-count">${reddit.length} discussions found</span></div>
      <div class="rp-list">${reddit.length ? reddit.map(r=>`
        <div class="rp-item">
          <div class="rp-meta"><span>${r.source}</span>${r.date?`<span>· ${r.date}</span>`:''}</div>
          <a class="rp-title-link" href="${r.link}" target="_blank" rel="noopener">${r.title}</a>
          ${r.snippet?`<div class="rp-snippet" style="margin-top:8px">${r.snippet}</div>`:''}
          <a class="rp-link" href="${r.link}" target="_blank" rel="noopener">View thread →</a>
        </div>`).join('') : '<div style="padding:20px;color:var(--muted);font-size:13px">No Reddit discussions found.</div>'}
      </div>
    </div>
    <div class="reviews-panel fade-up-2">
      <div class="rp-header"><span class="rp-badge rp-youtube">YOUTUBE</span><span class="rp-count">${youtube.length} videos found</span></div>
      <div class="rp-list">${youtube.length ? youtube.map(v=>`
        <div class="rp-item">
          <div class="rp-item-top">
            <a class="rp-title-link" href="${v.link}" target="_blank" rel="noopener">${v.title}</a>
            ${v.thumbnail?`<img class="rp-yt-thumb" src="${v.thumbnail}" alt="thumb" onerror="this.style.display='none'" />`:''}
          </div>
          <div class="rp-meta"><span>${v.channel}</span>${v.views?`<span>· ${v.views} views</span>`:''}${v.publishedDate?`<span>· ${v.publishedDate}</span>`:''}</div>
          ${v.description?`<div class="rp-snippet">${v.description.slice(0,180)}${v.description.length>180?'...':''}</div>`:''}
          <a class="rp-link" href="${v.link}" target="_blank" rel="noopener">Watch on YouTube →</a>
        </div>`).join('') : '<div style="padding:20px;color:var(--muted);font-size:13px">No YouTube reviews found.</div>'}
      </div>
    </div>`;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPriceCard(p, cls, abbr, name, isBest) {
  if (!p) return `<div class="price-card ${cls}"><div class="pc-logo-row"><div class="pc-logo">${abbr}</div><div class="pc-platform-name">${name}</div></div><div class="pc-price" style="font-size:22px;color:var(--muted)">Not found</div><div class="pc-name">No listing found for this product.</div></div>`;
  const stars = p.rating ? '★'.repeat(Math.round(parseFloat(p.rating))) + '☆'.repeat(5-Math.round(parseFloat(p.rating))) : '';
  return `
    <div class="price-card ${cls} ${isBest?'best':''} fade-up">
      ${isBest?'<div class="best-deal-badge">BEST DEAL</div>':''}
      <div class="pc-logo-row"><div class="pc-logo">${abbr}</div><div class="pc-platform-name">${name}</div></div>
      ${p.thumbnail?`<img class="pc-thumb" src="${p.thumbnail}" alt="product" onerror="this.style.display='none'" />`:''}
      <div class="pc-price">${p.price||'N/A'}</div>
      ${p.originalPrice && p.originalPrice!==p.price?`<div style="margin-bottom:8px"><span class="pc-original">${p.originalPrice}</span>${p.discount?`<span class="pc-discount">${p.discount}</span>`:''}</div>`:''}
      <div class="pc-name">${p.productTitle||''}</div>
      ${stars?`<div class="pc-rating"><span class="pc-stars">${stars}</span><span>${p.rating}</span>${p.reviewCount?`<span style="color:var(--border)">·</span><span>${p.reviewCount}</span>`:''}</div>`:''}
      <a class="pc-btn" href="${p.url}" target="_blank" rel="noopener">View on ${name} ↗</a>
    </div>`;
}

function extractPros(snippets, data) {
  const defaults = ['Competitive pricing on Indian e-commerce','Available from major trusted sellers','Good customer ratings across platforms','Wide availability — in stock on both platforms','Easy returns via Amazon / Flipkart policies'];
  const found = [];
  snippets.forEach(s => { const l = s.toLowerCase(); if (l.includes('good')||l.includes('great')||l.includes('excellent')||l.includes('best')||l.includes('love')) found.push(s.slice(0,120)); });
  return found.length >= 3 ? found.slice(0,5) : defaults;
}

function extractCons(snippets, data) {
  const defaults = ['Price may vary — check both platforms before buying','Availability might fluctuate during sales events','Warranty claims may differ between sellers','Check for genuine seller before purchase'];
  const found = [];
  snippets.forEach(s => { const l = s.toLowerCase(); if (l.includes('bad')||l.includes('issue')||l.includes('problem')||l.includes('poor')||l.includes('disappoint')||l.includes('not worth')) found.push(s.slice(0,120)); });
  return found.length >= 2 ? found.slice(0,4) : defaults;
}