import React, { useEffect } from 'react';
import { useKaraoke } from '../context/KaraokeContext';
import { getScoreQuote } from '../types/karaoke';

export const SongScoreModal: React.FC = () => {
  const {
    isTvMode,
    currentScoreData,
    isScoreModalOpen,
    setIsScoreModalOpen,
  } = useKaraoke();

  useEffect(() => {
    if (!isScoreModalOpen || !currentScoreData) return;

    // KETENTUAN: Kotak penilaian & Quote muncul 1 menit sebelum lagu berakhir & lagu tetap berputar lancar tanpa suara/musik pengganggu
    const autoDismissTimer = setTimeout(() => {
      setIsScoreModalOpen(false);
    }, 30000);

    return () => {
      clearTimeout(autoDismissTimer);
    };
  }, [isScoreModalOpen, currentScoreData, setIsScoreModalOpen]);

  // Pada TV stage mode, kotak penilaian & Quote besar ditampilkan langsung di komponen TVStageMode
  if (!isScoreModalOpen || !currentScoreData || isTvMode) return null;

  const votes =
    currentScoreData.juryVotes && currentScoreData.juryVotes.length > 0
      ? currentScoreData.juryVotes
      : ['iwan', 'rudi', 'rojikan', 'tomas', 'awan'].map((name, idx) => ({
          clientId: `default-${idx + 1}`,
          juryName: name,
          score: currentScoreData.totalScore,
          songId: currentScoreData.song?.id || '',
          songTitle: currentScoreData.song?.title || '',
          submittedAt: Date.now(),
        }));

  const sumScore = votes.reduce((acc, v) => acc + v.score, 0);
  const avgScore = Math.round(sumScore / votes.length);
  const scoreExpression = votes.map((v) => v.score).join('+');
  const scoreQuote = getScoreQuote(avgScore, currentScoreData.evaluatedAt);

  return (
    <aside
      role="dialog"
      aria-label="Penilaian Dewan Juri Prajurit"
      className="fixed top-10 sm:top-14 left-1/2 -translate-x-1/2 z-[85] pointer-events-auto cursor-pointer w-[94vw] max-w-2xl"
      onClick={() => setIsScoreModalOpen(false)}
      title="Klik untuk menutup skor"
    >
      <div className="relative glass-score-panel rounded-2xl px-5 sm:px-8 py-4 sm:py-5 text-white select-none shadow-2xl border-2 border-amber-400/80">
        <div className="flex flex-col items-center justify-center text-center">
          {/* Header Dewan Juri Prajurit */}
          <div className="text-[10px] sm:text-xs font-black tracking-[0.22em] uppercase text-amber-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] mb-0.5">
            DEWAN JURI PRAJURIT ({votes.length} JURI)
          </div>

          {/* Angka Nilai Rata-Rata: Sangat besar, tebal, dan elegan */}
          <div className="flex items-baseline justify-center my-0">
            <span className="score-giant-number text-6xl sm:text-7xl md:text-8xl font-black tracking-tight leading-none">
              {avgScore}
            </span>
          </div>

          {/* TULISAN BESAR QUOTE SESUAI PENILAIAN (SAAT 1 MENIT SEBELUM LAGU BERAKHIR) */}
          <div className="mt-2.5 mb-1 w-full rounded-xl bg-gradient-to-r from-amber-500/25 via-yellow-400/30 to-amber-500/25 border-2 border-amber-300/90 px-4 py-2.5 shadow-[0_0_25px_rgba(251,191,36,0.45)]">
            <p className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wide text-amber-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] leading-tight">
              &ldquo;{scoreQuote}&rdquo;
            </p>
          </div>

          {/* Akumulasi Nilai Juri & Rata-Rata sesuai logika dewan juri */}
          <div className="mt-2.5 pt-2 border-t border-sky-400/35 w-full text-left font-mono text-[11px] sm:text-xs bg-slate-950/75 rounded-xl px-3.5 py-2.5 border border-amber-400/30 shadow-inner">
            <div className="font-black text-amber-300 mb-1">
              dewan juri :
            </div>
            <div className="space-y-0.5 text-slate-100 pl-1">
              {votes.map((v, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3">
                  <span>
                    {idx + 1}. {v.juryName.toLowerCase()} penilaian :{' '}
                    <strong className="text-amber-300 font-black">{v.score}</strong>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-1.5 border-t border-sky-500/30 font-black text-emerald-300 text-xs sm:text-sm tracking-tight">
              skor total {scoreExpression}={sumScore}:{votes.length}={'  '}
              <span className="text-amber-300 text-sm sm:text-base underline decoration-amber-400">{avgScore}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};


