/** Pure obstacle generation. All values are fixed for a run once generated. */
export type ObstacleType = 'wall' | 'blocker' | 'enemy' | 'hammer' | 'cones' | 'pit' | 'spinner' | 'crusher'
export type ObstacleSide = 'left' | 'right'

export interface ObstacleData {
  id: number
  worldZ: number
  type: ObstacleType
  blockerSide: ObstacleSide
  enemyStrength: number
  hammerSpeed: number
  hammerPhase: number
}

export const OBSTACLE_WORLD_ZS = [-38, -88, -138, -188, -238] as const

const PATTERNS: Record<string, ObstacleType[][]> = {
  easy: [
    ['cones', 'wall', 'enemy', 'cones', 'blocker'],
    ['wall', 'cones', 'enemy', 'blocker', 'cones'],
  ],
  medium: [
    ['blocker', 'hammer', 'enemy', 'wall', 'hammer'],
    ['hammer', 'wall', 'enemy', 'blocker', 'hammer'],
  ],
  hard: [
    ['pit', 'spinner', 'enemy', 'blocker', 'pit'],
    ['spinner', 'pit', 'enemy', 'spinner', 'blocker'],
  ],
  expert: [
    ['crusher', 'spinner', 'enemy', 'pit', 'crusher'],
    ['spinner', 'crusher', 'enemy', 'pit', 'enemy'],
  ],
}

const BALANCE = {
  easy:   { enemy: 6, hammerSpeed: 1.2 },
  medium: { enemy: 10, hammerSpeed: 1.5 },
  hard:   { enemy: 14, hammerSpeed: 1.8 },
  expert: { enemy: 20, hammerSpeed: 2.1 },
} as const

export function generateObstacles(difficulty: string, random: () => number = Math.random, level = 1): ObstacleData[] {
  const values = BALANCE[difficulty as keyof typeof BALANCE] ?? BALANCE.hard
  const patterns = PATTERNS[difficulty] ?? PATTERNS.hard
  const pattern = patterns[Math.floor(random() * patterns.length)] ?? PATTERNS.hard[0]
  const levelScale = Math.max(0, Math.min(9, Math.round(level) - 1))

  return OBSTACLE_WORLD_ZS.map((worldZ, id) => ({
    id,
    worldZ,
    type: pattern[id],
    blockerSide: random() < 0.5 ? 'left' : 'right',
    enemyStrength: values.enemy + Math.floor(id / 2) + Math.floor(levelScale * 0.65),
    hammerSpeed: values.hammerSpeed + levelScale * 0.045,
    hammerPhase: random() * Math.PI * 2,
  }))
}

/** Damage that optimal movement cannot avoid. Used for guaranteed boss balance. */
export function computeMandatoryObstacleDamage(obstacles: ObstacleData[]): number {
  return obstacles.reduce((total, obstacle) => {
    if (obstacle.type === 'enemy') return total + obstacle.enemyStrength
    return total
  }, 0)
}
