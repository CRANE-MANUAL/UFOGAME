export type ScreenId = 'home' | 'stages' | 'play' | 'settings';

export type CameraView = 'front' | 'side' | 'free';

export type HookShapeType = 'question' | 'eye_plate';

export type CraneToolType = 'ring' | 'j_hook';

export type StageType = 'hook' | 'bridge';

export type PlayPhase =
  | 'move_right'
  | 'move_back'
  | 'auto_down'
  | 'auto_up'
  | 'auto_return'
  | 'won'
  | 'failed';

export interface HookGeometryConfig {
  type: HookShapeType;
  scale: number;
  tubeRadius: number;
  curveRadius: number;
  metalColor: number;
  anchorPosition: [number, number, number];
}

export interface RingGeometryConfig {
  toolType?: CraneToolType;
  majorRadius: number;
  tubeRadius: number;
  restYawDeg: number;
}

export interface PrizeBoxConfig {
  label: string;
  subLabel: string;
  width: number;
  height: number;
  depth: number;
  primaryColor: string;
  accentColor: string;
  mass: number;
}

export interface StageConfig {
  id: string;
  number: number;
  name: string;
  stageType?: StageType;
  hookLabel: string;
  prizeLabel: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  rewardExp: number;
  description: string;
  hook: HookGeometryConfig;
  ring: RingGeometryConfig;
  prize: PrizeBoxConfig;
}

export interface StagePlayStat {
  plays: number;
  wins: number;
}

export interface PlayerSaveData {
  playerName: string;
  playerId: string;
  level: number;
  exp: number;
  totalPlays: number;
  totalWins: number;
  vibrationEnabled: boolean;
  stageStats: Record<string, StagePlayStat>;
}

export interface ControlInputState {
  moveRight: boolean;
  moveBack: boolean;
}

export interface GameHudTelemetry {
  phase: PlayPhase;
  isRingHooked: boolean;
  ringLiftHeight: number;
  guideTitle: string;
  guideDetail: string;
  failReason: string | null;
}
