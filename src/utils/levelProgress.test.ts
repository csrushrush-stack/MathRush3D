import { describe, expect, it } from 'vitest'
import { completeLevel, createLevelRandom, EMPTY_LEVEL_PROGRESS, highestUnlockedLevel, isDifficultyUnlocked } from './levelProgress'

describe('ordered level progression', () => {
  it('only unlocks the next difficulty after ten levels', () => {
    expect(isDifficultyUnlocked('easy', EMPTY_LEVEL_PROGRESS)).toBe(true)
    expect(isDifficultyUnlocked('medium', EMPTY_LEVEL_PROGRESS)).toBe(false)
    const completedEasy = { ...EMPTY_LEVEL_PROGRESS, easy: 10 }
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

  it('keeps a level layout deterministic', () => {
    const first = createLevelRandom('hard-7')
    const second = createLevelRandom('hard-7')
    expect([first(), first(), first()]).toEqual([second(), second(), second()])
  })
})
