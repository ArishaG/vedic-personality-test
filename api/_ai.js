// Optional: AI-personalized reading + action items via the Claude API, grounded
// in the person's actual 36 answers (not just their aggregate percentages).
// Best-effort and cached on the record once generated — entirely skipped if
// ANTHROPIC_API_KEY isn't set, so the app works fine without it.
import Anthropic from '@anthropic-ai/sdk';
import { QUESTIONS, SCALE_LABELS, modeOfQuestion } from './_quiz-data.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export function aiConfigured() {
  return Boolean(getClient());
}

const SYSTEM_PROMPT =
  'You are a warm, insightful guide grounded in the Vedic concept of the three gunas — ' +
  'Sattva (Clarity), Rajas (Drive), and Tamas (Inertia). You are given one person’s full set of answers ' +
  'to a validated 36-statement personality instrument plus their resulting scores. Write a short, ' +
  'genuinely personalized reading and a handful of concrete action items.\n\n' +
  'Rules:\n' +
  '- Ground specific observations in particular statements they strongly agreed or disagreed with ' +
  '— not just their aggregate percentages. Reference the substance of 2-4 specific statements.\n' +
  '- Note the relationship between their three scores (a close secondary quality, a notably low quality, ' +
  'an unusually even balance) where it is genuinely informative.\n' +
  '- Use "Sattva", "Rajas", "Tamas" as the primary names; "Clarity", "Drive", "Inertia" as plain-English asides.\n' +
  '- Action items must be concrete and specific to this person (not generic wellness advice) — things ' +
  'they could actually start this week, tied to what their answers actually show.\n' +
  '- Warm, encouraging, non-clinical tone. No therapy-speak, no astrology-speak, no fortune-telling phrasing.';

function buildAnswerLines(answers) {
  return (answers || []).map(function (v, i) {
    var mode = modeOfQuestion(i + 1);
    var label = SCALE_LABELS[v] || 'answered neutrally to';
    return '- [' + mode + '] "' + QUESTIONS[i] + '" — they ' + label + ' this.';
  }).join('\n');
}

function buildUserPrompt(r) {
  var pct = r.pct || {};
  return (
    'Name: ' + (r.name || 'this person') + '\n' +
    'Age range: ' + (r.age || 'unknown') + '\n' +
    'Dominant quality: ' + r.dominant + '\n' +
    'Overall scores — Sattva: ' + (pct.goodness ?? '?') + '%, Rajas: ' + (pct.passion ?? '?') + '%, Tamas: ' + (pct.ignorance ?? '?') + '%.\n\n' +
    'Their answers to all 36 statements:\n' + buildAnswerLines(r.answers) + '\n\n' +
    'Write their personalized reading (2-4 sentences) and 3-5 action items, grounded in the specific ' +
    'statements above wherever relevant.'
  );
}

const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    reading: { type: 'string', description: '2-4 sentence personalized narrative grounded in specific answers' },
    actionItems: {
      type: 'array',
      items: { type: 'string' },
      description: '3-5 concrete, specific action items tailored to this person'
    }
  },
  required: ['reading', 'actionItems'],
  additionalProperties: false
};

export async function generateInsight(record) {
  const c = getClient();
  if (!c) throw new Error('AI insight is not configured (set ANTHROPIC_API_KEY).');
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: INSIGHT_SCHEMA } },
    messages: [{ role: 'user', content: buildUserPrompt(record) }]
  });
  const block = response.content.find(function (b) { return b.type === 'text'; });
  if (!block) throw new Error('No text content in AI response.');
  return JSON.parse(block.text);
}
