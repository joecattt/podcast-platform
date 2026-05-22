// Step: AI-generated SEO metadata. Title, description with auto-chapters,
// hashtags, and tags optimized for YouTube search.
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import type { EditPlan, ShowSettings } from '../types.js';

export interface SeoOutput {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
}

export async function generateSeoMetadata(plan: EditPlan, show: ShowSettings): Promise<SeoOutput> {
  if (!config.anthropicApiKey) {
    console.warn('ANTHROPIC_API_KEY not set — using placeholder SEO');
    return placeholder(show);
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  // Build a compact transcript for context (cap to ~12k chars for token budget).
  const transcriptCompact = plan.transcript
    .map((s) => `[${formatTs(s.startSec)} | ${plan.guestNames[s.speaker] ?? s.speaker}] ${s.text}`)
    .join('\n')
    .slice(0, 12000);

  const sys = `You write SEO-optimized YouTube metadata for podcast episodes.

You write:
- TITLE: 50-70 chars, click-worthy without being clickbait, includes the most searched keyword.
- DESCRIPTION: 200-400 words. Opens with a 1-sentence hook. Includes 6-12 timestamped chapters in [00:00] format using the actual moments from the transcript. Ends with hashtags.
- TAGS: 12-20 YouTube tags. Mix of broad (1-2 word) and long-tail (3-5 word) queries that real people search for. Lowercase. No # symbol.
- HASHTAGS: 5-10 hashtags to append to the description. Format like #ai #podcast.

Optimize for: maximum search discoverability, alignment with the actual content, and the show's topic area.

Return strict JSON:
{ "title": "...", "description": "...", "tags": ["..."], "hashtags": ["..."] }`;

  const usr = `Show: ${show.name}
Description: ${show.showDescription ?? '(none provided)'}
Topic keywords: ${(show.topicKeywords ?? []).join(', ')}
Guests: ${Object.values(plan.guestNames).join(', ')}
Duration: ${Math.round(plan.durationSec / 60)} min

Transcript:
${transcriptCompact}`;

  const res = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    system: sys,
    messages: [{ role: 'user', content: usr }],
  });

  const text = res.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('Claude did not return JSON SEO; using placeholder');
    return placeholder(show);
  }
  const parsed = JSON.parse(jsonMatch[0]) as SeoOutput;
  return {
    title: parsed.title?.trim() ?? show.name,
    description: parsed.description?.trim() ?? '',
    tags: (parsed.tags ?? []).slice(0, 25),
    hashtags: (parsed.hashtags ?? []).slice(0, 12),
  };
}

function placeholder(show: ShowSettings): SeoOutput {
  return {
    title: `${show.name} — new episode`,
    description: 'New episode.',
    tags: show.topicKeywords ?? [],
    hashtags: [],
  };
}

function formatTs(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}
