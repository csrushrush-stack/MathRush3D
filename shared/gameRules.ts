export interface RunRewardInput {
  actualMathGain: number
  distance: number
  multiplier: number
  stars: number
  won: boolean
  bonusPoints?: number
}

/** Shared by the browser and API so score/reward calculations cannot drift. */
export function calculateRunRewards(input: RunRewardInput) {
  const safeMathGain = Math.max(0, input.actualMathGain)
  const score = Math.round(
    safeMathGain * 20
      + Math.max(0, input.distance) * 2
      + (input.won ? 500 : 0)
      + (input.won ? input.multiplier * 175 : 0)
      + Math.max(0, input.bonusPoints ?? 0),
  )
  const coins = input.won ? 15 + input.multiplier * 8 + input.stars * 10 : 0
  return { score, coins }
}
