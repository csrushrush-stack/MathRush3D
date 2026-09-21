export interface CrowdHitArea {
  key: string
  centerX: number
  centerZ: number
  halfWidth: number
  halfDepth: number
  maxHits?: number
  impulseX?: number
  impulseZ?: number
}

export interface CrowdAvoidanceArea {
  key: string
  centerX: number
  centerZ: number
  halfWidth: number
  halfDepth: number
  preferredSide?: -1 | 1
  strength?: number
}

export interface CrowdController {
  getAliveCount: () => number
  getDepth: () => number
  getWidth: () => number
  setAvoidanceAreas: (areas: CrowdAvoidanceArea[]) => void
  hitArea: (area: CrowdHitArea) => number
  removeFront: (
    count: number,
    key: string,
    impulse?: { x?: number; z?: number; upward?: number },
  ) => number
}
