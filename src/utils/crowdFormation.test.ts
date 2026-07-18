import { describe, expect, it } from 'vitest'
import { createOrganicFormation, gateCompression, wallCompression } from './crowdFormation'

describe('organic crowd formation', () => {
  it('keeps every member inside its reported bounds', () => {
    for (const count of [1, 10, 80, 240]) {
      const formation = createOrganicFormation(count)
      expect(formation.slots).toHaveLength(count)
      for (const slot of formation.slots) {
        expect(Math.abs(slot.x)).toBeLessThanOrEqual(formation.width / 2 + 0.04)
        expect(slot.z).toBeGreaterThanOrEqual(-0.04)
        expect(slot.z).toBeLessThanOrEqual(formation.depth + 0.04)
      }
    }
  })

  it('compresses near a gate and expands away from it', () => {
    expect(gateCompression(0)).toBeCloseTo(0.68)
    expect(gateCompression(1)).toBeLessThan(gateCompression(2))
    expect(gateCompression(4)).toBe(1)
  })

  it('squeezes at a wall without collapsing the formation', () => {
    expect(wallCompression(0)).toBe(1)
    expect(wallCompression(0.5)).toBeCloseTo(0.77)
    expect(wallCompression(1)).toBeCloseTo(0.54)
    expect(wallCompression(3)).toBeCloseTo(0.54)
  })
})
