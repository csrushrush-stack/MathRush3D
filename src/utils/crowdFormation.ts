const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export interface FormationSlot {
  x: number
  z: number
  phase: number
  scale: number
}

export interface OrganicFormation {
  slots: FormationSlot[]
  width: number
  depth: number
}

function hash(index: number, seed: number) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43_758.5453
  return value - Math.floor(value)
}

/**
 * Creates a dense sunflower-shaped formation. Unlike a row grid, this has no
 * long straight edges and can compress without making the crowd look ordered.
 */
export function createOrganicFormation(count: number): OrganicFormation {
  const safeCount = Math.max(0, Math.round(count))
  if (safeCount === 0) return { slots: [], width: 0, depth: 0 }
  if (safeCount === 1) {
    return { slots: [{ x: 0, z: 0, phase: 0, scale: 1 }], width: 0, depth: 0 }
  }

  const raw = Array.from({ length: safeCount }, (_, index) => {
    const radius = Math.sqrt(index + 0.45)
    const angle = index * GOLDEN_ANGLE
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
  })
  const minX = Math.min(...raw.map((slot) => slot.x))
  const maxX = Math.max(...raw.map((slot) => slot.x))
  const minZ = Math.min(...raw.map((slot) => slot.z))
  const maxZ = Math.max(...raw.map((slot) => slot.z))
  const width = Math.min(3.25, 0.54 * Math.sqrt(safeCount))
  const depth = Math.min(9, 0.64 * Math.sqrt(safeCount))
  const xRange = Math.max(0.001, maxX - minX)
  const zRange = Math.max(0.001, maxZ - minZ)

  return {
    width,
    depth,
    slots: raw.map((slot, index) => ({
      x: ((slot.x - minX) / xRange - 0.5) * width + (hash(index, 1) - 0.5) * 0.055,
      z: ((slot.z - minZ) / zRange) * depth + (hash(index, 2) - 0.5) * 0.055,
      phase: hash(index, 3) * Math.PI * 2,
      scale: 0.92 + hash(index, 4) * 0.14,
    })),
  }
}

export function gateCompression(distanceToGate: number) {
  const normalized = Math.min(1, Math.max(0, Math.abs(distanceToGate) / 3.2))
  const eased = normalized * normalized * (3 - 2 * normalized)
  return 0.68 + eased * 0.32
}

/** A held input at the rail narrows the crowd enough for skillful tight passes. */
export function wallCompression(pressure: number) {
  const safePressure = Math.min(1, Math.max(0, pressure))
  const eased = safePressure * safePressure * (3 - 2 * safePressure)
  return 1 - eased * 0.46
}
