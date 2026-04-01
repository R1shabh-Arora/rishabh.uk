#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SIGNAL_DIR = path.join(ROOT, 'signal');
const DATA_DIR = path.join(SIGNAL_DIR, 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archive');

const NOW = new Date();
const NEWS_LOOKBACK_HOURS = 48;
const VIDEO_LOOKBACK_DAYS = 7;

const NEWS_FEEDS = [
  { name: 'Hacker News', type: 'community', url: 'https://news.ycombinator.com/rss' },
  { name: 'r/netsec', type: 'cyber', url: 'https://www.reddit.com/r/netsec/.rss' },
  { name: 'r/cybersecurity', type: 'cyber', url: 'https://www.reddit.com/r/cybersecurity/.rss' },
  { name: 'r/artificial', type: 'ai', url: 'https://www.reddit.com/r/artificial/.rss' },
  { name: 'r/MachineLearning', type: 'ai', url: 'https://www.reddit.com/r/MachineLearning/.rss' },
  { name: 'BleepingComputer', type: 'cyber', url: 'https://www.bleepingcomputer.com/feed/' },
  { name: 'The Record', type: 'cyber', url: 'https://therecord.media/feed' },
  { name: 'TechCrunch AI', type: 'ai', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'Ars Technica', type: 'ai', url: 'https://feeds.arstechnica.com/arstechnica/index' }
];

const YOUTUBE_FEEDS = [
  { name: 'John Hammond', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCVeW9qkBjo3zosnqUbG7CFw' },
  { name: 'NahamSec', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCCZDt7MuC3Hzs6IH4xODLBw' },
  { name: 'David Bombal', url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCP7WmQ_U4GB3K51Od9QvM0w' }
];

const AI_KEYWORDS = [
  'ai', 'agent', 'agents', 'llm', 'model', 'models', 'openai', 'anthropic', 'gemini', 'deepseek',
  'mistral', 'inference', 'reasoning', 'benchmark', 'prompt', 'retrieval', 'rag', 'multimodal', 'vector'
];

const CYBER_KEYWORDS = [
  'cve-', 'actively exploited', 'zero-day', 'zeroday', 'exploit', 'ransomware', 'malware', 'phishing',
  'supply chain', 'backdoor', 'credential', 'breach', 'patch', 'netscaler', 'citrix', 'npm', 'botnet',
  'cisa', 'kev', 'threat', 'vulnerability', 'ddos', 'rat', 'payload', 'compromise', 'attack'
];

const LOW_SIGNAL_PATTERNS = [
  'who is hiring', 'simple questions thread', 'monthly thread', 'hiring thread', 'weekly thread',
  'discussion thread', 'open positions', '[d] simple questions', 'ask hn: who is hiring'
];

function decodeHtml(str = '') {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

function stripTags(str = '') {
  return decodeHtml(str)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirstTag(block, tagNames = []) {
  for (const tag of tagNames) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
    const match = block.match(regex);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function extractAtomLink(block) {
  const hrefMatch = block.match(/<link[^>]+href="([^"]+)"[^>]*\/?/i);
  return hrefMatch?.[1] || '';
}

function extractYoutubeStats(block) {
  const views = block.match(/<media:statistics[^>]+views="(\d+)"/i)?.[1];
  return views ? Number(views) : null;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hoursAgo(date) {
  return (NOW.getTime() - date.getTime()) / (1000 * 60 * 60);
}

function daysAgo(date) {
  return (NOW.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function normalizeTitle(title = '') {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text, patterns) {
  const lower = text.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

function summarize(text, max = 200) {
  const clean = stripTags(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function rawNewsScore(item) {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  let score = item.feedType === 'cyber' ? 1.7 : item.feedType === 'ai' ? 1.5 : 1.1;

  if (includesAny(haystack, LOW_SIGNAL_PATTERNS)) score -= 2.8;
  if (haystack.includes('sentience') || haystack.includes('sentient') || haystack.includes('consciousness')) score -= 2.2;
  if (haystack.includes('we built') || haystack.includes('i built') || haystack.includes('looking for analysts') || haystack.includes('looking for feedback') || haystack.includes('we published') || haystack.includes('company blog')) score -= 1.8;
  if (haystack.includes('actively exploited') || haystack.includes('cve-')) score += 2.2;
  if (haystack.includes('supply chain') || haystack.includes('npm') || haystack.includes('compromise')) score += 1.6;
  else if (haystack.includes('malware') || haystack.includes('ransomware') || haystack.includes('phishing') || haystack.includes('breach')) score += 1.0;
  if (haystack.includes('agent') || haystack.includes('agents') || haystack.includes('retrieval') || haystack.includes('benchmark')) score += 0.8;
  if (item.source === 'BleepingComputer' || item.source === 'The Record') score += 0.6;
  if (item.source === 'TechCrunch AI' || item.source === 'Ars Technica') score += 0.4;
  if (item.source === 'Hacker News') score -= 0.4;
  if (item.source.startsWith('r/')) score -= 1.05;

  if (item.publishedAt) {
    const ageHours = hoursAgo(item.publishedAt);
    if (ageHours <= 12) score += 0.2;
    else if (ageHours > 36) score -= 0.2;
  }

  return Math.max(0.8, Math.min(5, score));
}

function scoreNews(item) {
  return Math.max(1, Math.min(5, Math.round(rawNewsScore(item))));
}

function actionForScore(score) {
  if (score >= 4) return 'read now';
  if (score === 3) return 'skim';
  return 'skip';
}

function whyItMatters(item) {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  if (haystack.includes('actively exploited') || haystack.includes('cve-')) {
    return 'This has direct operational value: it looks like something defenders should patch, track, or triage now rather than casually bookmark.';
  }
  if (haystack.includes('supply chain') || haystack.includes('npm')) {
    return 'Supply-chain stories punch above their weight because they ripple through dependencies, CI, and trust boundaries fast.';
  }
  if (haystack.includes('agent') || haystack.includes('retrieval') || haystack.includes('benchmark')) {
    return 'This matters more for workflow and infrastructure than hype. It says something about where practical AI tooling is actually moving.';
  }
  if (item.feedType === 'cyber') {
    return 'Useful cyber situational awareness. Not every item is a fire drill, but this one still helps track threat or defense movement.';
  }
  if (item.feedType === 'ai') {
    return 'Worth it if you care about AI beyond launch theater — especially tooling, agents, or deployment reality.';
  }
  return 'This surfaced because it had traction plus at least some practical relevance, not just noise.';
}

function tagsForItem(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const tags = [];
  const maybeAdd = (cond, tag) => cond && !tags.includes(tag) && tags.push(tag);
  maybeAdd(text.includes('cve-'), 'CVE');
  maybeAdd(text.includes('actively exploited'), 'active exploitation');
  maybeAdd(text.includes('netscaler') || text.includes('citrix'), 'Citrix');
  maybeAdd(text.includes('supply chain'), 'supply chain');
  maybeAdd(text.includes('npm'), 'npm');
  maybeAdd(text.includes('agent') || text.includes('agents'), 'agents');
  maybeAdd(text.includes('retrieval') || text.includes('rag'), 'retrieval');
  maybeAdd(text.includes('malware'), 'malware');
  maybeAdd(text.includes('ransomware'), 'ransomware');
  maybeAdd(text.includes('botnet') || text.includes('ddos'), 'botnets');
  maybeAdd(item.feedType === 'cyber', 'cyber');
  maybeAdd(item.feedType === 'ai', 'AI');
  return tags.slice(0, 4);
}

function rawVideoScore(item) {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  let score = 1.8;
  if (haystack.includes('supply chain') || haystack.includes('npm')) score += 1.9;
  else if (includesAny(haystack, CYBER_KEYWORDS)) score += 1.1;
  if (includesAny(haystack, AI_KEYWORDS)) score += 0.7;
  if (haystack.includes('course launch') || haystack.includes('livestream')) score -= 0.45;
  if (haystack.includes('shorts/') || haystack.includes('#shorts') || haystack.includes('short')) score -= 0.95;
  if (haystack.includes('bug bounty')) score += 0.35;
  if (item.views && item.views > 25000) score += 0.35;
  if (item.publishedAt) {
    const age = daysAgo(item.publishedAt);
    if (age <= 2) score += 0.15;
    else if (age > 5) score -= 0.15;
  }
  return Math.max(0.8, Math.min(5, score));
}

function scoreVideo(item) {
  return Math.max(1, Math.min(5, Math.round(rawVideoScore(item))));
}

function videoVerdict(item, score) {
  if (score >= 5) return 'Yes. This looks like the strongest creator-side watch in the current feed pull.';
  if (score === 4) return 'Probably worth watching if you want substance instead of just headline awareness.';
  if (score === 3) return 'Decent optional watch, but the summary probably gets you most of the value.';
  return 'Safe to skip unless the exact topic is already on your radar.';
}

function parseFeed(xml, source) {
  const isAtom = xml.includes('<feed');
  const blockRegex = isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi;
  const blocks = xml.match(blockRegex) || [];

  return blocks.map((block) => {
    const title = stripTags(extractFirstTag(block, ['title', 'media:title']));
    const description = stripTags(extractFirstTag(block, ['description', 'summary', 'content', 'media:description']));
    const link = isAtom ? extractAtomLink(block) : stripTags(extractFirstTag(block, ['link']));
    const publishedRaw = extractFirstTag(block, ['pubDate', 'published', 'updated']);
    const publishedAt = parseDate(stripTags(publishedRaw));
    return {
      source: source.name,
      feedType: source.type,
      title,
      description,
      link,
      publishedAt,
      raw: block
    };
  }).filter((item) => item.title && item.link);
}

function parseYouTubeFeed(xml, source) {
  const blocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((block) => {
    const title = stripTags(extractFirstTag(block, ['title', 'media:title']));
    const description = stripTags(extractFirstTag(block, ['media:description', 'summary']));
    const link = extractAtomLink(block);
    const publishedRaw = extractFirstTag(block, ['published', 'updated']);
    const publishedAt = parseDate(stripTags(publishedRaw));
    const views = extractYoutubeStats(block);
    return {
      creator: source.name,
      title,
      description,
      link,
      publishedAt,
      views,
      basis: 'metadata-based'
    };
  }).filter((item) => item.title && item.link);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'RishabhSignalFeed/1.0 (+https://rishabh.uk/signal/)',
      'accept': 'application/rss+xml, application/atom+xml, text/xml, application/xml, text/html;q=0.9, */*;q=0.8'
    }
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

function dedupeByTitle(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = normalizeTitle(item.title).slice(0, 100);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function buildNewsCards(items) {
  return items.map((item) => {
    const rankScore = rawNewsScore(item);
    const score = Math.max(1, Math.min(5, Math.round(rankScore)));
    return {
      title: item.title,
      source: item.source,
      link: item.link,
      category: item.feedType === 'cyber' ? 'Cybersecurity' : item.feedType === 'ai' ? 'AI' : 'Community signal',
      summary: summarize(item.description || item.title, 210),
      whyItMatters: whyItMatters(item),
      score,
      rankScore,
      action: actionForScore(score),
      tags: tagsForItem(item),
      published: item.publishedAt?.toISOString() || null
    };
  }).sort((a, b) => b.rankScore - a.rankScore);
}

function partitionNews(newsCards) {
  const mustRead = [];
  const worthASkim = [];
  const skipUnlessNiche = [];

  for (const item of newsCards) {
    const clean = { ...item };
    delete clean.rankScore;

    if (item.rankScore >= 3.8 && mustRead.length < 4) {
      clean.action = 'read now';
      mustRead.push(clean);
    } else if (item.rankScore >= 2.8 && worthASkim.length < 5) {
      clean.action = 'skim';
      worthASkim.push(clean);
    } else if (skipUnlessNiche.length < 3) {
      clean.action = 'skip';
      skipUnlessNiche.push(clean);
    }
  }

  return { mustRead, worthASkim, skipUnlessNiche };
}

function buildVideos(items) {
  return items.map((item) => {
    const rankScore = rawVideoScore(item);
    const score = Math.max(1, Math.min(5, Math.round(rankScore)));
    const action = score >= 4 ? 'watch' : score === 3 ? 'summary is enough' : 'skip';
    const tags = [];
    const text = `${item.title} ${item.description}`.toLowerCase();
    if (text.includes('npm')) tags.push('npm');
    if (text.includes('supply chain')) tags.push('supply chain');
    if (text.includes('bug bounty')) tags.push('bug bounty');
    if (text.includes('ai')) tags.push('AI');
    if (text.includes('prompt injection')) tags.push('prompt injection');
    if (text.includes('vpn')) tags.push('privacy');
    return {
      creator: item.creator,
      title: item.title,
      link: item.link,
      published: item.publishedAt?.toISOString() || null,
      basis: item.basis,
      summary: summarize(item.description || item.title, 220),
      worthIt: videoVerdict(item, score),
      score,
      rankScore,
      action,
      confidence: 'medium',
      tags: tags.slice(0, 4)
    };
  }).sort((a, b) => b.rankScore - a.rankScore).slice(0, 6).map((item) => {
    const clean = { ...item };
    delete clean.rankScore;
    return clean;
  });
}

async function main() {
  const newsRaw = [];
  const failures = [];

  for (const feed of NEWS_FEEDS) {
    try {
      const xml = await fetchText(feed.url);
      newsRaw.push(...parseFeed(xml, feed));
    } catch (error) {
      failures.push(`${feed.name}: ${error.message}`);
    }
  }

  let filteredNews = newsRaw
    .filter((item) => item.publishedAt && hoursAgo(item.publishedAt) <= NEWS_LOOKBACK_HOURS)
    .filter((item) => !includesAny(`${item.title} ${item.description}`.toLowerCase(), LOW_SIGNAL_PATTERNS));

  filteredNews = filteredNews.filter((item) => {
    if (item.feedType === 'ai') return includesAny(`${item.title} ${item.description}`.toLowerCase(), AI_KEYWORDS);
    if (item.feedType === 'cyber') return true;
    return includesAny(`${item.title} ${item.description}`.toLowerCase(), [...AI_KEYWORDS, ...CYBER_KEYWORDS]);
  });

  filteredNews = dedupeByTitle(filteredNews)
    .sort((a, b) => (rawNewsScore(b) - rawNewsScore(a)) || ((b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0)))
    .slice(0, 12);

  const newsCards = buildNewsCards(filteredNews);
  const news = partitionNews(newsCards);

  const videosRaw = [];
  for (const feed of YOUTUBE_FEEDS) {
    try {
      const xml = await fetchText(feed.url);
      videosRaw.push(...parseYouTubeFeed(xml, feed));
    } catch (error) {
      failures.push(`${feed.name}: ${error.message}`);
    }
  }

  const recentVideos = dedupeByTitle(
    videosRaw.filter((item) => item.publishedAt && daysAgo(item.publishedAt) <= VIDEO_LOOKBACK_DAYS)
  );
  const videos = buildVideos(recentVideos);

  const topNews = [...news.mustRead, ...news.worthASkim].slice(0, 3);
  const executiveSummary = [
    news.mustRead[0]
      ? `${news.mustRead[0].title} is the sharpest operational signal in this refresh.`
      : 'No single must-read item dominated this refresh.',
    videos[0]
      ? `${videos[0].creator} has the strongest creator-side watch right now: ${videos[0].title}.`
      : 'No creator upload clearly beat summary-level triage this time.',
    'The feed is intentionally filtered hard: fewer items, stronger signal, and explicit skips instead of polite clutter.'
  ];

  const output = {
    meta: {
      title: 'Rishabh // Signal Feed',
      subtitle: 'Cybersecurity · AI · YouTube watchlist',
      generatedAt: NOW.toISOString(),
      window: 'Last 24-48 hours (best effort via public feeds)',
      status: 'LIVE // AUTO-REFRESHED',
      refreshSchedule: 'Manual refresh for now (GitHub workflow scope still needed)',
      confidence: failures.length ? 'mixed confidence' : 'medium confidence',
      operatorNote: 'Auto-generated from public feeds. Ruthlessly filtered for time-worthiness, not completeness.',
      optimization: 'Operational cyber signal, useful AI movement, and creator uploads that actually earn attention.'
    },
    executiveSummary,
    news,
    videos,
    blindSpots: [
      'YouTube summaries are metadata-based unless transcript access is explicitly available. This run does not pretend otherwise.',
      'Public RSS and channel feeds are broad but not exhaustive; some great stories miss the cut if they are poorly syndicated.',
      'GitHub-side scheduled auto-refresh is not enabled yet because the current GitHub token could push site code but not workflow files.',
      ...(failures.length ? [`Some sources failed during refresh: ${failures.join('; ')}`] : [])
    ],
    sourcesUsed: [
      'Hacker News RSS',
      'r/netsec RSS',
      'r/cybersecurity RSS',
      'r/artificial RSS',
      'r/MachineLearning RSS',
      'BleepingComputer feed',
      'The Record feed',
      'TechCrunch AI feed',
      'Ars Technica feed',
      'YouTube channel feeds for John Hammond, NahamSec, and David Bombal'
    ]
  };

  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, 'latest.json'), `${JSON.stringify(output, null, 2)}\n`);
  const dateKey = NOW.toISOString().slice(0, 10);
  await fs.writeFile(path.join(ARCHIVE_DIR, `${dateKey}.json`), `${JSON.stringify(output, null, 2)}\n`);

  const summary = {
    generatedAt: output.meta.generatedAt,
    mustRead: news.mustRead.map((item) => item.title),
    topVideo: videos[0]?.title || null,
    failures
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
