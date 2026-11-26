import { Layers, Play, Settings, Trophy } from 'lucide-react';
import { HomeHeroCanvas } from '../components/HomeHeroCanvas';
import type { PlayerSaveData, StageConfig } from '../types/game';

interface HomeScreenProps {
  saveData: PlayerSaveData;
  stages: StageConfig[];
  activeStage: StageConfig;
  onSelectStage: (stage: StageConfig) => void;
  onStartGame: () => void;
  onOpenStages: () => void;
  onOpenSettings: () => void;
}

function getStageShortLabel(stage: StageConfig): string {
  if (stage.stageType === 'bridge') return '橋渡し';
  if (stage.stageType === 'bounce') return 'バウンド';
  if (stage.hook.type === 'eye_plate') return 'Jフック';
  return 'フック';
}

export function HomeScreen({
  saveData,
  stages,
  activeStage,
  onSelectStage,
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

      {/* Center Multi-Stage 3D Crane Showcase */}
      <main className="relative flex-1 min-h-0">
        <HomeHeroCanvas />

        {/* Title Overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
          <p className="text-xs font-medium tracking-wider text-amber-400 mb-1">
            とれすぎ倉庫 · 3D CRANE SIMULATOR
          </p>
          <h1
            className="font-display text-2xl sm:text-[28px] font-extrabold tracking-tight text-white leading-tight"
            style={{ textWrap: 'balance' }}
          >
            クレーンシュミレーター
            <span className="block text-xl font-bold text-amber-300 mt-0.5">
              （とれすぎ倉庫）
            </span>
          </h1>
          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
            フック・橋渡し・バウンドなど多彩な設定台をリアル物理演算で攻略しよう！
          </p>
        </div>
      </main>

      {/* Primary Action Dock */}
      <footer className="relative z-10 px-4 pt-3 pb-4 bg-slate-950 border-t border-white/10 space-y-2.5">
        {/* Compact Mode Quick Switcher */}
        <div
          className="grid grid-cols-4 gap-1.5"
          role="group"
          aria-label="ステージタイプ切り替え"
        >
          {stages.map((stage) => {
            const isSelected = stage.id === activeStage.id;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectStage(stage)}
                className={`min-h-[38px] px-1 rounded-lg text-xs font-bold transition-all cursor-pointer truncate ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-300 border border-white/10 hover:bg-slate-800'
                }`}
              >
                {getStageShortLabel(stage)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onStartGame}
          className="w-full min-h-[54px] flex items-center justify-center gap-2.5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold text-lg shadow-lg shadow-red-950/50 transition-all cursor-pointer"
        >
          <Play className="w-5 h-5 fill-current" />
          <span>{activeStage.name}をプレイ</span>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onOpenStages}
            className="min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-100 font-semibold text-sm border border-white/10 transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 text-sky-400" />
            <span>ステージ選択</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-100 font-semibold text-sm border border-white/10 transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>アカウント設定</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
