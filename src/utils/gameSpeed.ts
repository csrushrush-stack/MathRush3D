import type { Difficulty } from '../store/useGameStore'
import { LEVELS_PER_DIFFICULTY } from './levelProgress'

const SPEED_RANGES: Record<Difficulty, readonly [number, number]> = {
  easy: [6, 7.5],
  medium: [7.8, 9.3],
  hard: [9.6, 11.2],
  expert: [11.5, 13.5],
}

export function getRunSpeed(difficulty: Difficulty | string, level: number) {
  const range = SPEED_RANGES[difficulty as Difficulty] ?? SPEED_RANGES.medium
  const safeLevel = Math.max(1, Math.min(LEVELS_PER_DIFFICULTY, Math.round(level)))
  const progress = (safeLevel - 1) / (LEVELS_PER_DIFFICULTY - 1)
  return range[0] + (range[1] - range[0]) * progress
}

export function getBonusRunSpeed(difficulty: Difficulty | string, level: number) {
  return Math.max(15.5, getRunSpeed(difficulty, level) * 1.28)
}
