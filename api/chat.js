// Sofía & Rohan wedding assistant — chat endpoint (Vercel serverless function).
// POST /api/chat  { messages: [{ role: "user" | "assistant", content: string }, ...] }
// → { reply: string, sources: [{ title, url }] }

import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildSystemPrompt } from "./_prompt.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.MODEL || "claude-sonnet-5-5";
const EFFORT = process.env.EFFORT || "low";
const MAX_SEARCHES = Number(process.env.MAX_SEARCHES || 3);

// Limits that keep costs predictable.
const MAX_MESSAGE_CHARS = 800;   // longest single guest message
const MAX_TURNS = 12;            // history sent to the model
const RATE_LIMIT_PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || 30); // per visitor

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "https://sofiayrohan.com,https://www.sofiayrohan.com")
  .split(",").map((s) => s.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Knowledge base: a published Google Doc (KNOWLEDGE_URL) if set, else the
// bundled knowledge/knowledge.md. Cached for 5 minutes per server instance.
// ---------------------------------------------------------------------------
let kbCache = { text: null, at: 0 };
const KB_TTL_MS = 5 * 60 * 1000;

async function loadKnowledge() {
  if (kbCache.text && Date.now() - kbCache.at < KB_TTL_MS) return kbCache.text;
  let text = null;
  if (process.env.KNOWLEDGE_URL) {
    try {
      const r = await fetch(process.env.KNOWLEDGE_URL, { redirect: "follow" });
      if (r.ok) {
        const t = (await r.text()).trim();
        if (t.length > 200) text = t; // ignore empty or error pages
      }
    } catch (e) {
      console.error("knowledge_url_fetch_failed", String(e));
    }
  }
  if (!text) {
    text = await readFile(path.join(process.cwd(), "knowledge", "knowledge.md"), "utf8");
  }
  kbCache = { text, at: Date.now() };
  return text;
}

// ---------------------------------------------------------------------------
// Best-effort rate limit per visitor (per server instance). The real safety
// net is the monthly spend limit you set in the Claude Console.
// ---------------------------------------------------------------------------
const hits = new Map();
function rateLimited(key) {
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const list = (hits.get(key) || []).filter((t) => t > windowStart);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > RATE_LIMIT_PER_HOUR;
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function cleanMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === "user" ? MAX_MESSAGE_CHARS : 4000).trim() }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_TURNS);
  // The conversation must start and end with the guest.
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  // Merge accidental consecutive turns from the same side.
  const merged = [];
  for (const m of msgs) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else merged.push({ ...m });
  }
  return merged;
}

async function callClaude(body) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// Runs one guest turn, following the API's pause_turn continuation for long searches.
export async function answer(messages, knowledge, today) {
  const body = {
    model: MODEL,
    max_tokens: 2000,
    system: [
      // The knowledge base is identical on every request, so cache it.
      { type: "text", text: buildSystemPrompt(knowledge, today), cache_control: { type: "ephemeral" } },
    ],
    messages: [...messages],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
    output_config: { effort: EFFORT },
    thinking: { type: "between_tools" },
  };

  let result = await callClaude(body);
  // If this model rejects the thinking setting, retry once with the model's default.
  if (!result.ok && result.status === 400 && /thinking/i.test(JSON.stringify(result.data))) {
    delete body.thinking;
    result = await callClaude(body);
  }
  if (!result.ok) {
    const err = new Error("anthropic_error");
    err.status = result.status;
    err.detail = result.data?.error?.message;
    throw err;
  }

  const content = [...(result.data.content || [])];
  let stop = result.data.stop_reason;
  for (let i = 0; i < 3 && stop === "pause_turn"; i++) {
    body.messages = [...messages, { role: "assistant", content: [...content] }];
    const next = await callClaude(body);
    if (!next.ok) break;
    content.push(...(next.data.content || []));
    stop = next.data.stop_reason;
  }

  // Keep only the final answer text (after the last search), plus cited sources.
  const lastToolIdx = content.map((b) => b.type).lastIndexOf("web_search_tool_result");
  const textBlocks = content.slice(lastToolIdx + 1).filter((b) => b.type === "text");
  const reply = textBlocks.map((b) => b.text).join("").trim();

  const sources = [];
  const seen = new Set();
  for (const b of content) {
    for (const c of b.citations || []) {
      if (c.url && !seen.has(c.url)) {
        seen.add(c.url);
        sources.push({ title: c.title || c.url, url: c.url });
      }
    }
  }
  return { reply, sources: sources.slice(0, 4), usage: result.data.usage };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const origin = req.headers.origin;
  const host = req.headers.host;
  const sameOrigin = origin && host && origin.endsWith("//" + host);
  if (origin && !sameOrigin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: "origin_not_allowed" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "missing_api_key" });
  }

  const visitor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (rateLimited(visitor)) return res.status(429).json({ error: "rate_limited" });

  let payload = req.body;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { payload = null; }
  }
  const messages = cleanMessages(payload?.messages);
  if (!messages) return res.status(400).json({ error: "bad_request" });

  try {
    const knowledge = await loadKnowledge();
    const today = new Date().toISOString().slice(0, 10);
    const { reply, sources, usage } = await answer(messages, knowledge, today);
    // Log the question (not the visitor) so you can review what guests ask.
    console.log(JSON.stringify({
      event: "chat",
      question: messages[messages.length - 1].content.slice(0, 300),
      searches: usage?.server_tool_use?.web_search_requests || 0,
      in: usage?.input_tokens, out: usage?.output_tokens,
    }));
    if (!reply) return res.status(502).json({ error: "empty_reply" });
    return res.status(200).json({ reply, sources });
  } catch (e) {
    console.error("chat_failed", e.status, e.detail || String(e));
    const status = e.status === 429 || e.status === 529 ? 503 : 502;
    return res.status(status).json({ error: "upstream_error" });
  }
}
