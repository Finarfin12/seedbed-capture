# Seedbed Capture

[English](README.md) · **Bahasa Indonesia**

Ekstensi Chrome (Manifest V3) untuk menyimpan teks terpilih sebagai **benih** di plugin Obsidian [Seedbed](../README.id.md): kutipan, sumber, pertanyaan pemicu, dan jawaban satu kalimat (opsional). Tanpa server, tanpa akun, tanpa akses jaringan.

> **Status: v0.2.0 (pra-rilis).** Diuji di Windows 11 + Chrome. Belum terbit di Chrome Web Store.

## Kenapa
Ide yang muncul saat browsing sering hilang karena tidak sempat dicatat. Web clipper menyimpan apa yang kamu baca; Seedbed Capture menyimpan apa yang kamu *pikirkan* tentang bacaan itu, dan langsung memasukkannya ke Inkubator Seedbed.

## Pasang (unpacked)
1. Build: `npm ci`, `npm test`, `npm run build`, `npm run check-bundle`.
2. Di Chrome, buka `chrome://extensions`, aktifkan **Developer mode**, klik **Load unpacked**, lalu pilih folder `dist/`.
3. Buka opsi ekstensi dan isi **nama vault**.
4. Pasang **Seedbed 0.7.0 atau lebih baru** di vault itu, atau pilih **mode cadangan** di opsi.

## Pakai
1. Blok teks di halaman web, klik kanan, lalu pilih **Simpan sebagai benih**, atau tekan `Alt+Shift+S` (bisa diubah di `chrome://extensions/shortcuts`).
2. Ganti pertanyaan pemicu kalau mau, dan tulis satu kalimat (opsional).
3. **Simpan** (`Ctrl+Enter`) atau batal (`Esc`).

Chrome bisa bertanya apakah boleh membuka Obsidian. Setelah itu Seedbed meminta konfirmasinya sendiri (aktif secara bawaan). Link yang terkirim belum tentu berarti catatan tersimpan, karena Obsidian tidak mengirim balasan. Periksa di Obsidian, terutama kalau kamu membatalkan salah satu dialog.

## Catatan yang dibuat
Formatnya sama di mode Seedbed dan mode cadangan. Properti berupa nama Inggris polos tanpa prefiks, dan nilainya berbahasa Inggris, apa pun bahasa UI. Seedbed hanya menganggap sebuah catatan miliknya bila `type`-nya `idea` atau `concept`; catatan lain tidak pernah disentuh. Mode cadangan selalu memakai nama bawaan (`type`, `status`, `created`, `review`, `gates`, `source`, `origin`): ia tidak bisa mengetahui nama kustom di plugin Seedbed. `source` dan `created` sengaja sama dengan nama yang lazim dipakai Obsidian Web Clipper.

```markdown
---
type: idea
status: seed
created: 2026-11-12
review: 2026-11-19
source: https://contoh.com/artikel
origin: capture
---
> [!quote] Kutipan — Judul halaman
> teks yang dipilih…
> — [Judul halaman](https://contoh.com/artikel)

> [!trigger] Pertanyaan pemicu
> Bagian mana yang belum tentu benar?
> Jawaban: …
```

Contoh query Dataview (belum dijalankan di sini; Dataview tidak terpasang di test-vault):

```dataview
TABLE review, source
FROM "Ide"
WHERE origin = "capture" AND status = "seed"
```

**Upgrade dari 0.1.0:** 0.1.0 menulis properti lama 0.6 (`bengkel-*`, nilai Indonesia) dan callout `[!pemicu]` di mode cadangan. Seedbed 0.7.0 tetap membaca catatan itu dan punya perintah **Migrasikan properti Seedbed** untuk mengonversi semuanya; lihat README Seedbed ("Upgrade dari 0.6").

## Privasi dan izin
Tidak ada fetch, XHR, WebSocket, telemetri, skrip jarak jauh, host permissions, atau content scripts. Teks terpilih hanya keluar dari ekstensi lewat link `obsidian://` lokal.

| Izin | Untuk apa |
|---|---|
| `contextMenus` | Menu klik kanan **Simpan sebagai benih** |
| `storage` | Opsi dan penghitung harian (lokal); tangkapan yang sedang menunggu (memori sesi, dipakai sekali) |
| `activeTab` | Akses sementara ke tab aktif, hanya setelah kamu mengklik atau memakai pintasan |
| `scripting` | Membaca teks terpilih saat pintasan keyboard atau tombol toolbar dipakai |

Tidak ada riwayat tangkapan. Tangkapan yang ditinggalkan tetap di session storage sampai Chrome membersihkan sesinya.

## Batasan
- Kutipan: 1.000 karakter secara bawaan; teks yang lebih panjang dipotong dan diberi tanda `…(dipotong)`.
- Peringatan harian setelah 5 tangkapan (bisa diatur). Penghitungnya menghitung link yang terkirim, termasuk yang dibatalkan di Obsidian; ini pengingat, bukan jumlah catatan yang pasti.
- Batas panjang link: 24.000 karakter setelah encode. Terukur di Windows 11: 31.800 sampai, 32.000 gagal tanpa pesan.
- Mode cadangan memakai `obsidian://new` milik Obsidian. Obsidian menimpa catatan dengan nama yang sama, jadi nama file mode cadangan diberi cap waktu `HHmmss`.

## Verifikasi
36 tes, build, dan audit bundel lulus. Uji manual di profil Chrome terpisah tanpa login: tangkapan dari Wikipedia, MDN, dan paulgraham.com; jawaban tersimpan; pemotongan; peringatan harian; mode cadangan; benih hasil tangkapan dinaikkan lewat gerbang Socratic; UI bahasa Inggris; waktu dari Simpan sampai catatan muncul 0,26–0,34 detik. Belum diuji: browser dan OS lain, banyak jendela tangkapan sekaligus. Catatan uji manual lengkap disimpan di catatan build penulis, bukan di repositori ini.

## Terbit di Chrome Web Store
Belum dilakukan. Butuh akun developer Chrome Web Store (biaya pendaftaran sekali bayar), ZIP dari `dist/`, teks listing toko, screenshot, URL kebijakan privasi, dan alasan untuk setiap izin. Setelah itu listing melewati review Google. Paket siap upload (ZIP, teks listing, jawaban privasi, kebijakan privasi, gambar, dan checklist submit) ada di `store/`; lihat `store/SUBMISSION-CHECKLIST.md`. Belum ada yang di-upload.

## Lisensi
[MIT](LICENSE), hak cipta (c) 2026 Finarfin12.
