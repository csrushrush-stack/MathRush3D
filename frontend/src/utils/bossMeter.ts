export interface BossMeterSegment {
  reward: number
  weight: number
  color: string
}

export const BOSS_METER_SEGMENTS: BossMeterSegment[] = [
  { reward: 3, weight: 28, color: '#0ea5e9' },
  { reward: 8, weight: 17, color: '#22c55e' },
  { reward: 20, weight: 10, color: '#f97316' },
  { reward: 8, weight: 17, color: '#22c55e' },
  { reward: 3, weight: 28, color: '#0ea5e9' },
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
