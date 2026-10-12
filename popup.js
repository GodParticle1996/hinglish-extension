// Popup logic — Hinglish Reader (English UI)
const $ = (id) => document.getElementById(id);
const status = (t) => ($("status").textContent = t);
const progress = (pct) => {
  const el = $("progressFill");
  if (el) el.style.width = Math.max(0, Math.min(100, pct)) + "%";
};

async function loadSettings() {
  const d = await chrome.storage.sync.get({
    provider: "groq", groqKey: "", nvidiaKey: "",
    groqModel: "openai/gpt-oss-20b",
    nvidiaModel: "meta/llama-3.3-70b-instruct",
    adhd: true,
  });
  $("provider").value = d.provider;
  $("groqKey").value = d.groqKey;
  $("nvidiaKey").value = d.nvidiaKey;
  $("adhd").checked = d.adhd !== false;
  await refreshModels(d.provider, d);
}

async function refreshModels(provider, d) {
  const { groqModels, nvidiaModels } = await chrome.runtime.sendMessage({ type: "GET_MODELS" });
  const list = provider === "nvidia" ? nvidiaModels : groqModels;
  const cur = provider === "nvidia" ? d?.nvidiaModel : d?.groqModel;
  $("model").innerHTML = "";
  for (const m of list) {
    const o = document.createElement("option");
    o.value = m; o.textContent = m;
    if (m === cur) o.selected = true;
    $("model").appendChild(o);
  }
}

async function save() {
  await chrome.storage.sync.set({
    provider: $("provider").value,
    groqKey: $("groqKey").value.trim(),
    nvidiaKey: $("nvidiaKey").value.trim(),
    groqModel: $("provider").value === "groq" ? $("model").value : (await chrome.storage.sync.get("groqModel")).groqModel,
    nvidiaModel: $("provider").value === "nvidia" ? $("model").value : (await chrome.storage.sync.get("nvidiaModel")).nvidiaModel,
    adhd: $("adhd").checked,
  });
}

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

async function ensureContent(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
  } catch (_) {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}

$("provider").addEventListener("change", async () => {
  const d = await chrome.storage.sync.get(["groqModel", "nvidiaModel"]);
  refreshModels($("provider").value, d);
});
$("save").addEventListener("click", async () => { await save(); status("Saved."); });
$("adhd").addEventListener("change", async (e) => {
  await save();
  const t = await activeTab();
  try { await chrome.tabs.sendMessage(t.id, { type: "TOGGLE_ADHD", on: e.target.checked }); } catch (_) {}
  status(e.target.checked ? "ADHD mode on: key lines highlighted." : "ADHD mode off: plain Hinglish.");
});

$("go").addEventListener("click", async () => {
  await save();
  const d = await chrome.storage.sync.get(["provider", "groqKey", "nvidiaKey", "groqModel", "nvidiaModel", "adhd"]);
  const key = d.provider === "nvidia" ? d.nvidiaKey : d.groqKey;
  if (!key) { status("Add your API key first, then press Save."); return; }
  const t = await activeTab();
  if (!t?.id || /^chrome:/.test(t.url || "")) { status("This page cannot be translated. Open a news or blog article."); return; }
  $("go").disabled = true;
  progress(15);
  status("Translating. One moment...");
  try {
    await ensureContent(t.id);
    const res = await chrome.tabs.sendMessage(t.id, {
      type: "START",
      provider: d.provider,
      model: d.provider === "nvidia" ? d.nvidiaModel : d.groqModel,
      adhd: d.adhd !== false,
    });
    status(res?.ok ? `Done. ${res.count} sections translated.` : `Failed: ${res?.error || "unknown error"}`);
    progress(res?.ok ? 100 : 0);
  } catch (e) {
    status("Error: " + String(e.message || e).slice(0, 160));
    progress(0);
  }
  $("go").disabled = false;
  setTimeout(() => progress(0), 2500);
});

$("back").addEventListener("click", async () => {
  const t = await activeTab();
  try { await chrome.tabs.sendMessage(t.id, { type: "RESTORE" }); status("Original page restored."); }
  catch (_) { status("Nothing to restore yet."); }
});

$("test").addEventListener("click", async () => {
  await save();
  const provider = $("provider").value;
  const apiKey = provider === "nvidia" ? $("nvidiaKey").value.trim() : $("groqKey").value.trim();
  if (!apiKey) { status("Key field is empty."); return; }
  status("Checking key...");
  progress(30);
  const res = await chrome.runtime.sendMessage({ type: "TEST_KEY", provider, apiKey, model: $("model").value });
  status(res?.ok ? `Key works. Sample: "${(res.sample?.[0] || "").slice(0, 80)}"` : `Key failed: ${(res?.error || "").slice(0, 140)}`);
  progress(res?.ok ? 100 : 0);
  setTimeout(() => progress(0), 2500);
});

loadSettings();
