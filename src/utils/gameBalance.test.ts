import { describe, expect, it } from 'vitest'
import { applyGateOption, computeBestRoute, generateGatePairs } from './mathGates'
import { generateObstacles } from './obstacles'
import {
  calculateFinishMultiplier,
  calculateBonusPoints,
  calculateBonusStageSacrifice,
  calculateLevelBalance,
  calculateStars,
  crossedPlane,
} from './gameBalance'

describe('level balance', () => {
  for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
    it(`${difficulty} optimal route always survives the boss`, () => {
      const gates = generateGatePairs(difficulty, () => 0.42)
      expect(gates).toHaveLength(10)
      for (const sample of [0.05, 0.25, 0.45, 0.65, 0.85]) {
        const obstacles = generateObstacles(difficulty, () => sample)
        const balance = calculateLevelBalance(gates, obstacles)
        expect(obstacles).toHaveLength(5)
        expect(obstacles.some((obstacle) => obstacle.type === 'enemy')).toBe(true)
        expect(balance.bossHealth).toBeGreaterThan(0)
        expect(balance.bossHealth).toBeLessThan(balance.realisticMaxCrowd)
        expect(balance.realisticMaxCrowd - balance.bossHealth).toBeGreaterThan(0)
      }
    })
  }
})

describe('math gates', () => {
  it('applies all operations with safe whole-number results', () => {
    expect(applyGateOption(11, { expr: '+4', operation: 'add', operand: 4 })).toBe(15)
    expect(applyGateOption(3, { expr: '-9', operation: 'subtract', operand: 9 })).toBe(1)
    expect(applyGateOption(8, { expr: '×3', operation: 'multiply', operand: 3 })).toBe(24)
    expect(applyGateOption(11, { expr: '÷2', operation: 'divide', operand: 2 })).toBe(5)
  })

  it('simulates the best route sequentially instead of summing labels', () => {
    const pairs = generateGatePairs('medium', () => 0.42)
    const route = computeBestRoute(pairs)
    let replayed = 1
    route.choices.forEach((side, index) => {
      replayed = applyGateOption(replayed, pairs[index][side])
    })
    expect(route.finalCrowd).toBe(replayed)
    expect(route.totalGain).toBe(route.finalCrowd - 1)
  })

  it('uses both lanes for the stronger route and never repeats one side more than twice', () => {
    const pairs = generateGatePairs('hard', () => 0.91)
    const choices = computeBestRoute(pairs).choices
    expect(new Set(choices)).toEqual(new Set(['left', 'right']))
    expect(choices.join('')).not.toMatch(/(left){3}|(right){3}/)
  })
})

describe('finish rewards', () => {
  it('sacrifices runners at each bonus checkpoint and drains the final tier', () => {
    expect(calculateBonusStageSacrifice(0, 12)).toBe(1)
    expect(calculateBonusStageSacrifice(3, 12)).toBe(4)
    expect(calculateBonusStageSacrifice(4, 3)).toBe(3)
    expect(calculateBonusStageSacrifice(6, 120)).toBe(120)
  })

  it('scores the post-boss crowd at the last reached multiplier', () => {
    expect(calculateBonusPoints(17, 6)).toBe(2_550)
  })

  it('awards multiplier tiers from crowd performance', () => {
    expect(calculateFinishMultiplier(20, 100)).toBe(1)
    expect(calculateFinishMultiplier(30, 100)).toBe(2)
    expect(calculateFinishMultiplier(60, 100)).toBe(4)
    expect(calculateFinishMultiplier(95, 100)).toBe(10)
  })

  it('uses the documented star thresholds', () => {
    expect(calculateStars(10, 100)).toBe(3)
    expect(calculateStars(5, 100)).toBe(2)
    expect(calculateStars(4, 100)).toBe(1)
  })
})

describe('collision crossing', () => {
  it('detects a plane even when a slow frame skips the old trigger window', () => {
    expect(crossedPlane(-20, -31, -25)).toBe(true)
    expect(crossedPlane(-26, -31, -25)).toBe(false)
    expect(crossedPlane(-20, -24, -25)).toBe(false)
  })
})
