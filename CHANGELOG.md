# Changelog - NizamCraft

Semua perubahan penting pada proyek **NizamCraft** akan didokumentasikan di berkas ini. Format penulisan didasarkan pada [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.0.0] - 2026-07-01
### Added
- **Karakter Mobs Baru**:
  - **Blood Golem**: Monster crimson bermata merah (400 HP, speed 1.8) yang sangat agresif menyerang pemain dan hewan pasif.
  - **Giant Iron Golem**: Golem pelindung raksasa (tinggi 6m, 1000 HP) yang bersahabat kepada pemain dan membasmi monster jahat dengan melempar mereka ke udara (120 damage).
  - **Wither Skeleton**: Skeleton hitam bermutasi (150 HP, bersenjatakan pedang batu) yang memberikan efek debuff **Wither Decay** (kilatan layar redup gelap, damage berkelanjutan selama 5 detik).
- **Sistem Inventaris Tas (24 Slot)**:
  - Tombol keyboard `E` / `I` dan tombol melayang 🎒 untuk membuka/menutup antarmuka Tas.
  - Layout slot grid glassmorphism premium lengkap dengan jumlah tumpukan item (stack max 64) dan sorotan slot aktif terpilih.
- **Mekanik Armor & HUD Shield**:
  - Slot perlengkapan: Helmet, Chestplate, Leggings, dan Boots.
  - Pengurangan damage masuk pada `takeDamage()` dihitung dinamis dari total armor terpasang.
  - Penambahan visual Bar Pertahanan HUD (Armor Bar) dengan gradasi biru tameng.
- **Peti Penyimpanan (Chest Storage)**:
  - Penempatan blok peti (`chest`) kustom.
  - Klik kanan (atau tombol aksi mobile) pada blok peti membuka menu penyimpanan 18 slot yang interaktif untuk memindahkan barang satu arah/dua arah dengan cepat.
- **Dropping Item Hasil Tambang**:
  - Blok tambang (Batu bara, besi, emas, tanah, dll.) yang dihancurkan akan masuk langsung ke Tas pemain.
  - Menambang daun (`leaf`) berpeluang 15% menjatuhkan **Apel Emas (Golden Apple)**.
  - Menghancurkan peti yang berisi barang otomatis mengeluarkan isi peti kembali ke Tas pemain.
- **Konsumsi Apel Emas**: Memulihkan **+50 HP** secara instan dengan efek transisi kilatan layar emas premium.
- **Konversi Dinamis Lava**: Lava yang bersentuhan dengan Air yang mengalir di sekelilingnya seketika bertransformasi menjadi blok keras **Obsidian**.
- **Sinkronisasi LocalStorage**: Menyimpan otomatis posisi, sisa HP, isi Tas pemain, perlengkapan Armor, dan seluruh isi Peti berdasarkan koordinat saat menutup halaman atau menekan simpan.

---

## [2.0.0] - 2026-06-15
### Added
- **Blok Magma Vulkanik**: Memberikan efek damage over time sebesar 6 HP setiap 500ms saat pemain menginjaknya, lengkap dengan partikel asap pembakaran hitam.
- **Hewan Pasif (Chicken, Pig, Cow)**:
  - Berkeliaran dengan damai di dunia voxel.
  - Mengalahkan hewan memberikan asupan pemulihan HP (Chicken: +15 HP, Pig: +25 HP, Cow: +35 HP) disertai kilatan hijau penyembuhan di layar.
- **Pertumbuhan Tanaman Kontekstual**:
  - Tombol kontekstual melayang "Tanam Benih (P)" saat memandang ke blok Farmland kosong.
  - Bibit gandum tumbuh secara bertahap dan matang penuh dalam 5 detik, diselimuti partikel pertumbuhan hijau cerah.
- **Chain Reaction Ledakan TNT**: Ledakan satu TNT akan memicu ledakan berantai pada blok TNT tetangga dengan delay waktu acak yang realistis.
- **Dukungan Mobile & Touch Screen**:
  - Virtual joystick pergerakan yang mulus.
  - Tombol aksi mobile terpisah (Shoot Arrow 🏹, Attack ⚔️, Dig ⛏️, Build 🧱, Jump ▲) dengan tata letak ergonomis.
- **Optimasi iOS Safari & Macbook**:
  - Menggunakan CSS dynamic viewport height (`100dvh`) agar tidak terpotong address bar.
  - Blokir context menu mouse kanan untuk trackpad Macbook.
- **Sound Effect Sintetis**: Generator suara real-time berbasis Web Audio API (tanpa file audio luar).
- **Lava Rendering Boost**: Meningkatkan batas instanced mesh lava hingga 15.000 blok.

---

## [1.0.0] - 2026-05-20
### Added
- Rilis awal game voxel 3D NizamCraft berbasis browser.
- Pembangkitan terrain tak terbatas menggunakan algoritma Simplex Noise.
- Navigasi kamera first-person dengan controls Pointer Lock.
- Menaruh dan memecahkan blok dasar (Grass, Dirt, Stone, Wood, Brick, dll.).
- Model tangan 3D pertama dengan animasi ayunan saat menggali blok.
- Sistem penyimpanan LocalStorage sederhana untuk koordinat dan status dunia.
