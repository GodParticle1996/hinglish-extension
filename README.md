# 📖 Hinglish me Padho — Chrome Extension

English webpage → **Full Hinglish (Roman Hindi)**. One click. ADHD-friendly.

Tumhari choices ke hisaab se bana hai:
- ✅ **Full Hinglish** (dost jaisa tone, sirf Roman script)
- ✅ **One-Click Full Page** translate + Original wapas
- ✅ **ADHD mode** (AI highlights 1–2 key sentences per section in soft yellow + bolds key names/numbers/terms, single toggle)
- ✅ **Groq + NVIDIA switchable** (dono free)
- ✅ Key tumhare browser me safe rehti hai, code me nahi

## Tested best models (Sep 2026)

| Provider | Best default | Backup |
|---|---|---|
| Groq | `openai/gpt-oss-20b` — fast + sahi Hinglish ✅ | `qwen/qwen3.8-27b`, `openai/gpt-oss-120b` (quality, slow) |
| NVIDIA | `meta/llama-3.3-70b-instruct` | `nvidia/llama-3.1-nemotron-70b-instruct` |

Note: purana `llama-3.3-70b-versatile` Groq pe ab nahi hai, isliye naya default lagaya hai.

## 1. Install (2 min)

1. `chrome://extensions` kholo
2. Upar right me **Developer mode** ON karo
3. **Load unpacked** dabao → ye `hinglish-extension` folder select karo
4. Toolbar me 📖 icon pin kar lo

## 2. Free API Key (3 min)

**Groq (recommended):**
1. https://console.groq.com → Login → **API Keys** → **Create API Key** → copy (`gsk_...`)
2. Extension icon → **Groq API Key** me paste → **Save** → **Key Check**

**NVIDIA (optional):**
1. https://build.nvidia.com → Login → **Get API Key** → copy (`nvapi-...`)
2. Extension me **NVIDIA API Key** me paste → Provider = NVIDIA → **Save**

## 3. Use (daily)

1. Koi English article/blog kholo
2. 📖 icon dabao → **✨ Hinglish me Karo**
3. Upar progress dikhega → page Hinglish me badal jayega
4. Wapas English chahiye? → **↩️ Original Wapas**
5. ADHD mode on-off karne ke liye popup me single toggle hai — turant highlights lagte/hatte hain, page dobara translate nahi hota

## Files

- `manifest.json` — Manifest V3 setting
- `background.js` — Groq + NVIDIA API calls, Hinglish prompt
- `content.js` — page text nikaalna, batch translate, restore, ADHD highlights render
- `content.css` — progress bar + soft-yellow highlight style
- `popup.html / popup.css / popup.js` — simple ADHD-friendly UI

## Privacy

- Page text Groq/NVIDIA ko translate ke liye jaata hai. Private banking/password pages pe use mat karo.
- Keys `chrome.storage.sync` me rehti hain (tumhare Google account se sync). Code/GitHub me kabhi mat daalo.

## Problems?

- **Key fail?** → Key me space to nahi? **Key Check** dabao. Groq dashboard me key active hai?
- **Is page pe nahi chalega?** → `chrome://` pages pe Chrome allow nahi karta. Koi normal site kholo.
- **Half page translate?** → Badi pages pe pehle 160 blocks hote hain (speed + free limit ke liye). Refresh karke dobara chalao.
- **Rate limit (429)?** → 1 min ruko, phir try karo. Free tier me limit hota hai.
