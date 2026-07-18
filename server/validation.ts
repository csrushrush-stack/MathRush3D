import { z } from 'zod'

export const difficultySchema = z.enum(['easy', 'medium', 'hard', 'expert'])
export const settingsSchema = z.object({
  music: z.boolean().optional(),
  soundEffects: z.boolean().optional(),
  vibration: z.boolean().optional(),
  notifications: z.boolean().optional(),
  reducedEffects: z.boolean().optional(),
})
export const progressSchema = z.object({
  selectedDifficulty: difficultySchema,
  selectedLevel: z.number().int().min(1).max(5).optional(),
})

export const sessionSchema = z.object({
  deviceId: z.string().min(16).max(128),
  displayName: z.string().trim().min(1).max(32).optional(),
})

const emailSchema = z.string().trim().email().max(254)
const passwordSchema = z.string().min(8).max(128)

export const registrationSchema = z.object({
  displayName: z.string().trim().min(2).max(32),
  email: emailSchema,
  password: passwordSchema,
  deviceId: z.string().min(16).max(128),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

const gateEventSchema = z.object({
  gateIndex: z.number().int().min(0).max(9),
  worldZ: z.number().min(-1_000).max(0),
  leftExpression: z.string().min(1).max(24),
  rightExpression: z.string().min(1).max(24),
  chosenSide: z.enum(['left', 'right']),
  chosenDelta: z.number().int().min(-1_000).max(1_000),
  optimalDelta: z.number().int().min(-1_000).max(1_000),
  crowdBefore: z.number().int().min(0).max(10_000),
  crowdAfter: z.number().int().min(0).max(10_000),
})

const obstacleEventSchema = z.object({
  obstacleIndex: z.number().int().min(0).max(20),
  worldZ: z.number().min(-1_000).max(0),
  obstacleType: z.enum(['wall', 'blocker', 'enemy', 'hammer', 'cones', 'pit', 'spinner', 'crusher']),
  outcome: z.enum(['hit', 'dodged', 'defeated']),
  crowdBefore: z.number().int().min(0).max(10_000),
  crowdAfter: z.number().int().min(0).max(10_000),
  damage: z.number().int().min(0).max(10_000),
})

export const runSchema = z.object({
  clientRunId: z.string().uuid(),
  playerId: z.string().uuid(),
  difficulty: difficultySchema,
  level: z.number().int().min(1).max(5),
  status: z.enum(['won', 'lost']),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  distance: z.number().min(0).max(10_000),
  startingCrowd: z.number().int().min(1).max(100),
  crowdAtBoss: z.number().int().min(0).max(10_000),
  endingCrowd: z.number().int().min(0).max(10_000),
  bossHealth: z.number().int().min(0).max(10_000),
  multiplier: z.number().int().min(1).max(10),
  stars: z.number().int().min(0).max(3),
  mathGain: z.number().int().min(-10_000).max(10_000),
  maxMathGain: z.number().int().min(0).max(10_000),
  bonusPoints: z.number().int().min(0).max(1_000_000).default(0),
  clientVersion: z.string().min(1).max(32).default('dev'),
  gateEvents: z.array(gateEventSchema).max(10),
  obstacleEvents: z.array(obstacleEventSchema).max(30),
})
