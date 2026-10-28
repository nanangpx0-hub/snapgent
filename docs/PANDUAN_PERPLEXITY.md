# Panduan Penggunaan & Integrasi Perplexity AI dengan Snapgent (`snapgentV3`)

Dokumen ini menjelaskan secara detail arsitektur integrasi, cara penggunaan, optimasi performa, serta panduan pemecahan masalah (*troubleshooting*) saat menggunakan **Perplexity AI** (`https://www.perplexity.ai/`) sebagai agent coding otonom bersama Snapgent (`snapgentV3`).

---

## 1. Karakteristik Perplexity AI vs Chatbot Biasa

Berbeda dengan platform chat murni (seperti ChatGPT atau Claude), **Perplexity AI** adalah mesin pencari berbasis AI (*Answer Engine*). Karakteristik ini mempengaruhi interaksi agent:

1. **Perilaku Default Web Search:**
   Secara default, setiap teks yang masuk ke Perplexity akan memicu pencarian web (*web crawling*). Snapgent telah menyisipkan instruksi khusus pada prompt sistem agar Perplexity **tidak melakukan pencarian web** saat menerima perintah tool/kode MCP, sehingga eksekusi tool berlangsung instan (1–3 detik).
2. **Struktur DOM Kompleks (Tailwind & Next.js):**
   Halaman Perplexity memiliki elemen navigasi dinamis, sidebar riwayat, kartu saran *Trending*, serta tab (*Answer*, *Links*, *Images*, *Sources*). Provider Snapgent (`extra-chat.js`) menyaring elemen-elemen tersebut agar hanya pesan chat utama yang dibaca oleh agent.
3. **Command Palette & Shortcut Slash (`/`):**
   Perplexity memiliki fitur bawaan Command Palette (*"Type a command or search"*) yang terbuka jika tombol `/` atau `Ctrl+K` tertekan. Snapgent telah dilengkapi mekanisme *auto-dismiss* untuk menutup popup ini secara otomatis.

---

## 2. Cara Menggunakan Perplexity dengan Snapgent

### Langkah 1: Persiapan Bridge Lokal
1. Jalankan `start.bat` di direktori project `snapgent`.
2. Pastikan terminal Snapgent Bridge aktif dan menampilkan:
   ```text
   listening on ws://127.0.0.1:17613
   ready 24 tools available (1 MCP server(s))
   ```
3. Buka folder kerja project Anda di **Visual Studio Code** (**File → Open Folder...**).

### Langkah 2: Membuka Perplexity
1. Buka browser (Chrome / Edge / Brave).
2. Akses [https://www.perplexity.ai/](https://www.perplexity.ai/) atau klik **+ New** di sidebar kiri.
3. Di atas kotak input chat, bar Snapgent akan tampil dengan status:
   ```text
   Ready.   [▶︎ Start]   [VS Code ▾]   [Perplexity ▾]
   ```

### Langkah 3: Mengaktifkan Agent
1. Klik tombol **`▶︎ Start`**.
2. Snapgent akan melakukan *handshake* awal:
   - Mengirim prompt sistem dan instruksi tool MCP.
   - Perplexity membalas dengan perintah `list_commands`.
   - Ekstensi membaca perintah, mengeksekusi katalog 24 tools, dan mengirimkannya kembali ke Perplexity.
3. Dalam hitungan detik, chip akan berubah menjadi hijau (`✓ 24 commands`), dan status bar berubah menjadi:
   ```text
   Active · 24 tools · VS Code
   ```

### Langkah 4: Memberikan Instruksi Tugas
Ketikkan tugas pemrograman Anda seperti biasa di kotak chat Perplexity, misalnya:
- *"Analisis struktur project ini dan buatkan dokumentasinya di folder docs."*
- *"Cari semua file python di direktori saat ini dan periksa apakah ada error syntax."*
- *"Buat file kalkulator.py dan jalankan unit test-nya."*

Snapgent akan mengeksekusi tool (`read_file`, `create_file`, `run_command`, dll.) secara otomatis di komputer Anda.

---

## 3. Komponen Teknis & Konfigurasi

Integrasi Perplexity didukung oleh file-file berikut:

| File | Peran / Fungsi |
| :--- | :--- |
| `snapgent-extension/manifest.json` | Mendaftarkan URL `https://perplexity.ai/*` & `https://www.perplexity.ai/*` pada `host_permissions` dan `content_scripts`. |
| `snapgent-extension/providers/extra-chat.js` | Adapter selector DOM Perplexity (editor textarea, deteksi user query, assistant answer, submit button, dan auto-dismiss command palette). |
| `snapgent-extension/core/config.js` | Konfigurasi prompt sistem bootstrap `list_commands` dan aturan pencegahan web search otomatis. |
| `snapgent-extension/core/main.js` | Loop agen utama, eksekusi tool MCP, dan manajemen status bar. |
| `snapgent-extension/popup.js` | Deteksi URL Perplexity di popup ekstensi. |

---

## 4. Pemecahan Masalah (Troubleshooting)

Berikut adalah ringkasan masalah yang sering dihadapi di Perplexity beserta solusinya:

### A. Muncul Pesan *"net::ERR_CONNECTION_REFUSED"* di Console
* **Penyebab:** Ekstensi mencoba menyambung ke `ws://127.0.0.1:17613`, namun proses bridge lokal belum aktif atau sedang restart.
* **Solusi:** Jalankan `start.bat` di folder project. Ekstensi akan terhubung otomatis begitu bridge online.

### B. Bar Menampilkan *"No agent. Open a new chat."*
* **Penyebab:** Selektor lama salah mengenali elemen sidebar/trending Perplexity sebagai percakapan yang sudah berjalan.
* **Solusi:** 
  1. Kode di `extra-chat.js` telah diperbaiki dengan filter `isExcludedUi()` sehingga halaman utama (`/`) selalu dikenali sebagai chat baru.
  2. Tombol `▶︎ Start` kini tetap tersedia bahkan di percakapan yang sudah memiliki pesan. Cukup klik `▶︎ Start` untuk menghubungkan agent.

### C. Chip `list_commands` Berputar Terus (*Stuck*)
* **Penyebab:** Class CSS `.zs-tool-hide` sempat masuk ke daftar skip pembaca teks, menyebabkan teks perintah terpotong dan agen mengira AI belum selesai mengetik.
* **Solusi:** Bug tersebut sudah diatasi di `extra-chat.js`. Pastikan Anda me-reload ekstensi di `chrome://extensions/` dan refresh halaman chat.

### D. Error *"your snapgentV3 command was cut off before it finished"*
* **Penyebab:** Terjadi saat pengguna mengetik instruksi manual di tengah proses inisialisasi awal, atau timing streaming terlalu singkat sehingga kurung kurawal `}` penutup JSON belum selesai dicetak oleh Perplexity.
* **Solusi:**
  1. Timing streaming telah diatur aman pada `GEN_IDLE_MS = 1800ms`.
  2. Buka chat baru (**+ New**) di Perplexity, lalu klik **`▶︎ Start`** dan biarkan inisialisasi berjalan otomatis tanpa mengetik manual.

### E. Muncul Jendela Popup *"Type a command or search"*
* **Penyebab:** Ini adalah Command Palette bawaan Perplexity yang terpicu jika ada karakter garis miring `/` (misalnya pada path file/direktori).
* **Solusi:**
  1. Tekan tombol **`Esc` (Escape)** pada keyboard untuk menutupnya secara instan.
  2. Ekstensi telah dilengkapi fungsi `dismissCommandPalette()` yang otomatis menutup popup ini setiap kali agent menjalankan perintah tool.
