import { useGameStore, type Difficulty, type GameSettings } from '../store/useGameStore'

const API_BASE = import.meta.env.VITE_API_URL
  ?? (import.meta.env.DEV ? '' : 'https://math-rush-api.onrender.com')
const PENDING_RUNS_KEY = 'math-rush-pending-runs-v1'
const DEVICE_ID_KEY = 'math-rush-device-id-v1'

export interface LeaderboardEntry {
  rank: number
  playerId: string
  displayName: string
  score: number
  highestMultiplier: number
  gamesWon: number
  selectedSkin: string
}

export interface PlayerProfile {
  id: string
  displayName: string
  coins: number
  bestScore: number
  selectedDifficulty: Difficulty
  selectedSkin: string
  ownedSkins: string[]
  settings: GameSettings
  stats: {
    gamesPlayed: number
    gamesWon: number
    totalStars: number
    totalScore: number
    highestMultiplier: number
    totalMathGain: number
  }
}

interface PendingRun {
  clientRunId: string
  difficulty: string
  status: 'won' | 'lost'
  startedAt: string
  endedAt: string
  distance: number
  startingCrowd: number
  crowdAtBoss: number
  endingCrowd: number
  bossHealth: number
  multiplier: number
  stars: number
  mathGain: number
  maxMathGain: number
  bonusPoints: number
  clientVersion: string
  gateEvents: ReturnType<typeof useGameStore.getState>['gateEvents']
  obstacleEvents: ReturnType<typeof useGameStore.getState>['obstacleEvents']
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5_000)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      credentials: 'include',
      signal: controller.signal,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      throw new ApiError(body?.error ?? `API request failed (${response.status})`, response.status)
    }
    if (response.status === 204) return undefined as T
    return await response.json() as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing
  const id = `device_${crypto.randomUUID()}`
  localStorage.setItem(DEVICE_ID_KEY, id)
  return id
}

function readPendingRuns(): PendingRun[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_RUNS_KEY) ?? '[]') as PendingRun[]
  } catch {
    return []
  }
}

function writePendingRuns(runs: PendingRun[]) {
  localStorage.setItem(PENDING_RUNS_KEY, JSON.stringify(runs.slice(-20)))
}

function applyProfile(profile: PlayerProfile) {
  useGameStore.getState().syncPlayer(profile)
}

async function postRun(run: PendingRun, playerId: string) {
  const result = await requestJson<{
    player?: { coins: number; bestScore: number; stats: PlayerProfile['stats'] }
  }>('/api/runs', {
    method: 'POST',
    body: JSON.stringify({ ...run, playerId }),
  })
  if (result.player) {
    const state = useGameStore.getState()
    state.syncPlayer({
      id: playerId,
      displayName: state.displayName,
      coins: result.player.coins,
      bestScore: result.player.bestScore,
      stats: result.player.stats,
    })
  }
}

async function flushPendingRuns(playerId: string) {
  const pending = readPendingRuns()
  const remaining: PendingRun[] = []
  for (const run of pending) {
    try {
      await postRun(run, playerId)
    } catch {
      remaining.push(run)
    }
  }
  writePendingRuns(remaining)
}

export async function bootstrapPlayer() {
  const store = useGameStore.getState()
  store.setBackendStatus('connecting')
  try {
    const response = await requestJson<{ profile: PlayerProfile }>('/api/auth/me')
    applyProfile(response.profile)
    useGameStore.getState().setBackendStatus('online')
    await flushPendingRuns(response.profile.id)
    return true
  } catch (error) {
    store.setBackendStatus(error instanceof ApiError && error.status === 401 ? 'online' : 'offline')
    return false
  }
}

export async function registerAccount(input: { displayName: string; email: string; password: string }) {
  const response = await requestJson<{ profile: PlayerProfile }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...input, deviceId: getDeviceId() }),
  })
  applyProfile(response.profile)
  useGameStore.getState().setBackendStatus('online')
  await flushPendingRuns(response.profile.id)
  return response.profile
}

export async function loginAccount(email: string, password: string) {
  const response = await requestJson<{ profile: PlayerProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  applyProfile(response.profile)
  useGameStore.getState().setBackendStatus('online')
  await flushPendingRuns(response.profile.id)
  return response.profile
}

export async function logoutAccount() {
  try {
    await requestJson<void>('/api/auth/logout', { method: 'POST' })
  } finally {
    useGameStore.getState().clearPlayer()
  }
}

export async function submitCompletedRun() {
  const state = useGameStore.getState()
  if (!state.clientRunId || !state.runStartedAt) return
  const won = state.phase === 'win'
  const run: PendingRun = {
    clientRunId: state.clientRunId,
    difficulty: state.difficulty,
    status: won ? 'won' : 'lost',
    startedAt: state.runStartedAt,
    endedAt: new Date().toISOString(),
    distance: state.runDistance,
    startingCrowd: 1,
    crowdAtBoss: state.crowdAtBoss,
    endingCrowd: 0,
    bossHealth: state.bossHealth,
    multiplier: won ? state.finishMultiplier : 1,
    stars: won ? state.starsEarned : 0,
    mathGain: state.actualMathGain,
    maxMathGain: state.maxPossibleMathGain,
    bonusPoints: won ? state.bonusPoints : 0,
    clientVersion: '0.1.0',
    gateEvents: state.gateEvents,
    obstacleEvents: state.obstacleEvents,
  }
  const pending = readPendingRuns()
  if (!pending.some((item) => item.clientRunId === run.clientRunId)) {
    writePendingRuns([...pending, run])
  }
  if (!state.playerId) return
  try {
    await postRun(run, state.playerId)
    writePendingRuns(readPendingRuns().filter((item) => item.clientRunId !== run.clientRunId))
    useGameStore.getState().setBackendStatus('online')
  } catch {
    useGameStore.getState().setBackendStatus('offline')
  }
}

export async function fetchLeaderboard(difficulty?: string) {
  const query = difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : ''
  const response = await requestJson<{ entries: LeaderboardEntry[] }>(`/api/leaderboard${query}`)
  return response.entries
}

export async function saveSettings(settings: GameSettings) {
  const { playerId } = useGameStore.getState()
  if (!playerId) return
  await requestJson(`/api/players/${playerId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  })
}

export async function saveSelectedDifficulty(selectedDifficulty: Difficulty) {
  const { playerId } = useGameStore.getState()
  if (!playerId) return
  await requestJson(`/api/players/${playerId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ selectedDifficulty }),
  })
}

export async function purchaseSkin(skinId: string) {
  const { playerId } = useGameStore.getState()
  if (!playerId) return null
  return requestJson<{ coins: number; selectedSkin: string }>(
    `/api/players/${playerId}/skins/${skinId}/purchase`,
    { method: 'POST' },
  )
}
