export type GateOperation = 'add' | 'subtract' | 'multiply' | 'divide'

export interface GateOption {
  expr: string
  operation: GateOperation
  operand: number
}

export interface GatePairData {
  id: number
  worldZ: number
  left: GateOption
  right: GateOption
}

export interface BestRouteResult {
  finalCrowd: number
  totalGain: number
  choices: Array<'left' | 'right'>
}

export const GATE_WORLD_ZS = [-25, -50, -75, -100, -125, -150, -175, -200, -225, -250] as const

const MAX_ROUTE_CROWD = { easy: 110, medium: 150, hard: 190, expert: 230 } as const
const ADD_RANGES = {
  easy: [6, 11],
  medium: [9, 15],
  hard: [12, 19],
  expert: [15, 23],
} as const

function integer(random: () => number, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min
}

function option(operation: GateOperation, operand: number): GateOption {
  const safeOperand = Math.max(1, Math.round(operand))
  const symbol = operation === 'add' ? '+'
    : operation === 'subtract' ? '-'
      : operation === 'multiply' ? '×'
        : '÷'
  return { expr: `${symbol}${safeOperand}`, operation, operand: safeOperand }
}

/** Applies a gate to a crowd. Division is integer division and no gate can create a negative crowd. */
export function applyGateOption(crowd: number, gate: GateOption): number {
  const safeCrowd = Math.max(1, Math.round(crowd))
  const operand = Math.max(1, Math.round(gate.operand))

  if (gate.operation === 'add') return safeCrowd + operand
  if (gate.operation === 'subtract') return Math.max(1, safeCrowd - operand)
  if (gate.operation === 'multiply') return safeCrowd * operand
  return Math.max(1, Math.floor(safeCrowd / operand))
}

function buildStrongSidePattern(random: () => number): Array<'left' | 'right'> {
  const sides: Array<'left' | 'right'> = []
  let current: 'left' | 'right' = random() < 0.5 ? 'left' : 'right'
  let repeated = 0

  for (let index = 0; index < GATE_WORLD_ZS.length; index += 1) {
    if (index > 0) {
      const shouldSwitch = repeated >= 1 || random() < 0.72
      if (shouldSwitch) {
        current = current === 'left' ? 'right' : 'left'
        repeated = 0
      } else {
        repeated += 1
      }
    }
    sides.push(current)
  }
  return sides
}

function createOptions(
  difficulty: keyof typeof ADD_RANGES,
  index: number,
  bestCrowd: number,
  random: () => number,
): [GateOption, GateOption] {
  const [minAdd, maxAdd] = ADD_RANGES[difficulty]
  const boost = integer(random, minAdd, maxAdd) + Math.floor(index / 3)
  const safeLoss = Math.max(1, Math.min(bestCrowd - 1, integer(random, 2, Math.max(3, Math.floor(maxAdd * 0.65)))))
  const divisor = difficulty === 'expert' && bestCrowd >= 9 && random() > 0.55 ? 3 : 2
  const maxCrowd = MAX_ROUTE_CROWD[difficulty]
  const multiplier = difficulty === 'expert' && bestCrowd < 45 && random() > 0.55 ? 3 : 2
  const canMultiply = bestCrowd * multiplier <= maxCrowd

  // The ten-pair sequence deliberately exposes all four operations. Multipliers
  // only appear when they keep the best route inside the renderer's safe range.
  switch (index) {
    case 0: return [option('add', boost), option('subtract', safeLoss)]
    case 1: return [option('add', boost + 2), option('divide', divisor)]
    case 2: return canMultiply
      ? [option('multiply', multiplier), option('add', Math.max(2, boost - 3))]
      : [option('add', boost), option('subtract', safeLoss)]
    case 3: return [option('add', boost + 1), option('subtract', safeLoss)]
    case 4: return canMultiply
      ? [option('multiply', 2), option('divide', divisor)]
      : [option('add', boost), option('divide', divisor)]
    case 5: return [option('add', boost + 2), option('subtract', safeLoss)]
    case 6: return [option('add', boost), option('divide', divisor)]
    case 7: return canMultiply
      ? [option('multiply', 2), option('add', Math.max(2, boost - 4))]
      : [option('add', boost + 1), option('subtract', safeLoss)]
    case 8: return [option('add', boost + 2), option('divide', divisor)]
    default: return canMultiply
      ? [option('multiply', 2), option('subtract', safeLoss)]
      : [option('add', boost + 3), option('subtract', safeLoss)]
  }
}

export function generateGatePairs(difficulty: string, random: () => number = Math.random): GatePairData[] {
  const level = difficulty in ADD_RANGES ? difficulty as keyof typeof ADD_RANGES : 'hard'
  const strongSides = buildStrongSidePattern(random)
  let bestCrowd = 1

  return GATE_WORLD_ZS.map((worldZ, id) => {
    const [first, second] = createOptions(level, id, bestCrowd, random)
    const firstResult = applyGateOption(bestCrowd, first)
    const secondResult = applyGateOption(bestCrowd, second)
    const strong = firstResult >= secondResult ? first : second
    const weak = strong === first ? second : first
    const pair: GatePairData = strongSides[id] === 'left'
      ? { id, worldZ, left: strong, right: weak }
      : { id, worldZ, left: weak, right: strong }

    bestCrowd = Math.max(
      applyGateOption(bestCrowd, pair.left),
      applyGateOption(bestCrowd, pair.right),
    )
    return pair
  })
}

/** Simulates each gate in order; this is the authoritative achievable route. */
export function computeBestRoute(pairs: GatePairData[], startingCrowd = 1): BestRouteResult {
  let crowd = Math.max(1, Math.round(startingCrowd))
  const choices: Array<'left' | 'right'> = []

  for (const pair of pairs) {
    const leftResult = applyGateOption(crowd, pair.left)
    const rightResult = applyGateOption(crowd, pair.right)
    if (leftResult >= rightResult) {
      crowd = leftResult
      choices.push('left')
    } else {
      crowd = rightResult
      choices.push('right')
    }
  }

  return { finalCrowd: crowd, totalGain: crowd - startingCrowd, choices }
}

export function computeMaxPossibleGain(pairs: GatePairData[], startingCrowd = 1) {
  return computeBestRoute(pairs, startingCrowd).totalGain
}
