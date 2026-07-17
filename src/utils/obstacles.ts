/** Pure obstacle generation. All values are fixed for a run once generated. */
export type ObstacleType = 'wall' | 'blocker' | 'enemy' | 'hammer'
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

const STANDARD_PATTERNS: ObstacleType[][] = [
  ['blocker', 'wall', 'enemy', 'hammer', 'wall'],
  ['wall', 'hammer', 'enemy', 'blocker', 'hammer'],
  ['hammer', 'blocker', 'enemy', 'wall', 'blocker'],
]

const ADVANCED_PATTERNS: ObstacleType[][] = [
  ...STANDARD_PATTERNS,
  ['hammer', 'blocker', 'enemy', 'wall', 'enemy'],
  ['blocker', 'wall', 'hammer', 'enemy', 'enemy'],
]

const BALANCE = {
  easy:   { enemy: 6, hammerSpeed: 1.2 },
  medium: { enemy: 10, hammerSpeed: 1.5 },
  hard:   { enemy: 14, hammerSpeed: 1.8 },
  expert: { enemy: 20, hammerSpeed: 2.1 },
} as const

export function generateObstacles(difficulty: string, random: () => number = Math.random): ObstacleData[] {
  const values = BALANCE[difficulty as keyof typeof BALANCE] ?? BALANCE.hard
  const patterns = difficulty === 'hard' || difficulty === 'expert' ? ADVANCED_PATTERNS : STANDARD_PATTERNS
  const pattern = patterns[Math.floor(random() * patterns.length)] ?? STANDARD_PATTERNS[0]

  return OBSTACLE_WORLD_ZS.map((worldZ, id) => ({
    id,
    worldZ,
    type: pattern[id],
    blockerSide: random() < 0.5 ? 'left' : 'right',
    enemyStrength: values.enemy + Math.floor(id / 2),
    hammerSpeed: values.hammerSpeed,
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
