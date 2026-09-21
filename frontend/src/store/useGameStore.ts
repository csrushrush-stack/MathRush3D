import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  calculateRunRewards,
  calculateStars,
  type LevelBalance,
} from '../utils/gameBalance'
import type { ObstacleType } from '../utils/obstacles'
import { completeLevel, EMPTY_LEVEL_PROGRESS, LEVELS_PER_DIFFICULTY, normalizeLevelProgress, type LevelProgress } from '../utils/levelProgress'

export type GamePhase = 'home' | 'playing' | 'paused' | 'gameover' | 'win'
export type RunStage = 'run' | 'battle' | 'meter' | 'boss' | 'bonus' | 'conversion' | 'complete'
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'
export type BackendStatus = 'connecting' | 'online' | 'offline'

export interface GameSettings {
  music: boolean
  soundEffects: boolean
  vibration: boolean
  notifications: boolean
  reducedEffects: boolean
}

export interface GateRunEvent {
  gateIndex: number
  worldZ: number
  leftExpression: string
  rightExpression: string
  chosenSide: 'left' | 'right'
  chosenDelta: number
  optimalDelta: number
  crowdBefore: number
  crowdAfter: number
}

export interface ObstacleRunEvent {
  obstacleIndex: number
  worldZ: number
  obstacleType: ObstacleType
  outcome: 'hit' | 'dodged' | 'defeated'
  crowdBefore: number
  crowdAfter: number
  damage: number
}

export interface LifetimeStats {
  gamesPlayed: number
  gamesWon: number
  totalStars: number
  totalScore: number
  highestMultiplier: number
  totalMathGain: number
}

interface GameState {
  phase: GamePhase
  runStage: RunStage
  difficulty: Difficulty
  selectedLevel: number
  levelProgress: LevelProgress
  gameKey: number
  isPaused: boolean

  playerId: string | null
  displayName: string
  backendStatus: BackendStatus
  score: number
  bestScore: number
  coins: number
  settings: GameSettings
  selectedSkin: string
  ownedSkins: string[]
  lifetimeStats: LifetimeStats

  crowdSize: number
  crowdX: number
  runDistance: number
  runStartedAt: string | null
  clientRunId: string | null
  maxPossibleMathGain: number
  actualMathGain: number
  mandatoryObstacleDamage: number
  realisticMaxCrowd: number
  bossDefeated: boolean
  bossMeterBoost: number
  bossHealth: number
  bossRemainingHealth: number
  crowdAtBoss: number
  starsEarned: number
  remainingCrowdAfterBoss: number
  finishMultiplier: number
  bonusPoints: number
  coinsEarned: number
  gateEvents: GateRunEvent[]
  obstacleEvents: ObstacleRunEvent[]

  setPhase: (phase: GamePhase) => void
  setPaused: (paused: boolean) => void
  setDifficulty: (difficulty: Difficulty) => void
  setSelectedLevel: (level: number) => void
  setBackendStatus: (status: BackendStatus) => void
  syncPlayer: (profile: {
    id: string
    displayName: string
    coins: number
    bestScore: number
    selectedDifficulty?: Difficulty
    selectedLevel?: number
    levelProgress?: Partial<LevelProgress>
    selectedSkin?: string
    ownedSkins?: string[]
    settings?: Partial<GameSettings>
    stats?: Partial<LifetimeStats>
  }) => void
  clearPlayer: () => void
  addCoins: (amount: number) => void
  setSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void
  buyAndEquipSkin: (skinId: string, price: number) => boolean
  equipSkin: (skinId: string) => void

  setCrowdX: (x: number) => void
  setCrowdSize: (size: number) => void
  setRunDistance: (distance: number) => void
  setRunStage: (stage: RunStage) => void
  initializeLevel: (balance: LevelBalance) => void
  beginBossMeter: () => void
  applyBossMeterBoost: (boost: number) => void
  recordGateChoice: (event: GateRunEvent) => void
  recordObstacle: (event: ObstacleRunEvent) => void
  beginBoss: (input: {
    bossHealth: number
    realisticMaxCrowd: number
    crowdAtBoss: number
    finishMultiplier: number
  }) => void
  setBossRemainingHealth: (health: number) => void
  defeatBoss: (remainingCrowd: number) => void
  setFinishMultiplier: (multiplier: number) => void
  setBonusPoints: (points: number) => void
  addBonusPoints: (points: number) => void
  finishRun: () => void
  failRun: () => void
  resetGame: () => void
}

const defaultSettings: GameSettings = {
  music: true,
  soundEffects: true,
  vibration: true,
  notifications: false,
  reducedEffects: false,
}

const defaultStats: LifetimeStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  totalStars: 0,
  totalScore: 0,
  highestMultiplier: 1,
  totalMathGain: 0,
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: 'home',
      runStage: 'run',
      difficulty: 'easy',
      selectedLevel: 1,
      levelProgress: EMPTY_LEVEL_PROGRESS,
      gameKey: 0,
      isPaused: false,

      playerId: null,
      displayName: 'Math Runner',
      backendStatus: 'connecting',
      score: 0,
      bestScore: 0,
      coins: 250,
      settings: defaultSettings,
      selectedSkin: 'default',
      ownedSkins: ['default'],
      lifetimeStats: defaultStats,

      crowdSize: 1,
      crowdX: 0,
      runDistance: 0,
      runStartedAt: null,
      clientRunId: null,
      maxPossibleMathGain: 0,
      actualMathGain: 0,
      mandatoryObstacleDamage: 0,
      realisticMaxCrowd: 0,
      bossDefeated: false,
      bossMeterBoost: 0,
      bossHealth: 0,
      bossRemainingHealth: 0,
      crowdAtBoss: 0,
      starsEarned: 0,
      remainingCrowdAfterBoss: 0,
      finishMultiplier: 1,
      bonusPoints: 0,
      coinsEarned: 0,
      gateEvents: [],
      obstacleEvents: [],

      setPhase: (phase) => set({ phase, isPaused: phase === 'paused' }),
      setPaused: (isPaused) => set({ isPaused }),
      setDifficulty: (difficulty) => set({ difficulty }),
      setSelectedLevel: (selectedLevel) => set({ selectedLevel: Math.max(1, Math.min(LEVELS_PER_DIFFICULTY, Math.round(selectedLevel))) }),
      setBackendStatus: (backendStatus) => set({ backendStatus }),

      syncPlayer: (profile) => set((state) => ({
        playerId: profile.id,
        displayName: profile.displayName,
        coins: profile.coins,
        bestScore: profile.bestScore,
        difficulty: profile.selectedDifficulty ?? state.difficulty,
        selectedLevel: Math.max(1, Math.min(LEVELS_PER_DIFFICULTY, profile.selectedLevel ?? state.selectedLevel)),
        levelProgress: normalizeLevelProgress({ ...state.levelProgress, ...profile.levelProgress }),
        selectedSkin: profile.selectedSkin ?? state.selectedSkin,
        ownedSkins: profile.ownedSkins ?? state.ownedSkins,
        settings: { ...state.settings, ...profile.settings },
        lifetimeStats: { ...state.lifetimeStats, ...profile.stats },
      })),
      clearPlayer: () => set({
        phase: 'home',
        playerId: null,
        displayName: 'Math Runner',
        backendStatus: 'connecting',
        score: 0,
        bestScore: 0,
        coins: 250,
        selectedSkin: 'default',
        ownedSkins: ['default'],
        lifetimeStats: defaultStats,
        selectedLevel: 1,
        levelProgress: EMPTY_LEVEL_PROGRESS,
      }),

      addCoins: (amount) => set((state) => ({ coins: Math.max(0, state.coins + amount) })),
      setSetting: (key, value) => set((state) => ({
        settings: { ...state.settings, [key]: value },
      })),
      buyAndEquipSkin: (skinId, price) => {
        const state = get()
        if (state.ownedSkins.includes(skinId)) {
          set({ selectedSkin: skinId })
          return true
        }
        if (price < 0 || state.coins < price) return false
        set({
          coins: state.coins - price,
          selectedSkin: skinId,
          ownedSkins: [...state.ownedSkins, skinId],
        })
        return true
      },
      equipSkin: (skinId) => {
        if (get().ownedSkins.includes(skinId)) set({ selectedSkin: skinId })
      },

      setCrowdX: (crowdX) => set({ crowdX }),
      setCrowdSize: (crowdSize) => set({ crowdSize: Math.max(0, Math.round(crowdSize)) }),
      setRunDistance: (runDistance) => set({ runDistance: Math.max(0, runDistance) }),
      setRunStage: (runStage) => set({ runStage }),
      initializeLevel: (balance) => set({
        maxPossibleMathGain: balance.maxPossibleMathGain,
        mandatoryObstacleDamage: balance.mandatoryObstacleDamage,
        realisticMaxCrowd: balance.realisticMaxCrowd,
        bossHealth: balance.bossHealth,
        bossRemainingHealth: balance.bossHealth,
      }),
      beginBossMeter: () => set({ runStage: 'meter', bossMeterBoost: 0 }),
      applyBossMeterBoost: (boost) => set((state) => ({
        runStage: 'run',
        bossMeterBoost: Math.max(0, Math.round(boost)),
        crowdSize: Math.min(240, state.crowdSize + Math.max(0, Math.round(boost))),
      })),
      recordGateChoice: (event) => set((state) => ({
        actualMathGain: state.actualMathGain + event.chosenDelta,
        gateEvents: [...state.gateEvents, event],
      })),
      recordObstacle: (event) => set((state) => ({
        obstacleEvents: [...state.obstacleEvents, event],
      })),
      beginBoss: ({ bossHealth, realisticMaxCrowd, crowdAtBoss, finishMultiplier }) => set({
        runStage: 'boss',
        bossHealth,
        bossRemainingHealth: bossHealth,
        realisticMaxCrowd,
        crowdAtBoss,
        finishMultiplier,
      }),
      setBossRemainingHealth: (bossRemainingHealth) => set({
        bossRemainingHealth: Math.max(0, Math.round(bossRemainingHealth)),
      }),
      defeatBoss: (remainingCrowd) => {
        const { realisticMaxCrowd } = get()
        set({
          runStage: 'bonus',
          bossDefeated: true,
          bossRemainingHealth: 0,
          crowdSize: Math.max(1, remainingCrowd),
          remainingCrowdAfterBoss: Math.max(1, remainingCrowd),
          starsEarned: calculateStars(remainingCrowd, realisticMaxCrowd),
        })
      },
      setFinishMultiplier: (finishMultiplier) => set({
        finishMultiplier: Math.max(1, Math.round(finishMultiplier)),
      }),
      setBonusPoints: (bonusPoints) => set({
        bonusPoints: Math.max(0, Math.round(bonusPoints)),
      }),
      addBonusPoints: (points) => set((state) => ({
        bonusPoints: state.bonusPoints + Math.max(0, Math.round(points)),
      })),
      finishRun: () => {
        const state = get()
        const levelProgress = completeLevel(state.levelProgress, state.difficulty, state.selectedLevel)
        const rewards = calculateRunRewards({
          actualMathGain: state.actualMathGain,
          distance: state.runDistance,
          multiplier: state.finishMultiplier,
          stars: state.starsEarned,
          won: true,
          bonusPoints: state.bonusPoints,
        })
        set({
          phase: 'win',
          runStage: 'complete',
          score: rewards.score,
          bestScore: Math.max(state.bestScore, rewards.score),
          coins: state.coins + rewards.coins,
          coinsEarned: rewards.coins,
          levelProgress,
          lifetimeStats: {
            gamesPlayed: state.lifetimeStats.gamesPlayed + 1,
            gamesWon: state.lifetimeStats.gamesWon + 1,
            totalStars: state.lifetimeStats.totalStars + state.starsEarned,
            totalScore: state.lifetimeStats.totalScore + rewards.score,
            highestMultiplier: Math.max(state.lifetimeStats.highestMultiplier, state.finishMultiplier),
            totalMathGain: state.lifetimeStats.totalMathGain + Math.max(0, state.actualMathGain),
          },
        })
      },
      failRun: () => {
        const state = get()
        if (state.phase === 'gameover') return
        const rewards = calculateRunRewards({
          actualMathGain: state.actualMathGain,
          distance: state.runDistance,
          multiplier: 1,
          stars: 0,
          won: false,
        })
        set({
          phase: 'gameover',
          runStage: 'complete',
          crowdSize: 0,
          score: rewards.score,
          bestScore: Math.max(state.bestScore, rewards.score),
          lifetimeStats: {
            ...state.lifetimeStats,
            gamesPlayed: state.lifetimeStats.gamesPlayed + 1,
            totalScore: state.lifetimeStats.totalScore + rewards.score,
            totalMathGain: state.lifetimeStats.totalMathGain + Math.max(0, state.actualMathGain),
          },
        })
      },
      resetGame: () => set((state) => ({
        gameKey: state.gameKey + 1,
        phase: 'playing',
        runStage: 'run',
        isPaused: false,
        score: 0,
        crowdSize: 1,
        crowdX: 0,
        runDistance: 0,
        runStartedAt: new Date().toISOString(),
        clientRunId: crypto.randomUUID(),
        maxPossibleMathGain: 0,
        actualMathGain: 0,
        mandatoryObstacleDamage: 0,
        realisticMaxCrowd: 0,
        bossDefeated: false,
        bossMeterBoost: 0,
        bossHealth: 0,
        bossRemainingHealth: 0,
        crowdAtBoss: 0,
        starsEarned: 0,
        remainingCrowdAfterBoss: 0,
        finishMultiplier: 1,
        bonusPoints: 0,
        coinsEarned: 0,
        gateEvents: [],
        obstacleEvents: [],
      })),
    }),
    {
      name: 'math-rush-player-v2',
      partialize: (state) => ({
        difficulty: state.difficulty,
        selectedLevel: state.selectedLevel,
        levelProgress: state.levelProgress,
        playerId: state.playerId,
        displayName: state.displayName,
        bestScore: state.bestScore,
        coins: state.coins,
        settings: state.settings,
        selectedSkin: state.selectedSkin,
        ownedSkins: state.ownedSkins,
        lifetimeStats: state.lifetimeStats,
      }),
    },
  ),
)
