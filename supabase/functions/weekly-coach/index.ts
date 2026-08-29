// Supabase Edge Function (Deno) — the only place GROQ_API_KEY exists. MindLoop
// is a client-only Expo app with no server of its own, so this function is
// what keeps the key out of the app bundle: the client calls it via
// supabase.functions.invoke(), authenticated with the user's own session
// (Supabase verifies that JWT at the gateway before this code even runs).
//
// Uses plain fetch() against Groq's OpenAI-compatible REST endpoint rather
// than the groq-sdk npm package — one less dependency to keep working across
// a Deno runtime, and the raw HTTP contract is easy to read/audit as-is.

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const REVIEWER_MODEL = 'openai/gpt-oss-120b';
const COACH_MODEL = 'openai/gpt-oss-120b';
const TONE_MODEL = 'openai/gpt-oss-20b';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type HabitSummary = { key: string; label: string; unit: string | null; targetValue: number | null };
type LogEntry = { habitKey: string; logDate: string; value: number | null; moodScore: number | null };
type MicroGoal = { habitKey: string; title: string; description: string; action: 'commit' | 'review' };

/** Extracts the first balanced top-level JSON value from a model response
 * that may wrap it in prose or markdown fences — same helper used in
 * InsightPilot/RuleForge's agents, since these are the same reasoning
 * models with the same "respond with ONLY JSON" prompting pattern. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.search(/[{[]/);
  if (start === -1) return candidate.trim();
  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return candidate.slice(start).trim();
}

async function callGroq(
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      max_tokens: maxTokens,
      reasoning_effort: 'low',
      reasoning_format: 'hidden',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `Groq request failed (${res.status})`);
  return data.choices?.[0]?.message?.content ?? '';
}

function summarizeWeek(habits: HabitSummary[], logs: LogEntry[]): string {
  return habits
    .map((h) => {
      const entries = logs.filter((l) => l.habitKey === h.key);
      if (h.key === 'mood') {
        const scores = entries.map((e) => e.moodScore).filter((v): v is number => v != null);
        const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 'no data';
        return `- ${h.label}: ${scores.length} days logged, average mood ${avg}/5`;
      }
      const total = entries.reduce((sum, e) => sum + (e.value ?? 0), 0);
      const target = h.targetValue ? ` (target ${h.targetValue}${h.unit ? ' ' + h.unit : ''}/day)` : '';
      return `- ${h.label}: ${entries.length} days logged, total ${total}${h.unit ? ' ' + h.unit : ''}${target}`;
    })
    .join('\n');
}

async function runReviewer(habits: HabitSummary[], logs: LogEntry[], feedback?: string): Promise<string> {
  const messages = [
    {
      role: 'system',
      content:
        'You are the weekly reviewer agent in a habit-tracking app\'s AI coach. Given a week of habit data, write exactly 2-4 short, warm, specific sentences: name a real trend or win, and gently note anything worth adjusting. No lecturing, no clinical tone, no bullet points — just plain supportive prose, like a friend who noticed you were trying.',
    },
    { role: 'user', content: `This week's habit data:\n${summarizeWeek(habits, logs)}` },
  ];
  if (feedback) {
    messages.push({
      role: 'user',
      content: `A tone-checking pass flagged the last draft: "${feedback}". Write a corrected version.`,
    });
  }
  return (await callGroq(REVIEWER_MODEL, messages, 400)).trim();
}

async function runCoach(review: string, habits: HabitSummary[]): Promise<MicroGoal[]> {
  const content = await callGroq(
    COACH_MODEL,
    [
      {
        role: 'system',
        content: `You are the coach agent in a habit-tracking app. Given a weekly review and the habits being tracked, propose exactly 2-3 concrete "micro-goals" for next week — small, specific, achievable adjustments, not vague resolutions. Respond with ONLY a JSON array, no prose, no markdown fences:
[{"habitKey": <one of the tracked habit keys>, "title": <short, e.g. "10-Minute Wind Down">, "description": <one sentence, concrete action>, "action": "commit" | "review"}]
Use "review" instead of "commit" only when the goal is about noticing/reflecting rather than a concrete commitment.`,
      },
      {
        role: 'user',
        content: `Weekly review: ${review}\n\nTracked habits: ${JSON.stringify(habits)}`,
      },
    ],
    600
  );
  return JSON.parse(extractJson(content));
}

async function runToneCheck(
  review: string,
  goals: MicroGoal[]
): Promise<{ ok: boolean; feedback: string | null }> {
  const content = await callGroq(
    TONE_MODEL,
    [
      {
        role: 'system',
        content:
          'You are a tone-check pass for an AI wellness coach. Given a review and its micro-goals, check ONLY for tone: is it supportive and non-judgmental, or does it read as guilt-tripping, clinical, or preachy? Respond with ONLY JSON: {"ok": boolean, "feedback": string | null}. Set ok=false and give one short actionable note only if the tone is genuinely off — be lenient.',
      },
      { role: 'user', content: JSON.stringify({ review, goals }) },
    ],
    200
  );
  try {
    const parsed = JSON.parse(extractJson(content));
    return { ok: Boolean(parsed.ok), feedback: parsed.feedback ?? null };
  } catch {
    return { ok: true, feedback: null };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY is not configured on this function' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { habits, logs } = (await req.json()) as { habits: HabitSummary[]; logs: LogEntry[] };

    let review = await runReviewer(habits, logs);
    let goals = await runCoach(review, habits);

    const check = await runToneCheck(review, goals);
    if (!check.ok) {
      review = await runReviewer(habits, logs, check.feedback ?? undefined);
      goals = await runCoach(review, habits);
    }

    return new Response(JSON.stringify({ review, goals }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
