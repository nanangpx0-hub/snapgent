# Daftar Penyedia AI yang Didukung snapgentV3

Dokumen ini berisi daftar lengkap alamat web penyedia AI yang dapat diakses melalui aplikasi snapgentV3 (browser extension + local bridge + MCP server).

## Daftar Penyedia AI

| No | Penyedia AI | Alamat Web | Keterangan |
|----|-------------|------------|------------|
| 1 | DeepSeek | https://chat.deepseek.com | Utama |
| 2 | DeepSeek | https://deepseek.com | Alternatif |
| 3 | ChatGPT (OpenAI) | https://chatgpt.com | Utama |
| 4 | ChatGPT (OpenAI) | https://chat.openai.com | Alternatif |
| 5 | Claude (Anthropic) | https://claude.ai | Utama |
| 6 | Claude (Anthropic) | https://www.claude.ai | Alternatif |
| 7 | Gemini (Google) | https://gemini.google.com | |
| 8 | Kimi (Moonshot) | https://www.kimi.ai | Utama |
| 9 | Kimi (Moonshot) | https://kimi.ai | Alternatif |
| 10 | GLM (Z.AI) | https://chat.z.ai | |
| 11 | Qwen (Alibaba) | https://chat.qwen.ai | |
| 12 | Arena | https://arena.ai | |
| 13 | Meta AI | https://www.meta.ai | Utama |
| 14 | Meta AI | https://meta.ai | Alternatif |
| 15 | Ptero | https://ptero.pro | |
| 16 | Grok (xAI) | https://grok.com | |
| 17 | Perplexity | https://perplexity.ai | Utama (Lihat [Panduan Perplexity](file:///c:/laragon/www/snapgent/docs/PANDUAN_PERPLEXITY.md)) |
| 18 | Perplexity | https://www.perplexity.ai | Alternatif |
| 19 | Mistral Vibe | https://chat.mistral.ai | |
| 20 | Microsoft Copilot | https://copilot.com | |
| 21 | Microsoft Copilot | https://www.copilot.com | Alternatif |
| 22 | Microsoft Copilot | https://copilot.microsoft.com | |
| 23 | Microsoft Copilot | https://copilot.cloud.microsoft | |
| 24 | Microsoft 365 Copilot | https://m365.cloud.microsoft | |
| 25 | Poe | https://poe.com | |

## Alamat Lokal (Bridge)

| Alamat | Port | Keterangan |
|--------|------|------------|
| http://127.0.0.1/* | 17613 | HTTP untuk bridge lokal |
| ws://127.0.0.1/* | 17613 | WebSocket untuk bridge lokal |

## Struktur Integrasi per Penyedia

Setiap penyedia AI memiliki file provider tersendiri di folder `snapgent-extension/providers/`:

| File Provider | Penyedia |
|---------------|----------|
| `deepseek.js` | DeepSeek |
| `chatgpt.js` / `chatgpt-cm.js` | ChatGPT (OpenAI) |
| `claude.js` | Claude (Anthropic) |
| `gemini.js` | Gemini (Google) |
| `kimi.js` | Kimi (Moonshot) |
| `glm.js` | GLM (Z.AI) |
| `qwen.js` / `qwen-net.js` | Qwen (Alibaba) |
| `arena.js` | Arena |
| `meta.js` | Meta AI |
| `ptero.js` | Ptero |
| `grok.js` | Grok (xAI) |
| `extra-chat.js` | Perplexity, Mistral Vibe, Microsoft Copilot, Poe |

## Konfigurasi

Semua alamat di atas terdaftar dalam:
- `manifest.json` — bagian `host_permissions` dan `content_scripts`
- `background.js` — konstanta `PROVIDER_URLS`
- `popup.js` — konstanta `SUPPORTED_HOSTS`

## Cara Menambahkan Penyedia AI Baru

Untuk menambahkan penyedia AI baru, lakukan langkah berikut:

1. Tambahkan alamat web ke `host_permissions` di `manifest.json`
2. Tambahkan entri `content_scripts` baru di `manifest.json` dengan file provider yang sesuai
3. Buat file provider baru di `snapgent-extension/providers/`
4. Tambahkan URL pattern ke `PROVIDER_URLS` di `background.js`
5. Tambahkan hostname ke `SUPPORTED_HOSTS` di `popup.js`

---

*Dokumen ini dibuat untuk snapgentV3 — Browser Extension + Local Bridge untuk MCP.*