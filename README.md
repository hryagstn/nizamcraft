# NizamCraft - Game Voxel 3D

NizamCraft adalah game voxel 3D interaktif yang terinspirasi dari Minecraft. Game ini dikembangkan menggunakan Three.js dan berjalan langsung di web browser Anda tanpa memerlukan instalasi aplikasi tambahan. Gali, bangun, dan ciptakan dunia impian Anda!

## Fitur Utama

- **Eksplorasi Dunia 3D**: Jelajahi dunia voxel tak terbatas secara first-person (sudut pandang orang pertama).
- **Interaksi Block Dinamis**: Pasang dan gali berbagai jenis block sesuka Anda.
- **Block TNT & Reaksi Berantai**: TNT dapat dinyalakan baik dengan dipukul (klik kiri/gali) maupun diinteraksi (klik kanan/pasang). Ledakan TNT juga memicu reaksi berantai pada block TNT di dekatnya dengan delay acak yang dinamis.
- **Obsidian Hardness**: Block Obsidian didesain sangat keras dan membutuhkan **8 kali pukulan** untuk dihancurkan, disertai indikator progres tambang, partikel hancur, dan efek suara ketukan.
- **Optimalisasi Aliran Lava & Cairan**: Batas rendering instanced mesh untuk Lava ditingkatkan hingga **15.000 block** untuk mencegah hilangnya visual (invisible block) saat lava mengalir luas di bawah tanah atau permukaan.
- **Model Tangan & Animasi Ayunan**: Dilengkapi dengan visual tangan 3D yang memegang item terpilih dan mengayun secara realistis saat melakukan aksi.
- **Efek Partikel Hancur**: Setiap block yang digali akan menyemburkan pecahan partikel dengan warna yang sesuai sebelum menghilang.
- **Sistem Pertempuran Jarak Jauh**: Gunakan **Busur Panah (Bow)** untuk menembak zombie dan skeleton dari jarak jauh dengan efek dorongan balik (knockback).
- **Optimasi Mobile & Touch Screen**: Gamepad sentuh bawaan (joystick gerak, tombol gali, pasang, serang, melompat, serta hotbar yang adaptif) dengan pemosisian ergonomis yang mencegah tombol saling bertumpang-tindih di berbagai resolusi layar.
- **Optimalisasi iOS Safari**: Layout game didesain menggunakan CSS Dynamic Viewport Height (`100dvh`) agar pas di layar tanpa terpotong bar navigasi Safari. Dilengkapi pula dengan deteksi otomatis dan petunjuk toast layar penuh jika Fullscreen API dibatasi oleh sistem iOS.
- **Kompatibilitas MacBook Trackpad**: Mendukung klik kiri (ketuk satu jari) dan klik kanan (ketuk dua jari) trackpad MacBook secara lancar tanpa terganggu menu konteks browser.
- **Penyimpanan Dunia Otomatis**: Simpan dan muat progres dunia Anda menggunakan LocalStorage di browser. Dunia Anda otomatis tersimpan saat Anda menutup halaman game.
- **Efek Suara Sintetis (Web Audio API)**: Sound effect bawaan (suara gali, suara pasang, suara tembakan busur panah, suara terkena serangan, hingga ledakan) yang dihasilkan secara real-time tanpa file audio eksternal.

## Kontrol Permainan

### Desktop (Keyboard & Mouse)
- **Berjalan / Bergerak**: Tombol `W` `A` `S` `D` atau `Tombol Arah`
- **Melihat Sekeliling**: Gerakkan Mouse (klik layar untuk mengaktifkan Pointer Lock)
- **Melompat**: Tombol `Spasi`
- **Gali Block / Serang**: Klik Kiri Mouse
- **Pasang Block**: Klik Kanan Mouse
- **Pilih Jenis Block/Item**: Tombol `1` - `9`, `0`, `-`, `=`, `L` (Lava), `Q` (Quartz), `B` (Bow)
- **Respawn (Kembali ke Spawn)**: Tombol `R`
- **Regenerasi Dunia**: Tombol `Backspace` (mengatur ulang seluruh peta)

### Mobile (Layar Sentuh)
- **Berjalan / Bergerak**: Tarik Joystick di kiri bawah layar
- **Melihat Sekeliling**: Seret/geser layar di area sebelah kanan
- **Melompat / Berenang**: Ketuk tombol ▲
- **Menyerang Monster**: Ketuk tombol ⚔️
- **Menggali / Memicu TNT**: Ketuk tombol ⛏️
- **Memasang / Memicu TNT**: Ketuk tombol 🧱
- **Menembak Busur Panah**: Ketuk tombol 🏹 (diposisikan rapi di samping kiri tombol menyerang)
- **Memilih Block**: Geser dan ketuk hotbar di bawah layar

## Instalasi & Menjalankan Game Lokal

1. Pastikan Anda sudah menginstal [Node.js](https://nodejs.org/).
2. Clone repository ini ke komputer Anda.
3. Buka terminal/command prompt di direktori project, lalu jalankan:
   ```bash
   npm install
   ```
4. Jalankan server lokal:
   ```bash
   npm start
   ```
   atau
   ```bash
   npm run dev
   ```
5. Buka web browser Anda dan akses `http://localhost:3000`

## Struktur File Project

- `index.html` - Halaman utama game, UI HUD, dan panel mobile
- `server.js` - Server statis Node.js sederhana
- `src/main.js` - Logika utama, event listener, dan inisialisasi Three.js
- `src/index.css` - Desain UI, responsive media queries, dan tema visual
- `src/world/world.js` - Logika grid dunia, fisika block, partikel hancur, dan simulasi air/lava
- `src/player/player.js` - Kontrol pergerakan player, deteksi tabrakan (collision), visual tangan 3D, dan kesehatan
- `src/entities/mob.js` - Logika monster (Zombie, Skeleton, Creeper) dan proyektil anak panah
- `src/entities/tnt.js` - Implementasi TNT (`PrimedTNT`) beserta simulasi fisika dan reaksi berantai ledakan
- `src/utils/audio.js` - Generator efek suara sintetis (Web Audio API)
- `src/utils/textures.js` - Generator tekstur block prosedural piksel retro

## Teknologi yang Digunakan

- **Three.js** (WebGL 3D Library)
- **Web Audio API** (Sintesis audio real-time)
- **Simplex Noise** (Algoritma pembuatan lanskap dunia voxel)
- **HTML5 / CSS3 / JavaScript (ES6 Modules)**

## Lisensi

Project ini dilisensikan di bawah [Lisensi MIT](LICENSE).