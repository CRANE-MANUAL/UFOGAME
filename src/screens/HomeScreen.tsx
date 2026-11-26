import { Layers, Play, Settings, Trophy } from 'lucide-react';
import { HomeHeroCanvas } from '../components/HomeHeroCanvas';
import type { PlayerSaveData } from '../types/game';

interface HomeScreenProps {
  saveData: PlayerSaveData;
  onStartGame: () => void;
  onOpenStages: () => void;
  onOpenSettings: () => void;
}

export function HomeScreen({
  saveData,
  onStartGame,
  onOpenStages,
  onOpenSettings,
}: HomeScreenProps) {
  return (
    <div className="relative flex flex-col w-full h-full max-w-md mx-auto bg-slate-950 text-white overflow-hidden shadow-2xl">
      {/* Top Status Strip */}
      <header className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2 bg-slate-950/90 border-b border-white/10">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <span className="font-display font-bold text-amber-400 font-mono-num">
            Lv.{saveData.level}
          </span>
          <span className="text-slate-500" aria-hidden="true">
            ·
          </span>
          <span className="truncate max-w-[120px]">{saveData.playerName}</span>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-bold text-amber-300 font-mono-num">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{saveData.totalWins}</span>
        </div>
      </header>

      {/* Center 3D Hook & Ring Showcase */}
      <main className="relative flex-1 min-h-0">
        <HomeHeroCanvas />

        {/* Title Overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent">
          <p className="text-xs font-medium tracking-wider text-amber-400 mb-1">
            3D HOOK &amp; RING ARCADE
          </p>
          <h1
            className="font-display text-3xl font-extrabold tracking-tight text-white leading-tight"
            style={{ textWrap: 'balance' }}
          >
            フックリング
            <br />
            キャッチャー 3D
          </h1>
          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
            ？型フックやアイプレートを狙って景品を吊り上げるリアル物理クレーンゲーム
          </p>
        </div>
      </main>

      {/* Primary Action Dock */}
      <footer className="relative z-10 px-4 pt-3 pb-4 bg-slate-950 border-t border-white/10 space-y-3">
        <button
          type="button"
          onClick={onStartGame}
          className="w-full min-h-[54px] flex items-center justify-center gap-2.5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold text-lg shadow-lg shadow-red-950/50 transition-all cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>ゲームスタート</span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onOpenStages}
            className="min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-100 font-semibold text-sm border border-white/10 transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 text-sky-400" />
            <span>ステージ選択</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-100 font-semibold text-sm border border-white/10 transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>アカウント設定</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
