import { describe, expect, it } from 'vitest'
import { BOSS_METER_SEGMENTS, getBossMeterReward } from './bossMeter'

describe('boss boost meter', () => {
  it('uses smaller zones for larger rewards', () => {
    const twenty = BOSS_METER_SEGMENTS.find((segment) => segment.reward === 20)!
    const eight = BOSS_METER_SEGMENTS.find((segment) => segment.reward === 8)!
    const three = BOSS_METER_SEGMENTS.find((segment) => segment.reward === 3)!
    expect(twenty.weight).toBeLessThan(eight.weight)
    expect(eight.weight).toBeLessThan(three.weight)
  })

  it('places the best reward in the difficult center zone', () => {
    expect(getBossMeterReward(0)).toBe(3)
    expect(getBossMeterReward(0.5)).toBe(20)
    expect(getBossMeterReward(0.99)).toBe(3)
  })
})
