# Simulasi Tata Air Kebun Sawit Gambut (wm-3d)

Simulasi 3D berbasis web (Three.js, tanpa build) yang menggambarkan hubungan
**curah hujan → TMAT (piezometer) → TMAS (saluran) → pembuangan (pintu air)** di satu blok kebun
kelapa sawit di lahan gambut.

> Status: dalam pengembangan. Lihat `docs/rencana.md` untuk rencana yang disetujui.

## Menjalankan

```bash
python3 -m http.server 8000   # lalu buka http://localhost:8000/
```

Membuka `index.html` langsung lewat `file://` tidak akan berjalan (ES modules butuh server).
