import { describe, expect, it } from 'vitest'
import { completeLevel, createLevelRandom, EMPTY_LEVEL_PROGRESS, getNextLevelSelection, highestUnlockedLevel, isDifficultyUnlocked, normalizeLevelProgress } from './levelProgress'

describe('ordered level progression', () => {
  it('only unlocks the next difficulty after five levels', () => {
    expect(isDifficultyUnlocked('easy', EMPTY_LEVEL_PROGRESS)).toBe(true)
    expect(isDifficultyUnlocked('medium', EMPTY_LEVEL_PROGRESS)).toBe(false)
    const completedEasy = { ...EMPTY_LEVEL_PROGRESS, easy: 5 }
    expect(isDifficultyUnlocked('medium', completedEasy)).toBe(true)
    expect(isDifficultyUnlocked('hard', completedEasy)).toBe(false)
  })

  it('only completes the next available level', () => {
    const skipped = completeLevel(EMPTY_LEVEL_PROGRESS, 'easy', 4)
    expect(skipped.easy).toBe(0)
    const levelOne = completeLevel(EMPTY_LEVEL_PROGRESS, 'easy', 1)
    expect(levelOne.easy).toBe(1)
    expect(highestUnlockedLevel('easy', levelOne)).toBe(2)
  })

  it('safely caps progress created by the former ten-level format', () => {
    expect(normalizeLevelProgress({ ...EMPTY_LEVEL_PROGRESS, easy: 10, medium: 7 })).toEqual({
      easy: 5,
      medium: 5,
      hard: 0,
      expert: 0,
    })
  })

  it('keeps a level layout deterministic', () => {
    const first = createLevelRandom('hard-7')
    const second = createLevelRandom('hard-7')
    expect([first(), first(), first()]).toEqual([second(), second(), second()])
  })

  it('advances levels and crosses difficulty boundaries', () => {
    expect(getNextLevelSelection('easy', 4)).toEqual({ difficulty: 'easy', level: 5 })
    expect(getNextLevelSelection('easy', 5)).toEqual({ difficulty: 'medium', level: 1 })
    expect(getNextLevelSelection('expert', 5)).toBeNull()
  })
})
