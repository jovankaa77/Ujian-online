import React, { useState } from 'react';
import { LockIcon, UserIcon } from '../components/ui/Icons';

interface HomePageProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack?: () => void;
  canGoBack?: boolean;
}

const HomePage: React.FC<HomePageProps> = ({ navigateTo, navigateBack, canGoBack }) => {
  const [showRules, setShowRules] = useState(false);

  if (showRules) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-200 overflow-y-auto">
        {/* Top nav */}
        <div className="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between shadow-md">
          <h1 className="text-xl font-bold text-white">📋 Ketentuan Ujian Online</h1>
          <button
            onClick={() => setShowRules(false)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg transition-colors text-sm"
          >
            ← Kembali ke Beranda
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">

          {/* ─── BAGIAN A ─── */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-6 pb-3 border-b-2 border-teal-500">
              A. Rules Ketentuan
            </h2>

            {/* 1. Teknis */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-teal-400 mb-3">
                1. Ketentuan Teknis &amp; Lingkungan
              </h3>
              <p className="text-gray-400 mb-4">
                Agar sistem dapat berjalan maksimal dan Anda tidak dirugikan oleh error teknis, penuhi syarat berikut:
              </p>
              <ol className="space-y-4 list-decimal list-inside">
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Koneksi Internet Wajib Stabil</span>
                  <p className="mt-1 ml-5 text-gray-400">
                    Soal ujian tipe Live Coding (HTML &amp; CSS, Python, PHP, C++, C#) membutuhkan koneksi langsung ke server compiler eksternal. Jika internet Anda tidak stabil, eksekusi kode akan gagal atau mengalami status <em>Timeout</em>.
                  </p>
                </li>
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Pencahayaan Ruangan (Lighting)</span>
                  <p className="mt-1 ml-5 text-gray-400">
                    Pastikan wajah Anda mendapat cahaya yang cukup (tidak membelakangi cahaya/backlight). Sistem AI mendeteksi kecocokan titik wajah; pencahayaan yang buruk dapat menyebabkan AI gagal mengenali wajah Anda dan menganggapnya sebagai pelanggaran identitas.
                  </p>
                </li>
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Rekomendasi Browser</span>
                  <p className="mt-1 ml-5 text-gray-400">
                    Gunakan Google Chrome atau Microsoft Edge versi terbaru.
                  </p>
                </li>
              </ol>
            </div>

            {/* 2. Pelanggaran Berat */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-red-400 mb-3">
                2. Pelanggaran Berat (Tidak Dapat Ditoleransi)
              </h3>
              <div className="bg-red-950/40 border border-red-700 rounded-lg px-5 py-3 mb-4">
                <p className="text-red-300 font-semibold text-sm">
                  ⚠ Pelanggaran dalam kategori ini mengakibatkan Diskualifikasi Otomatis — ujian langsung dihentikan oleh sistem.
                </p>
              </div>
              <ol className="space-y-3 list-[lower-alpha] list-inside">
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Memasang AI / Ekstensi Pihak Ketiga:</span>
                  <span className="text-gray-400"> Terdeteksi memasang AI di dalam browser ujian, menggunakan extension pembantu (seperti ekstensi ChatGPT, Grammarly, dll).</span>
                </li>
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Berpindah Tab / Jendela (Tab Switching):</span>
                  <span className="text-gray-400"> Mengklik tab lain, meminimalkan browser, mengunjungi web AI (Google, Gemini, GPT), atau membuka aplikasi lain.</span>
                  <span className="block ml-5 mt-1 text-gray-500 text-sm">Catatan: Mengklik hasil output kode pada soal Live Coding HTML/JS tidak dihitung sebagai pelanggaran.</span>
                </li>
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Double Device (Perangkat Ganda):</span>
                  <span className="text-gray-400"> Login akun yang sama pada dua perangkat atau dua browser secara bersamaan.</span>
                </li>
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Mencoba Fitur Terlarang:</span>
                  <span className="text-gray-400"> Print halaman, atau menjalankan script berbahaya (seperti </span>
                  <code className="bg-gray-700 px-1.5 py-0.5 rounded text-sm">alert</code>
                  <span className="text-gray-400"> atau </span>
                  <code className="bg-gray-700 px-1.5 py-0.5 rounded text-sm">window.open</code>
                  <span className="text-gray-400">) di dalam editor kode.</span>
                </li>
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Memblokir Akses Kamera:</span>
                  <span className="text-gray-400"> Mematikan izin kamera, menutup webcam secara sengaja, atau menggunakan Virtual Camera (OBS/ManyCam) saat ujian berlangsung.</span>
                </li>
              </ol>
            </div>

            {/* 3. Pelanggaran Ringan */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-yellow-400 mb-3">
                3. Pelanggaran Ringan (Batas Maksimal: 5 Kali)
              </h3>
              <div className="bg-yellow-950/40 border border-yellow-700 rounded-lg px-5 py-3 mb-4">
                <p className="text-yellow-300 font-semibold text-sm">
                  ⚠ Sistem memberikan toleransi untuk ketidaksengajaan. Jika pelanggaran menyentuh angka maksimal (5 kali), ujian akan dihentikan paksa.
                </p>
              </div>
              <ol className="space-y-3 list-[lower-alpha] list-inside">
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Keluar Mode Layar Penuh / Menekan ESC:</span>
                  <span className="text-gray-400"> Mengubah ukuran jendela browser atau menekan tombol ESC.</span>
                  <span className="block ml-5 mt-1 text-gray-500 text-sm">Jika tidak sengaja keluar, klik tombol Enter/Spasi untuk kembali ke mode layar penuh.</span>
                </li>
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Mencoba Screenshot (Tangkapan Layar):</span>
                  <span className="text-gray-400"> Percobaan menangkap atau merekam tampilan layar ujian.</span>
                </li>
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Kombinasi Tombol Terlarang:</span>
                  <div className="ml-5 mt-2 space-y-1">
                    <p className="text-gray-400"><code className="bg-gray-700 px-1.5 py-0.5 rounded text-sm">CTRL+C</code> — Salin/Copy</p>
                    <p className="text-gray-400"><code className="bg-gray-700 px-1.5 py-0.5 rounded text-sm">CTRL+V</code> — Tempel/Paste</p>
                    <p className="text-gray-400"><code className="bg-gray-700 px-1.5 py-0.5 rounded text-sm">CTRL+S</code> — Simpan/Save</p>
                  </div>
                </li>
              </ol>
            </div>

            {/* 4. Terdokumentasi */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-blue-400 mb-3">
                4. Pelanggaran Terdokumentasi (Hanya Mencatat Bukti)
              </h3>
              <p className="text-gray-400 mb-4">
                Pelanggaran ini tidak menghentikan ujian secara otomatis, tetapi sistem akan mengambil foto diam-diam dan mendokumentasikannya ke dasbor dosen untuk ditindaklanjuti secara manual.
              </p>
              <ol className="space-y-3 list-[lower-alpha] list-inside">
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Wajah Ganda Terdeteksi:</span>
                  <span className="text-gray-400"> Terdapat lebih dari satu orang di dalam tangkapan layar kamera.</span>
                </li>
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Identitas Berbeda:</span>
                  <span className="text-gray-400"> Wajah peserta yang mengerjakan ujian tidak cocok dengan foto identitas (baseline) saat verifikasi awal.</span>
                </li>
                <li className="leading-relaxed">
                  <span className="font-semibold text-white">Wajah Tidak Dikenal / Tidak Terdeteksi:</span>
                  <span className="text-gray-400"> Meninggalkan layar, wajah keluar dari frame kamera dalam waktu lama, atau wajah tidak dapat dikenali oleh sistem.</span>
                </li>
              </ol>
            </div>

            {/* 5. Pre-Check */}
            <div className="mb-2">
              <h3 className="text-lg font-bold text-green-400 mb-3">
                5. Pemeriksaan Perangkat Sebelum Ujian (Pre-Check)
              </h3>
              <p className="text-gray-400 mb-4">
                Sebelum tombol "Mulai Ujian" dapat diakses, sistem akan melakukan pengecekan otomatis terhadap perangkat Anda:
              </p>
              <ol className="space-y-2 list-[lower-alpha] list-inside">
                <li className="text-gray-300"><span className="font-semibold text-white">Akses dari Desktop</span> — Memastikan akses melalui PC/Laptop, bukan Smartphone atau Tablet.</li>
                <li className="text-gray-300"><span className="font-semibold text-white">Layar Tunggal</span> — Memastikan Anda hanya menggunakan satu monitor aktif.</li>
                <li className="text-gray-300"><span className="font-semibold text-white">Akses Kamera</span> — Kamera web aktif dan izin akses telah diberikan kepada sistem.</li>
                <li className="text-gray-300"><span className="font-semibold text-white">Akses Mikrofon</span> — Mikrofon aktif untuk memantau tingkat kebisingan area pengerjaan.</li>
                <li className="text-gray-300"><span className="font-semibold text-white">Ekstensi Browser Aman</span> — Tidak ada ekstensi terlarang yang aktif di browser.</li>
                <li className="text-gray-300"><span className="font-semibold text-white">Verifikasi Wajah</span> — Sistem memindai dan mencocokkan wajah Anda dengan data identitas profil secara real-time.</li>
              </ol>
            </div>
          </section>

          {/* ─── BAGIAN B ─── */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-6 pb-3 border-b-2 border-blue-500">
              B. Alur Pengerjaan Ujian Online
            </h2>
            <ol className="space-y-6 list-decimal list-inside">
              <li className="leading-relaxed">
                <span className="font-semibold text-white text-base">Input Kode Akses</span>
                <p className="mt-1 ml-5 text-gray-400">
                  Masukkan kode ujian pada kolom yang tersedia, lalu klik tombol <span className="text-teal-400 font-semibold">"Ajukan ujian baru"</span>.
                </p>
              </li>
              <li className="leading-relaxed">
                <span className="font-semibold text-white text-base">Verifikasi Dosen</span>
                <p className="mt-1 ml-5 text-gray-400">
                  Silakan menunggu dosen melakukan validasi dan memberikan persetujuan (ACC) atas kode akses Anda.
                </p>
              </li>
              <li className="leading-relaxed">
                <span className="font-semibold text-white text-base">Akses Ruang Ujian</span>
                <p className="mt-1 ml-5 text-gray-400">
                  Setelah mendapatkan persetujuan, sistem akan membuka akses ke ruang ujian.
                </p>
              </li>
              <li className="leading-relaxed">
                <span className="font-semibold text-white text-base">Pemeriksaan Perangkat (Pre-Check)</span>
                <p className="mt-1 ml-5 text-gray-400 mb-2">
                  Sistem akan melakukan pemindaian otomatis terhadap perangkat Anda, mencakup:
                </p>
                <ol className="ml-5 space-y-1 list-[lower-alpha] list-inside text-gray-400">
                  <li>Akses dari Desktop</li>
                  <li>Pemeriksaan layar tunggal</li>
                  <li>Pengujian kamera</li>
                  <li>Akses mikrofon</li>
                  <li>Pemeriksaan ekstensi browser</li>
                  <li>Verifikasi wajah</li>
                </ol>
              </li>
              <li className="leading-relaxed">
                <span className="font-semibold text-white text-base">Mulai Ujian</span>
                <p className="mt-1 ml-5 text-gray-400">
                  Setelah seluruh pemeriksaan perangkat berhasil dilewati, tombol <span className="text-green-400 font-semibold">"Mulai Ujian"</span> akan aktif dan ujian dapat segera dimulai.
                </p>
              </li>
            </ol>
          </section>

          {/* Bottom CTA */}
          <div className="flex justify-center pt-4 pb-8">
            <button
              onClick={() => setShowRules(false)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-12 rounded-lg text-base transition-colors shadow-lg"
            >
              Mengerti, Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen -my-16">
      {canGoBack && navigateBack && (
        <button
          onClick={navigateBack}
          className="absolute top-8 left-8 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
        >
          &larr; Kembali
        </button>
      )}
      <h1 className="text-4xl md:text-6xl font-bold mb-4 text-center" style={{ color: '#ffffff' }}>
        Platform Ujian Online
      </h1>
      <p className="text-lg text-gray-400 mb-12 text-center">
        Pengawasan dari jarak jauh
      </p>
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 items-center">
        <button
          onClick={() => navigateTo('teacher_dashboard', { currentUser: { id: 'teacher_default', role: 'teacher' } })}
          className="flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105"
        >
          <LockIcon /> Saya Pengawas
        </button>
        <button
          onClick={() => navigateTo('student_auth_choice')}
          className="flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105"
        >
          <UserIcon /> Saya Peserta Ujian
        </button>
        <button
          onClick={() => setShowRules(true)}
          className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105"
        >
          📋 Ketentuan Ujian
        </button>
      </div>
    </div>
  );
};

export default HomePage;
