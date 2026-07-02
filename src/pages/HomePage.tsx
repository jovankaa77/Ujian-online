import React, { useState } from 'react';
import { LockIcon, UserIcon } from '../components/ui/Icons';

interface HomePageProps {
  navigateTo: (page: string, data?: any) => void;
  navigateBack?: () => void;
  canGoBack?: boolean;
}

const HomePage: React.FC<HomePageProps> = ({ navigateTo, navigateBack, canGoBack }) => {
  const [showRules, setShowRules] = useState(false);

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

      {/* Ketentuan Ujian Modal */}
      {showRules && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-start py-8 px-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowRules(false); }}
        >
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-screen overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-700 rounded-t-xl border-b border-gray-600">
              <h2 className="text-xl font-bold text-white">📋 Ketentuan Ujian Online</h2>
              <button
                onClick={() => setShowRules(false)}
                className="text-gray-400 hover:text-white text-2xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6 text-sm text-gray-300">

              {/* ─── BAGIAN A: RULES KETENTUAN ─── */}
              <div>
                <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wide border-b border-gray-600 pb-2">
                  A. Rules Ketentuan
                </h3>

                {/* 1 */}
                <div className="mb-5">
                  <p className="font-bold text-teal-400 mb-2">1. Ketentuan Teknis &amp; Lingkungan</p>
                  <p className="text-gray-400 mb-2 text-xs">Agar sistem dapat berjalan maksimal dan Anda tidak dirugikan oleh error teknis, penuhi syarat berikut:</p>
                  <ol className="list-decimal list-inside space-y-2 pl-2">
                    <li>
                      <span className="font-semibold text-white">Koneksi Internet Wajib Stabil</span>
                      <p className="mt-0.5 ml-4 text-gray-400">Soal ujian tipe Live Coding (HTML &amp; CSS, Python, PHP, C++, C#) membutuhkan koneksi langsung ke server compiler eksternal. Jika internet Anda tidak stabil, eksekusi kode akan gagal atau mengalami status <em>Timeout</em>.</p>
                    </li>
                    <li>
                      <span className="font-semibold text-white">Pencahayaan Ruangan (Lighting)</span>
                      <p className="mt-0.5 ml-4 text-gray-400">Pastikan wajah Anda mendapat cahaya yang cukup (tidak membelakangi cahaya/backlight). Sistem AI mendeteksi kecocokan titik wajah; pencahayaan yang buruk dapat menyebabkan AI gagal mengenali wajah Anda dan menganggapnya sebagai pelanggaran identitas.</p>
                    </li>
                    <li>
                      <span className="font-semibold text-white">Rekomendasi Browser</span>
                      <p className="mt-0.5 ml-4 text-gray-400">Gunakan Google Chrome atau Microsoft Edge versi terbaru.</p>
                    </li>
                  </ol>
                </div>

                {/* 2 */}
                <div className="mb-5">
                  <p className="font-bold text-red-400 mb-2">2. Pelanggaran Berat (Tidak Dapat Ditoleransi)</p>
                  <p className="text-gray-400 mb-2 text-xs">Pelanggaran dalam kategori ini akan mengakibatkan <span className="text-red-300 font-semibold">Diskualifikasi Otomatis</span> dan ujian akan langsung dihentikan oleh sistem.</p>
                  <ol className="list-[lower-alpha] list-inside space-y-1.5 pl-2">
                    <li><span className="font-semibold text-white">Memasang AI / Ekstensi Pihak Ketiga:</span> Terdeteksi memasang AI di dalam browser ujian, menggunakan extension pembantu (seperti ekstensi ChatGPT, Grammarly, dll).</li>
                    <li><span className="font-semibold text-white">Berpindah Tab / Jendela (Tab Switching):</span> Mengklik tab lain, meminimalkan browser, mengunjungi web AI (Google, Gemini, GPT), atau membuka aplikasi lain. <span className="text-gray-500 text-xs">(Catatan: Mengklik hasil output kode pada soal Live Coding HTML/JS tidak dihitung pelanggaran).</span></li>
                    <li><span className="font-semibold text-white">Double Device (Perangkat Ganda):</span> Login akun yang sama pada dua perangkat atau dua browser secara bersamaan.</li>
                    <li><span className="font-semibold text-white">Mencoba Fitur Terlarang:</span> Print halaman, atau menjalankan script berbahaya (seperti <code className="bg-gray-700 px-1 rounded text-xs">alert</code> atau <code className="bg-gray-700 px-1 rounded text-xs">window.open</code>) di dalam editor kode.</li>
                    <li><span className="font-semibold text-white">Memblokir Akses Kamera:</span> Mematikan izin kamera, menutup webcam secara sengaja, atau menggunakan Virtual Camera (OBS/ManyCam) saat ujian berlangsung.</li>
                  </ol>
                </div>

                {/* 3 */}
                <div className="mb-5">
                  <p className="font-bold text-yellow-400 mb-2">3. Pelanggaran Ringan (Batas Maksimal: 5 Kali)</p>
                  <p className="text-gray-400 mb-2 text-xs">Sistem memberikan toleransi untuk ketidaksengajaan. Namun, jika pelanggaran menyentuh angka maksimal <span className="text-yellow-300 font-semibold">(5 kali)</span>, ujian akan dihentikan paksa.</p>
                  <ol className="list-[lower-alpha] list-inside space-y-1.5 pl-2">
                    <li><span className="font-semibold text-white">Keluar Mode Layar Penuh / Menekan ESC:</span> Mengubah ukuran jendela browser atau menekan tombol ESC. <span className="text-gray-500 text-xs">(Jika tidak sengaja keluar, klik tombol Enter/Spasi untuk kembali ke fullscreen).</span></li>
                    <li><span className="font-semibold text-white">Mencoba Screenshot (Tangkapan Layar):</span> Percobaan menangkap atau merekam tampilan layar ujian.</li>
                    <li>
                      <span className="font-semibold text-white">Kombinasi Tombol Terlarang:</span>
                      <ul className="list-none pl-4 mt-1 space-y-0.5 text-gray-400">
                        <li>• <code className="bg-gray-700 px-1 rounded text-xs">CTRL+C</code> — Salin/Copy</li>
                        <li>• <code className="bg-gray-700 px-1 rounded text-xs">CTRL+V</code> — Tempel/Paste</li>
                        <li>• <code className="bg-gray-700 px-1 rounded text-xs">CTRL+S</code> — Simpan/Save</li>
                      </ul>
                    </li>
                  </ol>
                  <p className="mt-2 text-xs text-yellow-300 bg-yellow-900/30 border border-yellow-700 rounded px-3 py-1.5">
                    Note: Batas pelanggaran yang ditoleransi hanya 5 kali.
                  </p>
                </div>

                {/* 4 */}
                <div className="mb-5">
                  <p className="font-bold text-blue-400 mb-2">4. Pelanggaran Terdokumentasi (Hanya Mencatat Bukti)</p>
                  <p className="text-gray-400 mb-2 text-xs">Pelanggaran ini tidak menghentikan ujian secara otomatis, tetapi sistem akan mengambil foto diam-diam dan mendokumentasikannya ke dasbor dosen untuk ditindaklanjuti secara manual.</p>
                  <ol className="list-[lower-alpha] list-inside space-y-1.5 pl-2">
                    <li><span className="font-semibold text-white">Wajah Ganda Terdeteksi:</span> Terdapat lebih dari satu orang di dalam tangkapan layar kamera.</li>
                    <li><span className="font-semibold text-white">Identitas Berbeda:</span> Wajah peserta yang mengerjakan ujian tidak cocok dengan foto identitas (baseline) saat verifikasi awal.</li>
                    <li><span className="font-semibold text-white">Wajah Tidak Dikenal / Tidak Terdeteksi:</span> Meninggalkan layar, wajah keluar dari frame kamera dalam waktu lama, atau wajah tidak dapat dikenali oleh sistem.</li>
                  </ol>
                </div>

                {/* 5 */}
                <div className="mb-2">
                  <p className="font-bold text-green-400 mb-2">5. Pemeriksaan Perangkat Sebelum Ujian (Pre-Check)</p>
                  <p className="text-gray-400 mb-2 text-xs">Sebelum tombol "Mulai Ujian" dapat diakses, sistem akan melakukan pengecekan otomatis terhadap perangkat Anda:</p>
                  <ol className="list-[lower-alpha] list-inside space-y-1.5 pl-2">
                    <li><span className="font-semibold text-white">Akses dari Desktop</span> — Memastikan akses melalui PC/Laptop, bukan Smartphone atau Tablet.</li>
                    <li><span className="font-semibold text-white">Layar Tunggal</span> — Sistem memastikan Anda hanya menggunakan satu monitor aktif.</li>
                    <li><span className="font-semibold text-white">Akses Kamera</span> — Kamera web aktif dan izin akses telah diberikan.</li>
                    <li><span className="font-semibold text-white">Akses Mikrofon</span> — Mikrofon aktif untuk memantau tingkat kebisingan area pengerjaan.</li>
                    <li><span className="font-semibold text-white">Ekstensi Browser Aman</span> — Tidak ada ekstensi terlarang yang aktif di browser.</li>
                    <li><span className="font-semibold text-white">Verifikasi Wajah</span> — Sistem memindai dan mencocokkan wajah Anda dengan data identitas profil secara real-time.</li>
                  </ol>
                </div>
              </div>

              {/* ─── BAGIAN B: ALUR PENGERJAAN ─── */}
              <div>
                <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wide border-b border-gray-600 pb-2">
                  B. Alur Pengerjaan Ujian Online
                </h3>
                <ol className="list-decimal list-inside space-y-3 pl-2">
                  <li>
                    <span className="font-semibold text-white">Input Kode Akses</span>
                    <p className="mt-0.5 ml-4 text-gray-400">Masukkan kode ujian pada kolom yang tersedia, lalu klik tombol <span className="text-teal-400 font-semibold">"Ajukan ujian baru"</span>.</p>
                  </li>
                  <li>
                    <span className="font-semibold text-white">Verifikasi Dosen</span>
                    <p className="mt-0.5 ml-4 text-gray-400">Silakan menunggu dosen melakukan validasi dan memberikan persetujuan (ACC) atas kode akses Anda.</p>
                  </li>
                  <li>
                    <span className="font-semibold text-white">Akses Ruang Ujian</span>
                    <p className="mt-0.5 ml-4 text-gray-400">Setelah mendapatkan persetujuan, sistem akan membuka akses ke ruang ujian.</p>
                  </li>
                  <li>
                    <span className="font-semibold text-white">Pemeriksaan Perangkat (Pre-Check)</span>
                    <p className="mt-0.5 ml-4 text-gray-400 mb-1">Sistem akan melakukan pemindaian otomatis terhadap perangkat Anda, mencakup:</p>
                    <ul className="list-none pl-8 space-y-0.5 text-gray-400">
                      <li>a) Akses dari Desktop</li>
                      <li>b) Pemeriksaan layar tunggal</li>
                      <li>c) Pengujian kamera</li>
                      <li>d) Akses mikrofon</li>
                      <li>e) Pemeriksaan ekstensi browser</li>
                      <li>f) Verifikasi wajah</li>
                    </ul>
                  </li>
                  <li>
                    <span className="font-semibold text-white">Mulai Ujian</span>
                    <p className="mt-0.5 ml-4 text-gray-400">Setelah seluruh pemeriksaan perangkat berhasil dilewati, tombol <span className="text-green-400 font-semibold">"Mulai Ujian"</span> akan aktif dan ujian dapat segera dimulai.</p>
                  </li>
                </ol>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-700 rounded-b-xl border-t border-gray-600 flex justify-end">
              <button
                onClick={() => setShowRules(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
