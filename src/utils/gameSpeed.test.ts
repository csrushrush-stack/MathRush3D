import { describe, expect, it } from 'vitest'
import { getBonusRunSpeed, getRunSpeed } from './gameSpeed'

describe('level speed progression', () => {
  it('increases smoothly inside every difficulty', () => {
    for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
      const speeds = Array.from({ length: 5 }, (_, index) => getRunSpeed(difficulty, index + 1))
      for (let index = 1; index < speeds.length; index += 1) expect(speeds[index]).toBeGreaterThan(speeds[index - 1])
    }
  })

  it('never lets a final level overtake the next difficulty', () => {
    expect(getRunSpeed('easy', 5)).toBeLessThan(getRunSpeed('medium', 1))
    expect(getRunSpeed('medium', 5)).toBeLessThan(getRunSpeed('hard', 1))
    expect(getRunSpeed('hard', 5)).toBeLessThan(getRunSpeed('expert', 1))
  })

  it('makes the bonus sprint substantially faster', () => {
    expect(getBonusRunSpeed('expert', 5)).toBeGreaterThan(getRunSpeed('expert', 5))
    expect(getBonusRunSpeed('easy', 1)).toBeGreaterThanOrEqual(15.5)
  })
})
