import { describe, expect, it } from 'vitest'
import { BOSS_METER_SEGMENTS, getBossMeterReward } from './bossMeter'

describe('boss boost meter', () => {
  it('uses smaller zones for larger rewards', () => {
    const twenty = BOSS_METER_SEGMENTS.find((segment) => segment.reward === 20)!
    const ten = BOSS_METER_SEGMENTS.find((segment) => segment.reward === 10)!
    const five = BOSS_METER_SEGMENTS.find((segment) => segment.reward === 5)!
    expect(twenty.weight).toBeLessThan(ten.weight)
    expect(ten.weight).toBeLessThan(five.weight)
  })

  it('places the best reward in the difficult center zone', () => {
    expect(getBossMeterReward(0)).toBe(2)
    expect(getBossMeterReward(0.5)).toBe(20)
    expect(getBossMeterReward(0.99)).toBe(2)
  })
})

