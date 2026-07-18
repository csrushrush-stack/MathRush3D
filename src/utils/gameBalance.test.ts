import { describe, expect, it } from 'vitest'
import { applyGateOption, computeBestRoute, generateGatePairs } from './mathGates'
import { generateObstacles } from './obstacles'
import {
  calculateFinishMultiplier,
  balanceObstaclesForRoute,
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
        const obstacles = balanceObstaclesForRoute(gates, generateObstacles(difficulty, () => sample), difficulty)
        const balance = calculateLevelBalance(gates, obstacles)
        expect(obstacles).toHaveLength(5)
        expect(obstacles.some((obstacle) => obstacle.type === 'enemy')).toBe(true)
        expect(balance.bossHealth).toBeGreaterThan(0)
        expect(balance.bossHealth).toBeLessThan(balance.realisticMaxCrowd)
        expect(balance.realisticMaxCrowd - balance.bossHealth).toBeGreaterThan(0)
      }
    })
  }

  it('never places an enemy crowd in the two early obstacle slots', () => {
    for (const difficulty of ['hard', 'expert']) {
      for (const sample of [0.05, 0.25, 0.45, 0.65, 0.85]) {
        const obstacles = generateObstacles(difficulty, () => sample)
        expect(obstacles.slice(0, 2).every((obstacle) => obstacle.type !== 'enemy')).toBe(true)
      }
    }
  })

  it('keeps every enemy encounter survivable on the best route', () => {
    for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
      for (const sample of [0.05, 0.25, 0.45, 0.65, 0.85]) {
        const gates = generateGatePairs(difficulty, () => sample)
        const obstacles = balanceObstaclesForRoute(gates, generateObstacles(difficulty, () => sample), difficulty)
        let crowd = 1
        let gateIndex = 0

        for (const obstacle of obstacles) {
          while (gateIndex < gates.length && gates[gateIndex].worldZ > obstacle.worldZ) {
            const gate = gates[gateIndex]
            crowd = Math.max(
              applyGateOption(crowd, gate.left),
              applyGateOption(crowd, gate.right),
            )
            gateIndex += 1
          }
          if (obstacle.type !== 'enemy') continue
          expect(crowd, `${difficulty} enemy ${obstacle.id}`).toBeGreaterThan(obstacle.enemyStrength)
          crowd -= obstacle.enemyStrength
        }
      }
    }
  })

  it('guarantees a healthy post-boss reserve across all 40 levels', () => {
    for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
      for (let level = 1; level <= 10; level += 1) {
        for (const sample of [0.01, 0.19, 0.37, 0.55, 0.73, 0.91]) {
          const gates = generateGatePairs(difficulty, () => sample)
          const obstacles = balanceObstaclesForRoute(
            gates,
            generateObstacles(difficulty, () => sample, level),
            difficulty,
            level,
          )
          const balance = calculateLevelBalance(gates, obstacles)
          expect(balance.realisticMaxCrowd - balance.bossHealth).toBeGreaterThanOrEqual(
            Math.ceil(balance.realisticMaxCrowd * 0.4),
          )
        }
      }
    }
  })

  it('uses a distinct obstacle family for each difficulty', () => {
    const types = (difficulty: string) => new Set(generateObstacles(difficulty, () => 0.2).map((item) => item.type))
    expect(types('easy').has('cones')).toBe(true)
    expect(types('medium').has('hammer')).toBe(true)
    expect(types('hard').has('pit')).toBe(true)
    expect(types('hard').has('spinner')).toBe(true)
    expect(types('expert').has('crusher')).toBe(true)
  })
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

  it('shows arithmetic problems whose answers drive each gate operation', () => {
    const solve = (expression: string) => {
      const [leftText, symbol, rightText] = expression.split(' ')
      const left = Number(leftText)
      const right = Number(rightText)
      if (symbol === '+') return left + right
      if (symbol === '−') return left - right
      if (symbol === '×') return left * right
      return Math.floor(left / right)
    }

    for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
      const pairs = generateGatePairs(difficulty, () => 0.73)
      for (const pair of pairs) {
        expect(solve(pair.left.expr)).toBe(pair.left.operand)
        expect(solve(pair.right.expr)).toBe(pair.right.operand)
      }
    }
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
