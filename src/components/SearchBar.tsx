import React, { useState } from 'react';
import { Search, Loader2, Sparkles, Filter, Link as LinkIcon, Plus, Check, Radio } from 'lucide-react';
import { useKaraoke } from '../context/KaraokeContext';
import { SuffixFilter } from '../types/karaoke';
import { buildKaraokeQuery } from '../services/youtube';

export const SearchBar: React.FC = () => {
  const {
    searchQuery,
    setSearchQuery,
    suffixFilter,
    setSuffixFilter,
    executeSearch,
    isSearching,
    addDirectVideoUrl,
    defaultSingerName,
  } = useKaraoke();

  const [showDirectLink, setShowDirectLink] = useState(false);
  const [directUrl, setDirectUrl] = useState('');
  const [directSinger, setDirectSinger] = useState('');
  const [directSuccess, setDirectSuccess] = useState(false);
  const [directError, setDirectError] = useState('');

  const [isResolvingDirect, setIsResolvingDirect] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      executeSearch();
    }
  };

  const handleDirectAction = async (playImmediately: boolean) => {
    setDirectError('');
    if (!directUrl.trim()) return;

    setIsResolvingDirect(true);
    const ok = await addDirectVideoUrl(directUrl.trim(), directSinger.trim() || defaultSingerName, playImmediately);
    setIsResolvingDirect(false);

    if (ok) {
      setDirectSuccess(true);
      setDirectUrl('');
      setDirectSinger('');
      setTimeout(() => setDirectSuccess(false), 3000);
    } else {
      setDirectError('Format tautan atau Video ID tidak valid. Contoh: https://youtu.be/xxx atau https://youtube.com/watch?v=xxx');
    }
  };

  const currentProcessedQuery = buildKaraokeQuery(searchQuery, suffixFilter);

  const SUFFIX_OPTIONS: { id: SuffixFilter; label: string; tooltip: string }[] = [
    { id: 'karaoke', label: '🎤 +Karaoke', tooltip: 'Prioritaskan video versi karaoke' },
    { id: 'no vocal', label: '🔇 +Tanpa Vokal', tooltip: 'Prioritaskan video tanpa vokal' },
    { id: 'instrumental', label: '🎹 +Instrumental', tooltip: 'Prioritaskan video instrumental' },
    { id: 'none', label: '🌐 Semua Video YouTube (Bebas)', tooltip: 'Akses bebas ke SELURUH video YouTube (Klip asli, official MV, live, dll)' },
  ];

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-sky-900/60 bg-[#07132c]/90 p-3.5 sm:p-4 shadow-xl backdrop-blur-md">
      {/* Primary Search Form */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
          {/* Search Input Box */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sky-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                suffixFilter === 'none'
                  ? 'Cari video apa saja di YouTube atau tempel tautan/link YouTube...'
                  : 'Ketik judul lagu, artis, atau tempel link YouTube...'
              }
              className="w-full rounded-xl border border-sky-900/80 bg-[#040b1a] py-2.5 pl-10 pr-16 text-sm text-white placeholder-slate-400 outline-none transition focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-slate-400 hover:text-white"
              >
                Hapus
              </button>
            )}
          </div>

          {/* Suffix Filter Options (Termasuk Pilihan Akses Bebas Semua Video YouTube) */}
          <div className="flex items-center gap-1 bg-[#040b1a] border border-sky-900/80 rounded-xl p-1 shrink-0 overflow-x-auto no-scrollbar">
            {SUFFIX_OPTIONS.map((opt) => {
              const isSelected = suffixFilter === opt.id;
              const isAllVideo = opt.id === 'none';
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSuffixFilter(opt.id)}
                  title={opt.tooltip}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition whitespace-nowrap flex items-center gap-1 ${
                    isSelected
                      ? isAllVideo
                        ? 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-md shadow-red-950/60 border border-amber-300/40'
                        : 'bg-sky-600 text-white shadow-sm'
                      : isAllVideo
                      ? 'text-amber-300 hover:bg-[#1a0f26] hover:text-amber-200'
                      : 'text-slate-300 hover:bg-[#091838] hover:text-white'
                  }`}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Submit Button */}
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-sky-600/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 border border-sky-400/40"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-sky-200" />
                <span>Mencari...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Cari Video</span>
              </>
            )}
          </button>
        </div>

        {/* Bottom Helpers & Active Mode Indicator */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1 pt-1 gap-2">
          <div className="truncate flex items-center gap-2">
            {suffixFilter === 'none' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-950/70 border border-red-500/50 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-ping" />
                <span>Mode Bebas Aktif: Menampilkan SEMUA Video dari YouTube (Klip Asli, Official MV, Live, Mars)</span>
              </span>
            ) : searchQuery.trim() ? (
              <span className="text-[11px] text-sky-300">
                Pencarian aktif: <strong>"{currentProcessedQuery}"</strong>
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Mencari versi karaoke. Pilih tab <strong>"🌐 Semua Video YouTube"</strong> di atas untuk memutar video klip bebas apa saja.
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowDirectLink(!showDirectLink)}
            className="text-[11px] font-bold text-sky-400 hover:text-amber-300 transition flex items-center gap-1 shrink-0 ml-auto"
          >
            <LinkIcon className="h-3 w-3 text-amber-400" />
            <span>{showDirectLink ? 'Tutup Akses Link' : '+ Akses Link YouTube Langsung'}</span>
          </button>
        </div>
      </form>

      {/* Expandable Direct Link & Video ID Access Panel */}
      {showDirectLink && (
        <div className="mt-1 p-3.5 rounded-xl bg-[#040b1a] border border-sky-800/80 flex flex-col gap-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-bold text-amber-300">
            <span className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5 text-amber-400" />
              <span>Akses Tautan / Video ID YouTube Apapun Secara Langsung:</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal">Mendukung link youtu.be, youtube.com, atau 11-digit ID</span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="text"
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              placeholder="Tempel link YouTube (cth: https://youtu.be/xxx atau https://www.youtube.com/watch?v=xxx)"
              className="flex-1 rounded-lg border border-sky-900 bg-[#07132c] py-2 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
            />

            <input
              type="text"
              value={directSinger}
              onChange={(e) => setDirectSinger(e.target.value)}
              placeholder={`Nama/Callsign (${defaultSingerName})`}
              className="w-full sm:w-44 rounded-lg border border-sky-900 bg-[#07132c] py-2 px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-sky-400"
            />

            <div className="flex items-center gap-2 shrink-0">
              {/* Play Immediately Button */}
              <button
                type="button"
                onClick={() => handleDirectAction(true)}
                disabled={isResolvingDirect || !directUrl.trim()}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition active:scale-95 disabled:opacity-40 shadow-sm"
                title="Putar video langsung di layar TV sekarang"
              >
                <Radio className="h-3.5 w-3.5" />
                <span>Putar di TV</span>
              </button>

              {/* Add to Queue Button */}
              <button
                type="button"
                onClick={() => handleDirectAction(false)}
                disabled={isResolvingDirect || !directUrl.trim()}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-xs font-bold text-white transition active:scale-95 disabled:opacity-40 shadow-sm"
                title="Tambahkan video ke antrean berikutnya"
              >
                {directSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Tersimpan!</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Antrean</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {directError && <p className="text-xs text-rose-400 font-semibold">{directError}</p>}
        </div>
      )}
    </div>
  );
};
