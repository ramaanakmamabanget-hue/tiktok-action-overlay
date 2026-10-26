# TikTok Auction Overlay — Railway Multi-User v3.2

Versi ini mempertahankan tampilan dashboard dan overlay yang sudah ada, tetapi server sekarang dibuat **multi-user / multi-session**.

## Yang berubah

Setiap orang yang membuka aplikasi mendapatkan session sendiri.

- API key Euler milik user disimpan **server-side per session**.
- User A tidak memakai API key user B.
- Username TikTok, auction, leaderboard, chat, winner, prize, timer, dan koneksi juga terpisah per session.
- Klik **Save** / **Auto Save** hanya menyimpan konfigurasi dan memperbarui overlay; tidak melakukan Connect.
- **Connect** baru membuka koneksi TikTok ketika tombol Connect ditekan.
- Control URL dan public Overlay URL memakai token berbeda.
- Overlay bisa dibagikan melalui URL seperti:
  `https://YOUR-DOMAIN/overlay/3a6f...`
- Control dashboard memakai URL seperti:
  `https://YOUR-DOMAIN/control/91bd...`

## Railway deploy

1. Upload project ini ke GitHub, lalu di Railway pilih **New Project → Deploy from GitHub Repo**.
2. Railway akan menjalankan Node app dari `package.json`.
3. Start command yang digunakan:
   `npm start`
4. Pastikan service mendapatkan domain publik melalui **Networking → Generate Domain**.
5. Setelah deploy, buka domain tersebut. Aplikasi otomatis membuat session baru dan mengarahkan ke:
   `/control/<random-token>`

Railway mengharuskan web server mendengarkan `0.0.0.0` dan memakai `PORT` yang diberikan Railway. Server pada versi ini sudah menggunakan:

```text
HOST = 0.0.0.0
PORT = process.env.PORT || 8000
```

## Persistence / Railway Volume

Tanpa volume, file session di filesystem container tidak dijamin tetap ada setelah redeploy/restart.

Untuk menyimpan setting dan API key setiap session secara persistent:

1. Tambahkan **Railway Volume** ke service.
2. Gunakan mount path:
   `/app/data`
3. Aplikasi otomatis memakai `RAILWAY_VOLUME_MOUNT_PATH` jika tersedia.
4. Konfigurasi tersimpan di:
   `/app/data/sessions/`

API key tidak dimasukkan ke URL dan tidak dikirim balik ke browser sebagai plaintext pada state dashboard.

## Cara pakai

Buka:

```text
https://YOUR-DOMAIN/
```

Kamu akan diarahkan ke control URL unik.

Isi:
- TikTok username
- Euler Stream API key milik kamu sendiri
- Regular time
- Snipe time
- Draw time
- Minimum coins
- Draw margin
- Prize

Klik **Save**.

Klik **Connect** hanya ketika memang ingin membuat koneksi TikTok LIVE.

Klik **Open Overlay** untuk mendapatkan:

```text
https://YOUR-DOMAIN/overlay/<random-token>
```

URL overlay ini cocok dipakai sebagai browser source di OBS/TikTok LIVE Studio.

## Multi-user

Contoh:

User A:
```text
/control/4a91c2...
/overlay/0f8bd1...
```

User B:
```text
/control/93e71a...
/overlay/d3c20f...
```

Kedua session berjalan sendiri-sendiri di server yang sama.

Jangan membagikan **control URL** karena URL tersebut memberi akses untuk mengubah konfigurasi dan API key session tersebut. Public overlay URL aman digunakan sebagai source overlay.

## Local run

```bash
npm install
npm start
```

Lalu buka:

```text
http://127.0.0.1:8000/
```

## Catatan

Satu Railway service/instance cocok untuk model session in-memory + Socket.IO ini. Jangan menambah replica horizontal untuk setup sederhana ini karena state session dan koneksi TikTok berada di memory instance. Bila nantinya ingin horizontal scaling, session state perlu dipindahkan ke shared database/Redis.

## Fitur yang tetap ada

- Dark-blue chroma-key overlay.
- Winner panel.
- Winner Chat dengan avatar + username + chat.
- Animasi pergantian Winner Chat.
- Copy hanya menyalin isi chat.
- Prize bisa berubah live saat Save.
- Auto Save ON/OFF.
- Save dan Connect terpisah.
- Demo Gift.
- Anti duplicate gift handling.
- Snipe / Draw phase.
- Reconnect setelah Connect pernah dipicu.

## v3.1 — Overlay baru (neon dark)

- Frame hitam pekat (`#000`) dengan border neon + efek shiny (sheen sweep) di semua frame.
- Frame Snipe Delay dihapus; diganti frame **Prize** dengan teks rainbow gradient yang bergerak halus.
- Background halaman biru tua `#001a66` untuk chroma key. Bisa diganti lewat URL:
  `/overlay/<token>?bg=black`, `?bg=transparent`, atau `?bg=hex` (contoh `?bg=00ff00`).
- Ada penghitung **Total participants**.
- Railway: `railway.json` (healthcheck `/api/health`) dan `Procfile` sudah disertakan.

## v3.2 — Efek tambahan

- **OVERTAKEN!** saat top 1 diambil orang lain; baris bertukar posisi dengan animasi geser.
- **Selisih ke #1:** tampil di kanan baris top 2 dan 3 sebagai `-29` + koin merah.
- **5 detik terakhir** (snipe/draw): tick tiap detik; **3-2-1** besar; saat snipe frame merah berdenyut dan timer membesar.
- **Winner:** flash emas + confetti + suara fanfare.
- **Suara** (dibuat langsung oleh browser, tanpa file): coin saat ada bid, tick, overtaken, winner.
  - Toggle **Sound** di control panel (Setup).
  - Matikan per-URL dengan `?mute=1`. Preview di dashboard selalu senyap.
  - Di OBS Browser Source suara langsung jalan. Di browser biasa, klik halaman sekali dulu (aturan autoplay browser).
- **Tema warna** lewat URL: `?theme=blue` (default), `gold`, `pink`, `green`.
  Contoh: `https://DOMAIN/overlay/<token>?theme=gold&bg=black`
- **Winner panel** dihias: sunburst emas berputar, mahkota, avatar dengan ring rainbow, sparkle berkedip, badge koin dan prize.
- **Drop (gift) banner:** teks di atas username sekarang memakai kata **DROP** (bukan "gift"): `DROP`, `NICE DROP`, `SUPER DROP`, `BIG DROP`, `MEGA DROP`, `NUKE DROP`, `MONEY GUN DROP`, `GALAXY DROP`. Nama item dari TikTok yang mengandung kata "gift" juga diganti jadi "Drop" di log.
- **Efek bertingkat** (canvas, `public/fx.js`; semakin banyak coin semakin heboh):
  - 1-9 coin: koin kecil + ripple.
  - **10+ STARS:** bintang berhamburan dari baris lalu tersedot balik.
  - **20+ FOUNTAIN:** koin menyembur seperti air mancur + kolom cahaya.
  - **35+ HEARTS:** hati pink melayang naik, hati & koin terbang masuk ke baris.
  - **50+ CONFETTI:** dua meriam confetti di kiri-kanan.
  - **100+ BURST:** koin meledak dengan trail + dua gelombang shockwave.
  - **150+ THUNDER:** badai gelap, petir menyambar baris, koin terpental lalu masuk.
  - **200+ FIREWORKS:** roket meledak warna-warni jadi hujan koin.
  - **299+ NUKE:** rudal, flash, shockwave, awan jamur + asap, layar bergetar, angka rainbow.
  - **500+ MONEY GUN (pink-ungu):** pistol uang pink/ungu meluncur masuk, menembakkan uang kertas pink-ungu bertubi-tubi ke frame pemain + glitter + hujan uang; angka coin naik tiap lembar masuk.
  - **1000+ GALAXY:** nebula, galaksi spiral, bintang jatuh, runtuh masuk ke baris.
  - **3000+ METEOR:** hujan meteor menghantam baris, tiap hantaman melempar koin.
  - Jumlah partikel/durasi ikut membesar sesuai jumlah coin.
  - Tombol preset demo di dashboard: +5, +25, +60, +120, +250, +299, +500, +1K.

## Theme 1 Classic v6 — Royal Neon (upgrade)
- **Tampilan:** panel kaca gelap membulat, aksen emas + neon, cahaya berjalan mengelilingi frame utama (merah cepat saat Snipe), sayap hiasan di judul, timer besar + progress bar, meter di tiap baris.
- **Teks berjalan (ticker):** info live (prize, leader, bonus waktu, daftar tier efek).
- **Strip baru:** `LAST DROP` dan `BIGGEST DROP` (reset tiap ronde).
- **Money Gun v2 (500+):** pistol baru (drum magazine, moncong emas), laser sight + target lock di frame pemain, muzzle flash kerucut, selongsong emas, asap, cincin impak, volley "cash-out" di akhir + teks `+N C`.
- **BLACK HOLE (5000+, baru):** layar gelap, lensa gravitasi, accretion disk, semua koin/uang tersedot, collapse flash, lalu C menyembur ke baris pemain. Tombol demo `+6K black hole`.
- **Galaxy (1000+) dan Meteor (3000+)** tetap efek asli. Tier 10-299 memakai efek poligon HEX PACK.
- **Suara baru:** Money Gun (tembakan beruntun + ka-ching + hujan koin) dan Black Hole (rumble naik, implosi, chime).
- **Istilah:** semua teks tampilan memakai `DROP` (bukan gift) dan `C` (bukan coins), di overlay maupun dashboard.
- BlaxWhit tidak berubah.

## v6.1 — Shark Attack + tanpa teks berjalan
- **Teks berjalan (ticker) dihapus** supaya overlay lebih simpel.
- **SHARK ATTACK (2100–2999 C, baru):** air naik dari bawah memenuhi frame + gelembung → hiu lewat (kiri→kanan atau sebaliknya, acak) → hiu hilang → **jumpscare**: hiu zoom ke layar, rahang menggigit, layar bergetar + flash merah → hilang → hiu menyambar super cepat melewati baris pemain (2x, arah berlawanan), koin terbang masuk dan angka C naik. Ada suara (motif dua nada, jeritan gigitan, whoosh).
- Tombol demo baru: `+2.1K shark`. Tier lain tidak berubah (3000+ Meteor, 5000+ Black Hole).
- **v6.2:** background semua frame (frame utama, baris leaderboard, chip, pill, winner) dibuat 90% transparan. Atur lewat variabel `--fa` di akhir `public/overlay-classic.css` (`.6` default sekarang, `.10` sangat transparan, `0` bening total).
- **v6.3 — Chroma key:** background halaman default dikembalikan ke **biru tua `#001a66`** (v6.3 sempat hijau `#00ff00`; pakai `?bg=00ff00` untuk hijau) (sebelumnya biru tua yang ikut menghilangkan panel & neon biru). Panel memakai tint hitam netral. Angka intro 3-2-1 yang tadinya hijau diganti emas supaya tidak ikut ter-key. Pilihan lain: `?bg=blue`, `?bg=transparent` (OBS Browser Source, tanpa chroma), `?bg=hex`.
- **v6.4:** teks "Auction hasn't started yet" diperbaiki: rata tengah dan lurus (sebelumnya terjebak di kolom sempit sehingga bergeser ke kiri).
- **v6.5 — Efek 10–299 dirombak (tanpa hexagon):** Classic sekarang memakai koin asli (koin emas dengan huruf C, tepi bergerigi, berputar 3D) di semua efek. Efek hex (PRISM/JET/PENTA/PARTY/SHOCK/ARC/NOVA/CORE) tidak dipakai lagi.
  - **Confetti 50+:** kertas, pita, streamer, bintang & bulatan warna-warni + ledakan moncong meriam 3 gelombang + hujan confetti dari atas.
  - **Burst 100+:** sinar cahaya berputar, 3 gelombang kejut, garis percik, glitter, koin meledak lalu tersedot ke baris.
  - **Nuke 299+:** rudal asli, ledakan putih, awan jamur bergumpal, gelombang kejut di tanah, hujan koin.
  - Stars, Fountain, Hearts, Lightning, Fireworks diberi glitter berkelap-kelip. Suara Classic memakai set koin (bukan hex).
