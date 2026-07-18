export interface BossMeterSegment {
  reward: number
  weight: number
  color: string
}

export const BOSS_METER_SEGMENTS: BossMeterSegment[] = [
  { reward: 2, weight: 19, color: '#38bdf8' },
  { reward: 5, weight: 17, color: '#22c55e' },
  { reward: 10, weight: 11, color: '#facc15' },
  { reward: 20, weight: 6, color: '#f43f5e' },
  { reward: 10, weight: 11, color: '#facc15' },
  { reward: 5, weight: 17, color: '#22c55e' },
  { reward: 2, weight: 19, color: '#38bdf8' },
]

export function getBossMeterReward(position: number) {
  const target = Math.max(0, Math.min(0.999999, position)) * 100
  let end = 0
  for (const segment of BOSS_METER_SEGMENTS) {
    end += segment.weight
    if (target < end) return segment.reward
  }
  return BOSS_METER_SEGMENTS[BOSS_METER_SEGMENTS.length - 1].reward
}

