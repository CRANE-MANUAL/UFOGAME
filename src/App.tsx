import { useCallback, useEffect, useState } from 'react';
import { STAGES } from './data/stages';
import { GamePlayScreen } from './screens/GamePlayScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { StageSelectScreen } from './screens/StageSelectScreen';
import type { PlayerSaveData, ScreenId, StageConfig } from './types/game';
import { arcadeAudio } from './utils/audio';
import {
  applyExpAndLevelUp,
  loadSaveData,
  resetPlayerData,
  savePlayerData,
} from './utils/storage';

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('home');
  const [activeStage, setActiveStage] = useState<StageConfig>(STAGES[0]);
  const [saveData, setSaveData] = useState<PlayerSaveData>(() => loadSaveData());

  // Sync haptics setting whenever saveData changes
  useEffect(() => {
    arcadeAudio.syncSettings({
      vibrationEnabled: saveData.vibrationEnabled,
    });
  }, [saveData.vibrationEnabled]);

  const updateSave = useCallback(
    (updater: (prev: PlayerSaveData) => PlayerSaveData) => {
      setSaveData((prev) => {
        const next = updater(prev);
        savePlayerData(next);
        return next;
      });
    },
    [],
  );

  const handleLaunchStage = useCallback((stage: StageConfig) => {
    setActiveStage(stage);
    setScreen('play');
  }, []);

  const handleRoundStart = useCallback(
    (stage: StageConfig) => {
      updateSave((prev) => {
        const currentStat = prev.stageStats[stage.id] ?? { plays: 0, wins: 0 };
        return {
          ...prev,
          totalPlays: prev.totalPlays + 1,
          stageStats: {
            ...prev.stageStats,
            [stage.id]: {
              ...currentStat,
              plays: currentStat.plays + 1,
            },
          },
        };
      });
    },
    [updateSave],
  );

  const handleStageWin = useCallback(
    (stage: StageConfig) => {
      updateSave((prev) => {
        const currentStat = prev.stageStats[stage.id] ?? { plays: 0, wins: 0 };
        const progressed = applyExpAndLevelUp(
          prev.level,
          prev.exp,
          stage.rewardExp,
        );
        return {
          ...prev,
          level: progressed.level,
          exp: progressed.exp,
          totalWins: prev.totalWins + 1,
          stageStats: {
            ...prev.stageStats,
            [stage.id]: {
              ...currentStat,
              wins: currentStat.wins + 1,
            },
          },
        };
      });
    },
    [updateSave],
  );

  const handleStageFail = useCallback((_stage: StageConfig) => {
    // Play count was already incremented on round start
  }, []);

  const handleResetSave = useCallback(() => {
    const fresh = resetPlayerData();
    setSaveData(fresh);
  }, []);

  return (
    <div className="w-full h-[100dvh] bg-slate-950 flex items-center justify-center overflow-hidden">
      {screen === 'home' && (
        <HomeScreen
          saveData={saveData}
          stages={STAGES}
          activeStage={activeStage}
          onSelectStage={setActiveStage}
          onStartGame={() => handleLaunchStage(activeStage)}
          onOpenStages={() => setScreen('stages')}
          onOpenSettings={() => setScreen('settings')}
        />
      )}

      {screen === 'stages' && (
        <StageSelectScreen
          saveData={saveData}
          onSelectStage={handleLaunchStage}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'settings' && (
        <SettingsScreen
          saveData={saveData}
          onUpdateSave={updateSave}
          onResetSave={handleResetSave}
          onBack={() => setScreen('home')}
        />
      )}

      {screen === 'play' && (
        <GamePlayScreen
          stage={activeStage}
          onExit={() => setScreen('home')}
          onRoundStart={handleRoundStart}
          onStageWin={handleStageWin}
          onStageFail={handleStageFail}
        />
      )}
    </div>
  );
}
