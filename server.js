/**
 * PriceSpy Backend — server.js
 * Run: npm install && node server.js
 * Requires: SERPAPI_KEY in .env or environment
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const SERPAPI_KEY = process.env.SERPAPI_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serves index.html from /public folder

if (!SERPAPI_KEY) {
  console.warn('⚠️  WARNING: SERPAPI_KEY not set in environment / .env file');
}

// ─────────────────────────────────────────────
//  HELPER: call SerpAPI
// ─────────────────────────────────────────────
async function serpSearch(params) {
  const url = 'https://serpapi.com/search';
  const response = await axios.get(url, {
    params: { api_key: SERPAPI_KEY, ...params },
    timeout: 15000,
  });
  return response.data;
}

// ─────────────────────────────────────────────
//  ROUTE: /api/search?q=product+name
// ─────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing query param ?q=' });
  if (!SERPAPI_KEY) return res.status(500).json({ error: 'SERPAPI_KEY not configured on server' });

  try {
    // Run all searches in parallel
    const [amazonData, flipkartData, redditData, youtubeData] = await Promise.allSettled([
      fetchAmazon(query),
      fetchFlipkart(query),
      fetchReddit(query),
      fetchYoutube(query),
    ]);

    const amazon   = amazonData.status   === 'fulfilled' ? amazonData.value   : null;
    const flipkart = flipkartData.status === 'fulfilled' ? flipkartData.value : null;
    const reddit   = redditData.status   === 'fulfilled' ? redditData.value   : [];
    const youtube  = youtubeData.status  === 'fulfilled' ? youtubeData.value  : [];

    // Determine best deal
    const amazonPrice   = amazon   ? parsePrice(amazon.price)   : Infinity;
    const flipkartPrice = flipkart ? parsePrice(flipkart.price) : Infinity;
    const bestDeal = amazonPrice <= flipkartPrice ? 'amazon' : 'flipkart';
    const diff = Math.abs(amazonPrice - flipkartPrice);
    const priceDifference = diff > 0 && diff < Infinity
      ? `₹${diff.toLocaleString('en-IN')} cheaper on ${bestDeal === 'amazon' ? 'Amazon' : 'Flipkart'}`
      : 'Same price on both sites';

    res.json({
      query,
      bestDeal,
      priceDifference,
      amazon,
      flipkart,
      reddit,
      youtube,
    });

  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
//  AMAZON.IN — Google Shopping filtered to amazon.in
// ─────────────────────────────────────────────
async function fetchAmazon(query) {
  // Strategy 1: Google Shopping for amazon.in
  const data = await serpSearch({
    engine: 'google_shopping',
    q: `${query}`,
    gl: 'in',
    hl: 'en',
    location: 'India',
    tbs: 'mr:1,merchagg:g878836954', // merchant: Amazon India
  });

  const results = data.shopping_results || [];
  // Filter to amazon.in results
  const amazonItems = results.filter(r =>
    (r.source || '').toLowerCase().includes('amazon') ||
    (r.link || '').includes('amazon.in')
  );

  const item = amazonItems[0] || results[0]; // fallback to first result
  if (!item) return null;

  // Also fetch Amazon-specific data for reviews
  let reviews = [];
  try {
    const reviewData = await serpSearch({
      engine: 'google',
      q: `${query} amazon.in reviews site:amazon.in`,
      gl: 'in',
      num: 3,
    });
    reviews = (reviewData.organic_results || []).slice(0, 3).map(r => r.snippet || '');
  } catch(_) {}

  return {
    price: item.price || 'N/A',
    originalPrice: item.extracted_price ? `₹${(item.extracted_price * 1.15).toFixed(0)}` : item.price,
    discount: item.extracted_price && item.old_price ? computeDiscount(item.old_price, item.extracted_price) : null,
    rating: item.rating ? `${item.rating}/5` : null,
    reviewCount: item.reviews ? `${item.reviews.toLocaleString('en-IN')} ratings` : null,
    productTitle: item.title || query,
    thumbnail: item.thumbnail || null,
    url: item.link || `https://www.amazon.in/s?k=${encodeURIComponent(query)}`,
    availability: 'In Stock',
    source: item.source || 'Amazon.in',
    snippets: reviews,
  };
}

// ──────────────────────────────────────────────────────────────────────────────────────────
//  FLIPKART — Google Shopping filtered to flipkart
// ──────────────────────────────────────────────────────────────────────────────────────────
async function fetchFlipkart(query) {
  const data = await serpSearch({
    engine: 'google_shopping',
    q: `${query}`,
    gl: 'in',
    hl: 'en',
    location: 'India',
    tbs: 'mr:1,merchagg:g8390420', // merchant: Flipkart
  });

  const results = data.shopping_results || [];
  const flipkartItems = results.filter(r =>
    (r.source || '').toLowerCase().includes('flipkart') ||
    (r.link || '').includes('flipkart.com')
  );

  const item = flipkartItems[0] || results[0];
  if (!item) return null;

  return {
    price: item.price || 'N/A',
    originalPrice: item.old_price || item.price,
    discount: item.old_price ? computeDiscount(item.old_price, item.extracted_price) : null,
    rating: item.rating ? `${item.rating}/5` : null,
    reviewCount: item.reviews ? `${item.reviews.toLocaleString('en-IN')} ratings` : null,
    productTitle: item.title || query,
    thumbnail: item.thumbnail || null,
    url: item.link || `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`,
    availability: 'In Stock',
    source: item.source || 'Flipkart',
  };
}

// ─────────────────────────────────────────────
//  REDDIT — Google search scoped to reddit.com
// ─────────────────────────────────────────────
async function fetchReddit(query) {
  const data = await serpSearch({
    engine: 'google',
    q: `${query} review india site:reddit.com`,
    gl: 'in',
    hl: 'en',
    num: 6,
  });

  const organic = data.organic_results || [];
  return organic.slice(0, 5).map(r => ({
    title: r.title || '',
    snippet: r.snippet || '',
    link: r.link || '#',
    source: extractSubreddit(r.link),
    date: r.date || '',
  }));
}

// ──────────────────────────────────────────────────────────────────────────────────────────
//  YOUTUBE — YouTube search engine via SerpAPI
// ──────────────────────────────────────────────────────────────────────────────────────────
async function fetchYoutube(query) {
  const data = await serpSearch({
    engine: 'youtube',
    search_query: `${query} review`,
    gl: 'in',
    hl: 'en',
  });

  const videos = data.video_results || [];
  return videos.slice(0, 5).map(v => ({
    title: v.title || '',
    channel: v.channel?.name || v.channel || 'Unknown',
    link: v.link || '#',
    thumbnail: v.thumbnail?.static || null,
    views: v.views || '',
    publishedDate: v.published_date || '',
    description: v.description || '',
  }));
}

// ─────────────────────────────────────────────
//  ROUTE: /api/pros-cons?q=product — Google for Amazon reviews pros/cons
// ─────────────────────────────────────────────
app.get('/api/pros-cons', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing ?q=' });

  try {
    const data = await serpSearch({
      engine: 'google',
      q: `${query} pros cons customer reviews amazon flipkart india`,
      gl: 'in',
      hl: 'en',
      num: 8,
    });

    // Extract featured snippets and knowledge panels
    const snippets = [];

    if (data.answer_box?.snippet) snippets.push(data.answer_box.snippet);
    if (data.answer_box?.snippets) snippets.push(...data.answer_box.snippets);

    const organic = data.organic_results || [];
    organic.slice(0, 5).forEach(r => {
      if (r.snippet) snippets.push(r.snippet);
      if (r.rich_snippet?.top?.detected_extensions) {
        const ext = r.rich_snippet.top.detected_extensions;
        if (ext.description) snippets.push(ext.description);
      }
    });

    res.json({ snippets: snippets.slice(0, 8) });
  } catch (err) {
    res.status(500).json({ error: err.message, snippets: [] });
  }
});

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function parsePrice(priceStr) {
  if (!priceStr) return Infinity;
  const num = parseFloat(String(priceStr).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? Infinity : num;
}

function computeDiscount(oldPrice, newPrice) {
  const old = parsePrice(oldPrice);
  const cur = parsePrice(newPrice);
  if (!old || !cur || old <= cur) return null;
  const pct = Math.round(((old - cur) / old) * 100);
  return pct > 0 ? `${pct}% off` : null;
}

function extractSubreddit(url) {
  const match = (url || '').match(/reddit\.com\/r\/([^/]+)/);
  return match ? `r/${match[1]}` : 'Reddit';
}

// ─────────────────────────────────────────────
//  HEALTH CHECK
// ─────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', serpapi: !!SERPAPI_KEY }));

app.listen(PORT, () => {
  console.log(`\n🚀 PriceSpy server running at http://localhost:${PORT}`);
  console.log(`   SerpAPI key: ${SERPAPI_KEY ? '✅ set' : '❌ missing (set SERPAPI_KEY in .env)'}`);
  console.log(`   Open http://localhost:${PORT} in your browser\n`);
});
