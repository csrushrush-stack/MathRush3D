import type { GatePairData } from './mathGates'
import { computeBestRoute } from './mathGates'
import type { ObstacleData } from './obstacles'
import { computeMandatoryObstacleDamage } from './obstacles'
export { calculateRunRewards } from '../../shared/gameRules'

export const STARTING_CROWD = 1
export const BOSS_HEALTH_RATIO = 0.7

export const MULTIPLIER_TIERS = [
  { multiplier: 1, worldZ: -294, minPerformance: 0 },
  { multiplier: 2, worldZ: -302, minPerformance: 0.3 },
  { multiplier: 3, worldZ: -310, minPerformance: 0.45 },
  { multiplier: 4, worldZ: -318, minPerformance: 0.6 },
  { multiplier: 6, worldZ: -326, minPerformance: 0.75 },
  { multiplier: 8, worldZ: -334, minPerformance: 0.85 },
  { multiplier: 10, worldZ: -342, minPerformance: 0.95 },
] as const

export interface LevelBalance {
  maxPossibleMathGain: number
  mandatoryObstacleDamage: number
  realisticMaxCrowd: number
  bossHealth: number
}

export function calculateLevelBalance(
  gates: GatePairData[],
  obstacles: ObstacleData[],
): LevelBalance {
  const bestRoute = computeBestRoute(gates, STARTING_CROWD)
  const maxPossibleMathGain = bestRoute.totalGain
  const mandatoryObstacleDamage = computeMandatoryObstacleDamage(obstacles)
  const realisticMaxCrowd = Math.max(
    2,
    bestRoute.finalCrowd - mandatoryObstacleDamage,
  )
  const bossHealth = Math.max(
    1,
    Math.min(realisticMaxCrowd - 1, Math.floor(realisticMaxCrowd * BOSS_HEALTH_RATIO)),
  )

  return {
    maxPossibleMathGain,
    mandatoryObstacleDamage,
    realisticMaxCrowd,
    bossHealth,
  }
}

export function calculateFinishMultiplier(crowdAtBoss: number, realisticMaxCrowd: number): number {
  const performance = realisticMaxCrowd > 0 ? crowdAtBoss / realisticMaxCrowd : 0
  let earned: number = MULTIPLIER_TIERS[0].multiplier

  for (const tier of MULTIPLIER_TIERS) {
    if (performance + Number.EPSILON >= tier.minPerformance) earned = tier.multiplier
  }

  return earned
}

export function calculateBonusStageSacrifice(tierIndex: number, aliveCrowd: number): number {
  const alive = Math.max(0, Math.round(aliveCrowd))
  const safeIndex = Math.max(0, Math.min(MULTIPLIER_TIERS.length - 1, Math.round(tierIndex)))
  if (safeIndex === MULTIPLIER_TIERS.length - 1) return alive
  return Math.min(alive, MULTIPLIER_TIERS[safeIndex].multiplier)
}

export function calculateBonusPoints(postBossCrowd: number, multiplier: number): number {
  return Math.max(0, Math.round(postBossCrowd)) * Math.max(1, Math.round(multiplier)) * 25
}

export function calculateStars(remainingCrowd: number, realisticMaxCrowd: number): number {
  const ratio = realisticMaxCrowd > 0 ? remainingCrowd / realisticMaxCrowd : 0
  return ratio >= 0.1 ? 3 : ratio >= 0.05 ? 2 : 1
}

export function crossedPlane(previousZ: number, currentZ: number, planeZ: number): boolean {
  return previousZ > planeZ && currentZ <= planeZ
}
