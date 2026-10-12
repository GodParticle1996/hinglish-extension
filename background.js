// Hinglish Padho — background service worker
// Groq + NVIDIA NIM, OpenAI-compatible chat completions.
// API keys chrome.storage me rehti hain, code me kabhi hardcode mat karo.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const GROQ_MODELS = [
  "openai/gpt-oss-20b",      // fast + best Hinglish, default (tested Sep 2026)
  "qwen/qwen3.8-27b",        // great Hinglish backup
  "openai/gpt-oss-120b",     // best quality, thoda slow
  "groq/compound-mini",
  "groq/compound"
];

const NVIDIA_MODELS = [
  "meta/llama-3.3-70b-instruct",          // default
  "nvidia/llama-3.1-nemotron-70b-instruct",
  "mistralai/mixtral-8x22b-instruct-v0.1",
  "meta/llama-3.1-70b-instruct"
];

const SYSTEM_BASE = `You are a Hinglish translator for an Indian user with ADHD who understands Hinglish (Hindi written in Roman/English script) better than pure English.

RULES — follow strictly:
1. Translate English to natural, friendly FULL HINGLISH. Example: "Regular exercise improves focus" -> "Roz exercise karne se tumhara focus better hota hai."
2. ONLY Roman script (A-Z). NEVER use Devanagari (Hindi script), NEVER use Arabic/Urdu script.
3. Keep it simple: short sentences, easy words, friendly tone. Break long sentences into 2 short ones.
4. DO NOT translate: person names, brand names, URLs, emails, code, numbers, dates. Keep them as-is.
5. Keep the same meaning. Add nothing, remove nothing. No explanations, no extra text.
6. Output ONLY the translation, nothing else.`;

// ADHD mode: the model marks what matters most, in the same single pass.
// Balanced = 1-2 key sentences per text + key terms bold. Soft-yellow <mark> is styled by the extension.
const ADHD_ADDON = `
7. ADHD markup (important): inside EACH translated string, wrap the 1 or 2 most important sentences in <mark> and </mark> so the reader can skim just the highlights. Also wrap key names, numbers, dates, and key phrases in <b> and </b>. Use ONLY <mark> and <b> tags, with NO attributes. No other HTML, no markdown.`;

const PLAIN_ADDON = `
7. Plain text only. Do NOT add any HTML tags.`;

function buildSystemPrompt(adhd) {
  return SYSTEM_BASE + (adhd ? ADHD_ADDON : PLAIN_ADDON) +
    `\n\nYou will receive a JSON object like {"texts": ["...", "..."]}. Return ONLY a JSON object like {"translations": ["...", "..."]} with the same count, same order.`;
}

// --- settings ---
async function getSettings() {
  const d = await chrome.storage.sync.get({
    provider: "groq",
    groqKey: "",
    nvidiaKey: "",
    groqModel: GROQ_MODELS[0],
    nvidiaModel: NVIDIA_MODELS[0],
  });
  return d;
}

async function callAPI({ provider, apiKey, model, texts, adhd }) {
  const url = provider === "nvidia" ? NVIDIA_URL : GROQ_URL;
  const body = {
    model,
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(adhd !== false) },
      { role: "user", content: JSON.stringify({ texts }) },
    ],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || "";
  return parseTranslations(content, texts.length);
}

function parseTranslations(content, expected) {
  // 1) try pure JSON
  try {
    const obj = JSON.parse(content);
    if (Array.isArray(obj.translations) && obj.translations.length === expected) return obj.translations;
    if (Array.isArray(obj.texts) && obj.texts.length === expected) return obj.texts;
    if (Array.isArray(obj) && obj.length === expected) return obj;
  } catch (_) {}
  // 2) try to find JSON inside markdown fences
  try {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) {
      const obj = JSON.parse(m[0]);
      if (Array.isArray(obj.translations)) return obj.translations;
    }
  } catch (_) {}
  // 3) fallback: split by lines — return as-is padded
  const lines = content.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, expected);
  while (lines.length < expected) lines.push("");
  return lines;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "GET_MODELS") {
      sendResponse({ groqModels: GROQ_MODELS, nvidiaModels: NVIDIA_MODELS });
      return;
    }
    if (msg.type === "TRANSLATE_BATCH") {
      const s = await getSettings();
      const provider = msg.provider || s.provider;
      const model = msg.model || (provider === "nvidia" ? s.nvidiaModel : s.groqModel);
      const apiKey = provider === "nvidia" ? s.nvidiaKey : s.groqKey;
      if (!apiKey) {
        sendResponse({ ok: false, error: "API key missing. Open the popup and paste your key." });
        return;
      }
      try {
        const out = await callAPI({ provider, apiKey, model, texts: msg.texts, adhd: msg.adhd });
        sendResponse({ ok: true, translations: out, provider, model });
      } catch (e) {
        sendResponse({ ok: false, error: String(e.message || e) });
      }
      return;
    }
    if (msg.type === "TEST_KEY") {
      try {
        const out = await callAPI({
          provider: msg.provider,
          apiKey: msg.apiKey,
          model: msg.model,
          texts: ["Hello, how are you?", "Regular exercise improves focus."],
        });
        sendResponse({ ok: true, sample: out });
      } catch (e) {
        sendResponse({ ok: false, error: String(e.message || e) });
      }
      return;
    }
  })();
  return true; // async response
});
