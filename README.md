# TikTok Auction Overlay — Railway Multi-User v3.0

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
