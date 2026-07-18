import type { Difficulty } from '../store/useGameStore'

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert']
export const LEVELS_PER_DIFFICULTY = 10

export type LevelProgress = Record<Difficulty, number>

export const EMPTY_LEVEL_PROGRESS: LevelProgress = {
  easy: 0,
  medium: 0,
  hard: 0,
  expert: 0,
}

/** Stable level layouts: replaying a level keeps its gates and hazards familiar. */
export function createLevelRandom(seedText: string) {
  let seed = 2_166_136_261
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index)
    seed = Math.imul(seed, 16_777_619)
  }
  return () => {
    seed += 0x6d2b79f5
    let value = seed
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296
  }
}

export function isDifficultyUnlocked(difficulty: Difficulty, progress: LevelProgress) {
  const index = DIFFICULTY_ORDER.indexOf(difficulty)
  return index <= 0 || progress[DIFFICULTY_ORDER[index - 1]] >= LEVELS_PER_DIFFICULTY
}

export function highestUnlockedLevel(difficulty: Difficulty, progress: LevelProgress) {
  if (!isDifficultyUnlocked(difficulty, progress)) return 0
  return Math.min(LEVELS_PER_DIFFICULTY, progress[difficulty] + 1)
}

export function completeLevel(progress: LevelProgress, difficulty: Difficulty, level: number): LevelProgress {
  const safeLevel = Math.max(1, Math.min(LEVELS_PER_DIFFICULTY, Math.round(level)))
  if (safeLevel > highestUnlockedLevel(difficulty, progress)) return progress
  return { ...progress, [difficulty]: Math.max(progress[difficulty], safeLevel) }
}

export function getNextLevelSelection(difficulty: Difficulty, level: number) {
  const safeLevel = Math.max(1, Math.min(LEVELS_PER_DIFFICULTY, Math.round(level)))
  if (safeLevel < LEVELS_PER_DIFFICULTY) return { difficulty, level: safeLevel + 1 }
  const difficultyIndex = DIFFICULTY_ORDER.indexOf(difficulty)
  const nextDifficulty = DIFFICULTY_ORDER[difficultyIndex + 1]
  return nextDifficulty ? { difficulty: nextDifficulty, level: 1 } : null
}
