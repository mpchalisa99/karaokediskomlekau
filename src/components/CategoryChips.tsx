import React from 'react';
import { Flame, Sun, Radio, Music, Disc, Sparkles, Shield, Globe, RefreshCw } from 'lucide-react';
import { CATEGORY_PRESETS } from '../services/youtube';
import { useKaraoke } from '../context/KaraokeContext';

const ICON_MAP: Record<string, React.ReactNode> = {
  Flame: <Flame className="h-3.5 w-3.5" />,
  Sun: <Sun className="h-3.5 w-3.5" />,
  Radio: <Radio className="h-3.5 w-3.5" />,
  Music: <Music className="h-3.5 w-3.5" />,
  Disc: <Disc className="h-3.5 w-3.5" />,
  Sparkles: <Sparkles className="h-3.5 w-3.5" />,
  Globe: <Globe className="h-3.5 w-3.5" />,
  Shield: <Shield className="h-3.5 w-3.5" />,
};

export const CategoryChips: React.FC = () => {
  const {
    executeSearch,
    activeCategory,
    setSearchQuery,
    refreshHitsIndonesia,
    isRefreshingHits,
  } = useKaraoke();

  const handleChipClick = (id: string, query: string) => {
    if (id === 'hits-indonesia') {
      setSearchQuery('');
      executeSearch('', id);
      return;
    }
    setSearchQuery(query);
    executeSearch(query, id);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Music className="h-3.5 w-3.5 text-sky-400" />
          <span>Kategori Lagu Populer:</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refreshHitsIndonesia()}
            disabled={isRefreshingHits}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/60 hover:bg-rose-900/70 px-2.5 py-1 text-[11px] font-bold text-rose-200 transition disabled:opacity-50 cursor-pointer"
            title="Ambil tren musik karaoke Indonesia terbaru dari YouTube dan simpan ke cache"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshingHits ? 'animate-spin' : ''}`} />
            <span>{isRefreshingHits ? 'Memperbarui Tren...' : 'Update Tren Hits'}</span>
          </button>
          <span className="hidden sm:inline text-[11px] text-slate-400">Sentuh untuk memuat daftar lagu</span>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORY_PRESETS.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleChipClick(cat.id, cat.query)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all duration-150 border ${
                isActive
                  ? 'border-sky-400 bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'border-sky-900/60 bg-[#071533] text-slate-300 hover:border-sky-500 hover:bg-sky-900/40 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-white' : 'text-sky-400'}>
                {ICON_MAP[cat.iconName] || <Music className="h-3.5 w-3.5" />}
              </span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
