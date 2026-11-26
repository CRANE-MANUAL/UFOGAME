import { ArrowLeft, Play } from 'lucide-react';
import { StagePreviewCanvas } from '../components/StagePreviewCanvas';
import { STAGES } from '../data/stages';
import type { PlayerSaveData, StageConfig } from '../types/game';

interface StageSelectScreenProps {
  saveData: PlayerSaveData;
  onSelectStage: (stage: StageConfig) => void;
  onBack: () => void;
}

function renderStars(difficulty: number): string {
  return '★'.repeat(difficulty) + '☆'.repeat(Math.max(0, 5 - difficulty));
}

export function StageSelectScreen({
  saveData,
  onSelectStage,
  onBack,
}: StageSelectScreenProps) {
  return (
    <div className="flex flex-col w-full h-full max-w-md mx-auto bg-slate-950 text-white overflow-hidden shadow-2xl">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 min-h-[44px] px-2 text-sm font-semibold text-slate-200 hover:text-white active:scale-95 transition-transform cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>戻る</span>
        </button>

        <h1 className="font-display text-base font-bold tracking-tight">
          ステージ選択
        </h1>

        <div className="min-w-[68px]" />
      </header>

      {/* Stage List */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {STAGES.map((stage) => {
          const stats = saveData.stageStats[stage.id] ?? { plays: 0, wins: 0 };
          return (
            <article
              key={stage.id}
              className="rounded-2xl bg-slate-900 border border-white/10 overflow-hidden shadow-lg"
            >
              {/* Actual 3D Game Scene Preview */}
              <div className="relative w-full h-56 bg-slate-800">
                <StagePreviewCanvas stage={stage} />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-900 to-transparent" />
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <div className="text-xs text-amber-400 font-semibold mb-0.5">
                    STAGE {stage.number}
                  </div>
                  <h2 className="font-display text-xl font-bold text-white">
                    {stage.name}
                  </h2>
                </div>

                {/* Clean Unboxed Metadata */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-300">
                  <span>種類: {stage.hookLabel}</span>
                  <span className="text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span>景品: {stage.prizeLabel}</span>
                  <span className="text-slate-600" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-amber-400">
                    難易度: {renderStars(stage.difficulty)}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {stage.description}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-slate-400 font-mono-num">
                  <span>
                    プレイ {stats.plays}回 · 獲得 {stats.wins}個
                  </span>
                  <span className="text-emerald-400 font-semibold">フリープレイ</span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectStage(stage)}
                  className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold text-base transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>プレイ</span>
                </button>
              </div>
            </article>
          );
        })}
      </main>
    </div>
  );
}
