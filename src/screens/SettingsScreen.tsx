import { useState } from 'react';
import { ArrowLeft, Check, RotateCcw } from 'lucide-react';
import type { PlayerSaveData } from '../types/game';
import { expRequiredForLevel } from '../utils/storage';

interface SettingsScreenProps {
  saveData: PlayerSaveData;
  onUpdateSave: (updater: (prev: PlayerSaveData) => PlayerSaveData) => void;
  onResetSave: () => void;
  onBack: () => void;
}

export function SettingsScreen({
  saveData,
  onUpdateSave,
  onResetSave,
  onBack,
}: SettingsScreenProps) {
  const [nameInput, setNameInput] = useState(saveData.playerName);
  const [nameSaved, setNameSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const reqExp = expRequiredForLevel(saveData.level);
  const expPct = Math.min(100, Math.round((saveData.exp / reqExp) * 100));

  const handleSaveName = () => {
    const trimmed = nameInput.trim() || 'プレイヤー';
    setNameInput(trimmed);
    onUpdateSave((prev) => ({ ...prev, playerName: trimmed }));
    setNameSaved(true);
    window.setTimeout(() => setNameSaved(false), 1800);
  };

  return (
    <div className="relative flex flex-col w-full h-full max-w-md mx-auto bg-slate-950 text-white overflow-hidden shadow-2xl">
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
          アカウント設定
        </h1>

        <div className="min-w-[60px]" />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Player Profile */}
        <section className="rounded-2xl bg-slate-900 border border-white/10 p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-200">プロフィール</h2>

          <div className="space-y-1.5">
            <label
              htmlFor="player-name-input"
              className="block text-xs text-slate-400"
            >
              プレイヤー名
            </label>
            <div className="flex items-center gap-2">
              <input
                id="player-name-input"
                type="text"
                maxLength={16}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 min-h-[44px] px-3 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold active:scale-95 transition-all cursor-pointer shrink-0 flex items-center gap-1"
              >
                {nameSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>保存済</span>
                  </>
                ) : (
                  <span>保存</span>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-white/10 text-sm">
            <span className="text-slate-400">プレイヤーID</span>
            <span className="font-mono-num font-bold text-slate-100">
              {saveData.playerId}
            </span>
          </div>

          <div className="space-y-2 py-2 border-t border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">プレイヤーレベル</span>
              <span className="font-mono-num font-bold text-amber-400">
                Lv.{saveData.level} ({saveData.exp}/{reqExp})
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${expPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
            <div className="rounded-xl bg-slate-950 p-3">
              <div className="text-xs text-slate-400">プレイ回数</div>
              <div className="mt-1 text-xl font-bold font-mono-num text-white">
                {saveData.totalPlays}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  回
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-slate-950 p-3">
              <div className="text-xs text-slate-400">獲得景品数</div>
              <div className="mt-1 text-xl font-bold font-mono-num text-amber-400">
                {saveData.totalWins}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  個
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Haptic Settings */}
        <section className="rounded-2xl bg-slate-900 border border-white/10 p-4 space-y-1">
          <h2 className="text-sm font-bold text-slate-200 mb-2">振動設定</h2>

          <div className="flex items-center justify-between min-h-[52px]">
            <span className="text-sm font-medium text-slate-200">振動</span>
            <button
              type="button"
              role="switch"
              aria-checked={saveData.vibrationEnabled}
              onClick={() => {
                onUpdateSave((prev) => ({
                  ...prev,
                  vibrationEnabled: !prev.vibrationEnabled,
                }));
              }}
              className={`min-w-[72px] min-h-[40px] px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                saveData.vibrationEnabled
                  ? 'bg-sky-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400 border border-white/10'
              }`}
            >
              {saveData.vibrationEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </section>

        {/* Data Reset */}
        <section className="rounded-2xl bg-slate-900 border border-white/10 p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-200">データ管理</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            プレイ回数・獲得景品数・設定を初期状態に戻します。
          </p>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="w-full min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-red-950/70 border border-red-500/30 text-red-400 text-sm font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>データリセット</span>
          </button>
        </section>
      </main>

      {/* Reset Confirmation Modal */}
      {confirmReset && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-5 bg-black/75">
          <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-white/15 p-5 space-y-4 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-white">
              データをリセットしますか？
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              プレイヤーレベル、獲得景品数などがすべて初期化されます。この操作は取り消せません。
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[44px] rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetSave();
                  setConfirmReset(false);
                }}
                className="min-h-[44px] rounded-xl bg-red-600 text-white text-sm font-bold cursor-pointer"
              >
                リセット
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
