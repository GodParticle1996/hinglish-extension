// Hinglish Reader — content script
// One-click full page translate + restore + ADHD mode
// (smart highlights of key sentences + bold key terms).

(() => {
  if (window.__hinglishLoaded) return;
  window.__hinglishLoaded = true;

  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA", "INPUT", "SELECT", "OPTION"]);
  // saved entries: {node, original, translated (raw incl. markup), plain}
  let saved = [];
  let adhdOn = true;
  let translating = false;

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return true;
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return true;
  }

  function collectTextNodes() {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const t = node.nodeValue || "";
        if (t.trim().length < 4) return NodeFilter.FILTER_REJECT;
        if (!/[a-zA-Z]/.test(t)) return NodeFilter.FILTER_REJECT; // skip pure numbers/symbols
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.isContentEditable) return NodeFilter.FILTER_REJECT;
        if (!isVisible(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) {
      out.push(n);
      if (out.length >= 160) break; // very long pages: first 160 blocks
    }
    return out;
  }

  function showBar(text, pct) {
    hideBar();
    const bar = document.createElement("div");
    bar.id = "hinglish-bar";
    bar.innerHTML = `<span>${text}</span><div class="h-track"><div class="h-fill" style="width:${pct || 5}%"></div></div>`;
    document.documentElement.appendChild(bar);
  }
  function updateBar(text, pct) {
    const bar = document.getElementById("hinglish-bar");
    if (!bar) return showBar(text, pct);
    bar.querySelector("span").textContent = text;
    bar.querySelector(".h-fill").style.width = (pct || 5) + "%";
  }
  function hideBar() {
    document.getElementById("hinglish-bar")?.remove();
  }

  // Allow ONLY <mark> and <b> from the model. Everything else stays escaped text.
  function sanitizeADHD(html) {
    const div = document.createElement("div");
    div.textContent = html;
    return div.innerHTML.replace(/&lt;(\/?)(mark|b)&gt;/g, "<$1$2>");
  }

  function plainText(html) {
    const div = document.createElement("div");
    div.innerHTML = sanitizeADHD(html);
    return div.textContent || "";
  }

  function renderEntry(entry, useAdhd) {
    const el = entry.node;
    if (!el || el.nodeType !== 1) return;
    if (useAdhd && /<(mark|b)>/.test(entry.translated)) {
      el.innerHTML = sanitizeADHD(entry.translated);
    } else {
      el.textContent = entry.plain;
    }
  }

  function applyADHD() {
    for (const s of saved) renderEntry(s, true);
  }

  function removeADHD() {
    for (const s of saved) renderEntry(s, false);
  }

  async function translatePage(opts) {
    if (translating) return { ok: false, error: "Translation already running, please wait." };
    translating = true;
    adhdOn = opts.adhd !== false;
    try {
      const nodes = collectTextNodes();
      if (!nodes.length) return { ok: false, error: "No translatable English text found on this page." };

      // save originals once
      if (!saved.length) saved = nodes.map((node) => ({ node, original: node.nodeValue, translated: "", plain: "" }));

      showBar("Translating to Hinglish... 0%", 5);
      const BATCH = 12;
      let done = 0;

      for (let i = 0; i < nodes.length; i += BATCH) {
        const chunk = nodes.slice(i, i + BATCH);
        const texts = chunk.map((n) => n.nodeValue.trim().slice(0, 800));
        updateBar(`Translating to Hinglish... ${done}/${nodes.length}`, Math.round((done / nodes.length) * 90));

        const res = await chrome.runtime.sendMessage({
          type: "TRANSLATE_BATCH",
          texts,
          provider: opts.provider,
          model: opts.model,
          adhd: adhdOn,
        });

        if (!res?.ok) throw new Error(res?.error || "Translation failed.");
        const trs = res.translations || [];

        chunk.forEach((node, k) => {
          const raw = (trs[k] || "").trim();
          if (!raw) return;
          const span = document.createElement("span");
          span.dataset.h = "1";
          const entry = saved.find((x) => x.node === node);
          const translated = raw;
          const plain = plainText(raw);
          if (entry) {
            entry.translated = translated;
            entry.plain = plain;
            entry.node = span;
          }
          if (adhdOn && /<(mark|b)>/.test(translated)) {
            span.innerHTML = sanitizeADHD(translated);
          } else {
            span.textContent = plain;
          }
          node.parentNode?.replaceChild(span, node);
        });
        done += chunk.length;
      }

      updateBar("Done. Happy reading.", 100);
      setTimeout(hideBar, 1800);
      return { ok: true, count: nodes.length };
    } catch (e) {
      hideBar();
      return { ok: false, error: String(e.message || e) };
    } finally {
      translating = false;
    }
  }

  function restorePage() {
    for (const s of saved) {
      try {
        const el = s.node;
        if (el?.nodeType === 1) {
          el.replaceWith(document.createTextNode(s.original));
        } else if (el?.nodeValue !== undefined) {
          el.nodeValue = s.original;
        }
      } catch (_) {}
    }
    saved = [];
    hideBar();
  }

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    (async () => {
      if (msg.type === "START") {
        const r = await translatePage(msg);
        sendResponse(r);
      } else if (msg.type === "RESTORE") {
        restorePage();
        sendResponse({ ok: true });
      } else if (msg.type === "TOGGLE_ADHD") {
        adhdOn = !!msg.on;
        if (adhdOn) applyADHD(); else removeADHD();
        sendResponse({ ok: true });
      } else if (msg.type === "PING") {
        sendResponse({ ok: true, loaded: true });
      }
    })();
    return true;
  });
})();
