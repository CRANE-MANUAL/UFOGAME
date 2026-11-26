import type { StageConfig } from '../types/game';

export const STAGES: StageConfig[] = [
  {
    id: 'stage-1',
    number: 1,
    name: 'フックチャレンジ',
    hookLabel: '？型フック（景品側）',
    prizeLabel: 'リング（クレーン側）',
    difficulty: 1,
    rewardExp: 50,
    description:
      'クレーン先端の金属リングを「右移動 → 奥移動」で狙い、景品側の？型フックに引っ掛けて獲得しよう！',
    hook: {
      type: 'question',
      scale: 0.88,
      tubeRadius: 0.024,
      curveRadius: 0.145,
      metalColor: 0xd4a438,
      anchorPosition: [0.32, -0.25, 0.04],
    },
    ring: {
      toolType: 'ring',
      majorRadius: 0.20,
      tubeRadius: 0.021,
      restYawDeg: 58,
    },
    prize: {
      label: 'ふわ玉',
      subLabel: 'ミニ箱',
      width: 0.56,
      height: 0.22,
      depth: 0.44,
      primaryColor: '#ec4899',
      accentColor: '#2563eb',
      mass: 1.0,
    },
  },
  {
    id: 'stage-2',
    number: 2,
    name: '高額キャッチャーチャレンジ',
    hookLabel: 'アイプレート（景品側）',
    prizeLabel: 'J型フック（クレーン側）',
    difficulty: 2,
    rewardExp: 80,
    description:
      'クレーン先端のJ型フックを「右移動 → 奥移動」で狙い、赤い板のステンレス製アイプレートに引っ掛けて吊り上げよう！',
    hook: {
      type: 'eye_plate',
      scale: 1.0,
      tubeRadius: 0.025,
      curveRadius: 0.145,
      metalColor: 0xeaf0f6,
      anchorPosition: [0.32, -0.25, 0.04],
    },
    ring: {
      toolType: 'j_hook',
      majorRadius: 0.19,
      tubeRadius: 0.021,
      restYawDeg: 78,
    },
    prize: {
      label: 'チョコ缶',
      subLabel: '特選パック',
      width: 0.56,
      height: 0.22,
      depth: 0.44,
      primaryColor: '#0ea5e9',
      accentColor: '#f59e0b',
      mass: 1.0,
    },
  },
  {
    id: 'stage-3',
    number: 3,
    name: '橋渡しチャレンジ',
    stageType: 'bridge',
    hookLabel: '2本アーム（透明＋金属爪）',
    prizeLabel: '大型フィギュア箱',
    difficulty: 3,
    rewardExp: 120,
    description:
      '4本の突っ張り棒の真ん中に置かれた箱を2本アームで動かし、棒の隙間に落として獲得しよう！',
    hook: {
      type: 'eye_plate',
      scale: 1.0,
      tubeRadius: 0.025,
      curveRadius: 0.145,
      metalColor: 0xeaf0f6,
      anchorPosition: [0, -0.56, 0],
    },
    ring: {
      toolType: 'j_hook',
      majorRadius: 0.19,
      tubeRadius: 0.021,
      restYawDeg: 0,
    },
    prize: {
      label: '限定フィギュア',
      subLabel: 'COLLECTOR BOX',
      width: 0.54,
      height: 0.28,
      depth: 0.48,
      primaryColor: '#1e293b',
      accentColor: '#38bdf8',
      mass: 1.0,
    },
  },
];

export function getStageById(stageId: string): StageConfig {
  return STAGES.find((s) => s.id === stageId) ?? STAGES[0];
}
