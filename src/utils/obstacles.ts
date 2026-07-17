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

const TYPES: ObstacleType[] = ['blocker', 'wall', 'enemy', 'hammer', 'wall']
const SIDES: ObstacleSide[] = ['left', 'right', 'right', 'left', 'left']

const BALANCE = {
  easy:   { enemy: 4, hammerSpeed: 1.2 },
  medium: { enemy: 7, hammerSpeed: 1.5 },
  hard:   { enemy: 10, hammerSpeed: 1.8 },
  expert: { enemy: 14, hammerSpeed: 2.1 },
} as const

export function generateObstacles(difficulty: string): ObstacleData[] {
  const values = BALANCE[difficulty as keyof typeof BALANCE] ?? BALANCE.hard

  return OBSTACLE_WORLD_ZS.map((worldZ, id) => ({
    id,
    worldZ,
    type: TYPES[id],
    blockerSide: SIDES[id],
    enemyStrength: values.enemy + Math.floor(id / 2),
    hammerSpeed: values.hammerSpeed,
    hammerPhase: id * 1.37,
  }))
}

/** Damage that optimal movement cannot avoid. Used for guaranteed boss balance. */
export function computeMandatoryObstacleDamage(obstacles: ObstacleData[]): number {
  return obstacles.reduce((total, obstacle) => {
    if (obstacle.type === 'enemy') return total + obstacle.enemyStrength
    return total
  }, 0)
}
