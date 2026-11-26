import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, RotateCcw, Trophy } from 'lucide-react';
import { CraneGameCanvas } from '../components/CraneGameCanvas';
import type {
  CameraView,
  ControlInputState,
  GameHudTelemetry,
  StageConfig,
} from '../types/game';
import { arcadeAudio } from '../utils/audio';

interface GamePlayScreenProps {
  stage: StageConfig;
  onExit: () => void;
  onRoundStart: (stage: StageConfig) => void;
  onStageWin: (stage: StageConfig) => void;
  onStageFail: (stage: StageConfig) => void;
}

export function GamePlayScreen({
  stage,
  onExit,
  onRoundStart,
  onStageWin,
  onStageFail,
}: GamePlayScreenProps) {
  const [cameraView, setCameraView] = useState<CameraView>('front');
  const [cameraPresetNonce, setCameraPresetNonce] = useState(0);
  const [roundNonce, setRoundNonce] = useState(0);
  const [resultState, setResultState] = useState<'playing' | 'won' | 'failed'>(
    'playing',
  );
  const [failReason, setFailReason] = useState('');
  const [holdingButton, setHoldingButton] = useState<'right' | 'back' | null>(
    null,
  );
  const [telemetry, setTelemetry] = useState<GameHudTelemetry>({
    phase: 'move_right',
    isRingHooked: false,
    ringLiftHeight: 0,
    guideTitle: '→ 横移動',
    guideDetail: '長押しで右へ移動',
    failReason: null,
  });

  const inputRef = useRef<ControlInputState>({
    moveRight: false,
    moveBack: false,
  });
  const roundStartedRef = useRef(false);

  useEffect(() => {
    if (!roundStartedRef.current) {
      roundStartedRef.current = true;
      onRoundStart(stage);
    }
  }, [stage, onRoundStart]);

  // Keyboard support for desktop testing (ArrowRight / D for 横移動, ArrowUp / W for 奥移動)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (resultState !== 'playing') return;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        inputRef.current.moveRight = true;
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        inputRef.current.moveBack = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        inputRef.current.moveRight = false;
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        inputRef.current.moveBack = false;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [resultState]);

  const handleWin = useCallback(() => {
    inputRef.current = { moveRight: false, moveBack: false };
    setHoldingButton(null);
    setResultState('won');
    arcadeAudio.playWinFanfare();
    onStageWin(stage);
  }, [stage, onStageWin]);

  const handleFail = useCallback(
    (reason: string) => {
      inputRef.current = { moveRight: false, moveBack: false };
      setHoldingButton(null);
      setFailReason(reason);
      setResultState('failed');
      arcadeAudio.playFailSound();
      onStageFail(stage);
    },
    [stage, onStageFail],
  );

  const handleSelectView = useCallback((view: CameraView) => {
    arcadeAudio.playButtonClick();
    setCameraView(view);
    setCameraPresetNonce((n) => n + 1);
  }, []);

  const handleUserOrbitStart = useCallback(() => {
    setCameraView('free');
  }, []);

  const handleRetry = () => {
    inputRef.current = { moveRight: false, moveBack: false };
    setHoldingButton(null);
    setResultState('playing');
    setFailReason('');
    setTelemetry({
      phase: 'move_right',
      isRingHooked: false,
      ringLiftHeight: 0,
      guideTitle: '→ 横移動',
      guideDetail: '長押しで右へ移動',
      failReason: null,
    });
    setRoundNonce((n) => n + 1);
    onRoundStart(stage);
  };

  const rightActive =
    resultState === 'playing' && telemetry.phase === 'move_right';
  const backActive =
    resultState === 'playing' && telemetry.phase === 'move_back';

  const bindRightHold = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!rightActive) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
      arcadeAudio.unlock();
      arcadeAudio.playButtonClick();
      inputRef.current.moveRight = true;
      setHoldingButton('right');
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      inputRef.current.moveRight = false;
      setHoldingButton(null);
    },
    onLostPointerCapture: () => {
      inputRef.current.moveRight = false;
      setHoldingButton(null);
    },
    onPointerCancel: () => {
      inputRef.current.moveRight = false;
      setHoldingButton(null);
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
  };

  const bindBackHold = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!backActive) return;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
      arcadeAudio.unlock();
      arcadeAudio.playButtonClick();
      inputRef.current.moveBack = true;
      setHoldingButton('back');
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      inputRef.current.moveBack = false;
      setHoldingButton(null);
    },
    onLostPointerCapture: () => {
      inputRef.current.moveBack = false;
      setHoldingButton(null);
    },
    onPointerCancel: () => {
      inputRef.current.moveBack = false;
      setHoldingButton(null);
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex flex-col w-full h-full max-w-md mx-auto bg-slate-900 overflow-hidden shadow-2xl select-none"
    >
      {/* Top Bar matching Photo: 終了 | ステージ名 | 正面・横 */}
      <header className="relative z-20 flex items-center justify-between px-3 py-2.5 bg-slate-950/90 border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => {
            arcadeAudio.playButtonClick();
            arcadeAudio.setMotorActive(false);
            onExit();
          }}
          className="min-h-[40px] px-4 rounded-full bg-white text-sky-600 font-bold text-sm shadow-sm active:scale-95 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
        >
          終了
        </button>

        <div className="px-3.5 py-1.5 rounded-full bg-slate-800/95 text-white text-xs font-bold tracking-tight truncate max-w-[140px]">
          {stage.name}
        </div>

        <div
          className="flex items-center p-0.5 rounded-full bg-white shadow-sm shrink-0"
          role="group"
          aria-label="視点切り替え"
        >
          <button
            type="button"
            onClick={() => handleSelectView('front')}
            className={`min-h-[34px] px-2.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              cameraView === 'front'
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            正面
          </button>
          <button
            type="button"
            onClick={() => handleSelectView('side')}
            className={`min-h-[34px] px-2.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              cameraView === 'side'
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            横
          </button>
          <button
            type="button"
            onClick={() => handleSelectView('free')}
            className={`min-h-[34px] px-2.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              cameraView === 'free'
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            自由
          </button>
        </div>
      </header>

      {/* Center 3D Arcade Viewport */}
      <main className="relative flex-1 min-h-0">
        <CraneGameCanvas
          stage={stage}
          cameraView={cameraView}
          cameraPresetNonce={cameraPresetNonce}
          roundNonce={roundNonce}
          inputRef={inputRef}
          onUserOrbitStart={handleUserOrbitStart}
          onTelemetry={setTelemetry}
          onWin={handleWin}
          onFail={handleFail}
        />

        <div className="pointer-events-none absolute top-2.5 right-3 z-10 px-2.5 py-1 rounded-full bg-slate-900/65 text-white text-[11px] font-medium tracking-tight">
          ドラッグで自由視点・拡大縮小
        </div>

        {/* Operation Guide Pill matching Photo: "↑ 奥移動 | 長押しで奥へ" */}
        <div className="pointer-events-none absolute inset-x-4 bottom-3 z-10 flex flex-col items-center gap-1.5">
          {telemetry.isRingHooked && resultState === 'playing' && (
            <div className="px-3.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-md">
              {stage.stageType === 'bridge'
                ? 'アームが箱をキャッチ！'
                : stage.hook.type === 'eye_plate'
                  ? 'フックがアイプレートに掛かった！'
                  : 'リングが？型フックに掛かった！'}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 px-5 py-2.5 rounded-full bg-white text-slate-900 shadow-lg border border-slate-200">
            <span className="text-sm font-black tracking-tight whitespace-nowrap">
              {telemetry.guideTitle}
            </span>
            <span className="w-px h-4 bg-slate-300" aria-hidden="true" />
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              {telemetry.guideDetail}
            </span>
          </div>
        </div>
      </main>

      {/* Bottom Two Large Circular Arcade Buttons matching Photo: 横移動 (→) & 奥移動 (↑) */}
      <section
        aria-label="クレーン操作パネル"
        onContextMenu={(e) => e.preventDefault()}
        className="relative z-20 px-6 pt-3 pb-5 bg-slate-950 border-t border-white/10 shrink-0 select-none"
      >
        <div className="flex items-center justify-around gap-6 max-w-xs mx-auto">
          {/* Left Circular Button: → 横移動 */}
          <button
            type="button"
            aria-label="右へ横移動"
            disabled={!rightActive}
            {...bindRightHold}
            className={`touch-control w-[104px] h-[104px] rounded-full border-[7px] border-slate-300 shadow-xl flex flex-col items-center justify-center gap-0.5 transition-all select-none ${
              rightActive
                ? holdingButton === 'right'
                  ? 'bg-red-700 text-white scale-95 cursor-pointer'
                  : 'bg-red-600 text-white hover:bg-red-500 cursor-pointer'
                : 'bg-pink-50 text-pink-300 opacity-85 cursor-default'
            }`}
          >
            <ArrowRight className="w-7 h-7 stroke-[2.8] pointer-events-none" />
            <span className="text-sm font-black tracking-tight pointer-events-none select-none">
              横移動
            </span>
          </button>

          {/* Right Circular Button: ↑ 奥移動 */}
          <button
            type="button"
            aria-label="奥へ移動"
            disabled={!backActive}
            {...bindBackHold}
            className={`touch-control w-[104px] h-[104px] rounded-full border-[7px] border-slate-300 shadow-xl flex flex-col items-center justify-center gap-0.5 transition-all select-none ${
              backActive
                ? holdingButton === 'back'
                  ? 'bg-red-700 text-white scale-95 cursor-pointer'
                  : 'bg-red-600 text-white hover:bg-red-500 cursor-pointer'
                : 'bg-pink-50 text-pink-300 opacity-85 cursor-default'
            }`}
          >
            <ArrowUp className="w-7 h-7 stroke-[2.8] pointer-events-none" />
            <span className="text-sm font-black tracking-tight pointer-events-none select-none">
              奥移動
            </span>
          </button>
        </div>
      </section>

      {/* Win ("GET!") Overlay */}
      {resultState === 'won' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-5 bg-slate-950/80">
          <div className="animate-get-pop w-full max-w-xs rounded-3xl bg-white text-slate-900 p-6 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md">
              <Trophy className="w-9 h-9" />
            </div>

            <div>
              <div className="font-display text-4xl font-black tracking-tight text-red-600">
                GET!
              </div>
              <p className="mt-1 text-sm font-bold text-slate-800">
                {stage.name} 景品獲得！
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600 font-mono-num">
              <span>+{stage.rewardExp} EXP</span>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleRetry}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-base cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>もう一度プレイ</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playButtonClick();
                  onExit();
                }}
                className="w-full min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm cursor-pointer"
              >
                ホームへ戻る
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fail ("おしい！") Overlay */}
      {resultState === 'failed' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-5 bg-slate-950/75">
          <div className="animate-get-pop w-full max-w-xs rounded-3xl bg-slate-900 border border-white/15 text-white p-6 text-center shadow-2xl space-y-4">
            <div className="font-display text-2xl font-extrabold text-amber-400">
              おしい！
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {failReason ||
                (stage.stageType === 'bridge'
                  ? '箱を突っ張り棒の隙間に落とせませんでした。'
                  : stage.hook.type === 'eye_plate'
                    ? 'フックがアイプレートに掛かりませんでした。'
                    : 'リングが？型フックに掛かりませんでした。')}
            </p>
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleRetry}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-base cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>もう一度挑戦</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  arcadeAudio.playButtonClick();
                  onExit();
                }}
                className="w-full min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm cursor-pointer"
              >
                ホームへ戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
