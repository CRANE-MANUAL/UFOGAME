import type { PlayerSaveData } from '../types/game';

const STORAGE_KEY = 'hook_ring_catcher_save_v1';

export function generatePlayerId(): string {
  const block1 = Math.floor(1000 + Math.random() * 9000);
  const block2 = Math.floor(1000 + Math.random() * 9000);
  return `QC-${block1}-${block2}`;
}

export function createDefaultSaveData(): PlayerSaveData {
  return {
    playerName: 'プレイヤー',
    playerId: generatePlayerId(),
    level: 1,
    exp: 0,
    totalPlays: 0,
    totalWins: 0,
    vibrationEnabled: true,
    stageStats: {
      'stage-1': { plays: 0, wins: 0 },
    },
  };
}

export function loadSaveData(): PlayerSaveData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = createDefaultSaveData();
      savePlayerData(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<PlayerSaveData>;
    const defaults = createDefaultSaveData();
    return {
      playerName: parsed.playerName ?? defaults.playerName,
      playerId: parsed.playerId || defaults.playerId,
      level: typeof parsed.level === 'number' ? parsed.level : defaults.level,
      exp: typeof parsed.exp === 'number' ? parsed.exp : defaults.exp,
      totalPlays:
        typeof parsed.totalPlays === 'number'
          ? parsed.totalPlays
          : defaults.totalPlays,
      totalWins:
        typeof parsed.totalWins === 'number'
          ? parsed.totalWins
          : defaults.totalWins,
      vibrationEnabled:
        typeof parsed.vibrationEnabled === 'boolean'
          ? parsed.vibrationEnabled
          : defaults.vibrationEnabled,
      stageStats: {
        ...defaults.stageStats,
        ...(parsed.stageStats ?? {}),
      },
    };
  } catch {
    return createDefaultSaveData();
  }
}

export function savePlayerData(data: PlayerSaveData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors in private browsing
  }
}

export function resetPlayerData(): PlayerSaveData {
  const fresh = createDefaultSaveData();
  savePlayerData(fresh);
  return fresh;
}

export function expRequiredForLevel(level: number): number {
  return 100 + (level - 1) * 60;
}

export function applyExpAndLevelUp(
  currentLevel: number,
  currentExp: number,
  gainedExp: number,
): { level: number; exp: number } {
  let level = currentLevel;
  let exp = currentExp + gainedExp;
  while (exp >= expRequiredForLevel(level)) {
    exp -= expRequiredForLevel(level);
    level += 1;
  }
  return { level, exp };
}
