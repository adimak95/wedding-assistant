// Ask the assistant a question from your terminal, without deploying.
// Usage: ANTHROPIC_API_KEY=sk-ant-... node scripts/ask.js "¿Qué me pongo para la recepción?"

import { readFile } from "node:fs/promises";
import { answer } from "../api/chat.js";

const question = process.argv.slice(2).join(" ");
if (!question) {
  console.error('Usage: node scripts/ask.js "your question"');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY first.");
  process.exit(1);
}

const knowledge = await readFile(new URL("../knowledge/knowledge.md", import.meta.url), "utf8");
const today = new Date().toISOString().slice(0, 10);
const { reply, sources, usage } = await answer([{ role: "user", content: question }], knowledge, today);

console.log("\n" + reply + "\n");
if (sources.length) console.log("Sources:\n" + sources.map((s) => `- ${s.title}: ${s.url}`).join("\n") + "\n");
console.log(`(${usage?.input_tokens ?? "?"} in / ${usage?.output_tokens ?? "?"} out tokens, ${usage?.server_tool_use?.web_search_requests ?? 0} searches)`);
