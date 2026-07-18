import type { Difficulty } from '../store/useGameStore'

const SPEED_RANGES: Record<Difficulty, readonly [number, number]> = {
  easy: [6, 7.5],
  medium: [7.8, 9.3],
  hard: [9.6, 11.2],
  expert: [11.5, 13.5],
}

export function getRunSpeed(difficulty: Difficulty | string, level: number) {
  const range = SPEED_RANGES[difficulty as Difficulty] ?? SPEED_RANGES.medium
  const progress = (Math.max(1, Math.min(10, Math.round(level))) - 1) / 9
  return range[0] + (range[1] - range[0]) * progress
}

export function getBonusRunSpeed(difficulty: Difficulty | string, level: number) {
  return Math.max(15.5, getRunSpeed(difficulty, level) * 1.28)
}

