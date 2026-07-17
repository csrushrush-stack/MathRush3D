import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/useGameStore'
import { audioManager } from '../../utils/audioManager'
import {
  MULTIPLIER_TIERS,
  calculateBonusPoints,
  calculateBonusStageSacrifice,
  crossedPlane,
  type LevelBalance,
} from '../../utils/gameBalance'
import type { CrowdController } from './CrowdRuntime'

export const BOSS_WORLD_Z = -275
const BOSS_FIGHT_SECONDS = 1.15

function createTextTexture(title: string, subtitle: string, accent: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)
  const gradient = context.createLinearGradient(0, 0, 512, 256)
  gradient.addColorStop(0, 'rgba(15, 23, 42, 0.94)')
  gradient.addColorStop(1, 'rgba(49, 46, 129, 0.9)')
  context.fillStyle = gradient
  context.fillRect(8, 8, 496, 240)
  context.strokeStyle = accent
  context.lineWidth = 10
  context.strokeRect(8, 8, 496, 240)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.shadowColor = accent
  context.shadowBlur = 24
  context.fillStyle = '#ffffff'
  context.font = '900 128px Inter, Arial, sans-serif'
  context.fillText(title, 256, 126)
  context.shadowBlur = 0
  context.fillStyle = '#c7d2fe'
  context.font = '800 30px Inter, Arial, sans-serif'
  context.fillText(subtitle, 256, 207)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return texture
}

function TextSign({ title, subtitle, accent, position, size = [3.2, 1.6] }: {
  title: string
  subtitle: string
  accent: string
  position: [number, number, number]
  size?: [number, number]
}) {
  const texture = useMemo(
    () => createTextTexture(title, subtitle, accent),
    [accent, subtitle, title],
  )
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}

function BossCharacter({ defeated }: { defeated: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const scale = useRef(1)
  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return
    if (defeated) {
      scale.current = Math.max(0, scale.current - Math.min(delta, 0.05) * 3.4)
      groupRef.current.scale.setScalar(scale.current)
      groupRef.current.rotation.y += delta * 3
      return
    }
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 2.2) * 0.12
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.9) * 0.08
  })

  return (
    <group ref={groupRef}>
      <mesh position={[0, 1.8, 0]} castShadow>
        <cylinderGeometry args={[1.05, 1.3, 3.2, 10]} />
        <meshStandardMaterial color="#6d28d9" emissive="#7c3aed" emissiveIntensity={0.42} roughness={0.28} metalness={0.55} />
      </mesh>
      <mesh position={[0, 3.78, 0]} castShadow>
        <sphereGeometry args={[1.05, 14, 12]} />
        <meshStandardMaterial color="#7e22ce" emissive="#a855f7" emissiveIntensity={0.4} roughness={0.24} metalness={0.5} />
      </mesh>
      {[-0.38, 0.38].map((x) => (
        <mesh key={x} position={[x, 3.93, 0.88]}>
          <sphereGeometry args={[0.21, 8, 6]} />
          <meshBasicMaterial color="#fb7185" />
        </mesh>
      ))}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 4.72, 0]} rotation={[0, 0, x < 0 ? 0.4 : -0.4]}>
          <coneGeometry args={[0.22, 0.9, 6]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.45} />
        </mesh>
      ))}
      {[-1.45, 1.45].map((x) => (
        <mesh key={x} position={[x, 2.2, 0]} rotation={[0, 0, x < 0 ? 0.52 : -0.52]} castShadow>
          <cylinderGeometry args={[0.3, 0.22, 1.75, 8]} />
          <meshStandardMaterial color="#6d28d9" emissive="#7c3aed" emissiveIntensity={0.34} />
        </mesh>
      ))}
    </group>
  )
}

function MultiplierGate({ tier, earned }: {
  tier: (typeof MULTIPLIER_TIERS)[number]
  earned: number
}) {
  const completed = tier.multiplier <= earned
  const current = tier.multiplier === earned
  const accent = completed ? '#fbbf24' : '#8b5cf6'
  return (
    <group position={[0, 0, tier.worldZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow>
        <planeGeometry args={[5, 5.2]} />
        <meshStandardMaterial color={completed ? '#7c2d12' : '#172554'} emissive={accent} emissiveIntensity={current ? 0.42 : 0.1} roughness={0.55} />
      </mesh>
      {[-2.42, 2.42].map((x) => (
        <mesh key={x} position={[x, 1.25, 0]}>
          <boxGeometry args={[0.16, 2.5, 0.25]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={completed ? 0.8 : 0.28} metalness={0.7} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 2.48, 0]}>
        <boxGeometry args={[5, 0.18, 0.25]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={completed ? 0.8 : 0.28} metalness={0.7} roughness={0.2} />
      </mesh>
      <TextSign
        title={`x${tier.multiplier}`}
        subtitle=""
        accent={accent}
        position={[0, 1.25, 0.16]}
        size={[2.8, 1.4]}
      />
    </group>
  )
}

interface BossManagerProps {
  balance: LevelBalance
  crowdZRef: React.RefObject<number>
  crowdControllerRef: React.MutableRefObject<CrowdController | null>
  cameraShakeRef: React.MutableRefObject<number>
  isPaused: boolean
}

export function BossManager({
  balance,
  crowdZRef,
  crowdControllerRef,
  cameraShakeRef,
  isPaused,
}: BossManagerProps) {
  const bossDefeated = useGameStore((state) => state.bossDefeated)
  const finishMultiplier = useGameStore((state) => state.finishMultiplier)
  const bossTriggered = useRef(false)
  const bonusTierIndex = useRef(0)
  const previousZ = useRef(0)
  const fight = useRef({ active: false, elapsed: 0, strike: 0, remaining: balance.bossHealth })
  const conversion = useRef({ active: false, elapsed: 0, strike: 0, remaining: 0, tierIndex: 0 })

  useFrame((_, frameDelta) => {
    const currentZ = crowdZRef.current
    if (isPaused) {
      previousZ.current = currentZ
      return
    }

    if (!bossTriggered.current && crossedPlane(previousZ.current, currentZ, BOSS_WORLD_Z)) {
      bossTriggered.current = true
      const state = useGameStore.getState()
      const crowdAtBoss = state.crowdSize
      state.beginBoss({
        bossHealth: balance.bossHealth,
        realisticMaxCrowd: balance.realisticMaxCrowd,
        crowdAtBoss,
        finishMultiplier: 1,
      })

      fight.current = { active: true, elapsed: 0, strike: 0, remaining: balance.bossHealth }
      cameraShakeRef.current = 0.7
    }

    if (fight.current.active) {
      fight.current.elapsed += Math.min(frameDelta, 0.05)
      const strikes = Math.max(6, Math.min(16, balance.bossHealth))
      const strikeInterval = BOSS_FIGHT_SECONDS / strikes
      if (fight.current.elapsed >= strikeInterval) {
        fight.current.elapsed -= strikeInterval
        fight.current.strike += 1
        const controller = crowdControllerRef.current
        const damage = Math.min(
          fight.current.remaining,
          Math.max(1, Math.ceil(balance.bossHealth / strikes)),
        )
        const removed = controller?.removeFront(damage, `boss-${fight.current.strike}`, {
          x: fight.current.strike % 2 === 0 ? 2.8 : -2.8,
          z: 1.1,
          upward: 3,
        }) ?? 0
        fight.current.remaining = Math.max(0, fight.current.remaining - removed)
        const state = useGameStore.getState()
        state.setBossRemainingHealth(fight.current.remaining)
        cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.9)
        audioManager.playBossHit()

        if (fight.current.remaining <= 0) {
          fight.current.active = false
          state.defeatBoss(controller?.getAliveCount() ?? state.crowdSize)
          audioManager.playBossDefeat()
        } else if (!controller || controller.getAliveCount() <= 0) {
          fight.current.active = false
          state.failRun()
          audioManager.playGameOver()
        }
      }
    }

    const state = useGameStore.getState()
    if (state.runStage === 'bonus' && !conversion.current.active) {
      const target = MULTIPLIER_TIERS[bonusTierIndex.current]
      if (target && crossedPlane(previousZ.current, currentZ, target.worldZ)) {
        const alive = crowdControllerRef.current?.getAliveCount() ?? state.crowdSize
        conversion.current = {
          active: true,
          elapsed: 0,
          strike: 0,
          remaining: calculateBonusStageSacrifice(bonusTierIndex.current, alive),
          tierIndex: bonusTierIndex.current,
        }
        state.setFinishMultiplier(target.multiplier)
        state.setRunStage('conversion')
        cameraShakeRef.current = 0.5
      }
    }

    if (conversion.current.active) {
      conversion.current.elapsed += Math.min(frameDelta, 0.05)
      if (conversion.current.elapsed >= 0.072) {
        conversion.current.elapsed -= 0.072
        conversion.current.strike += 1
        const controller = crowdControllerRef.current
        const alive = controller?.getAliveCount() ?? 0
        const isFinalTier = conversion.current.tierIndex === MULTIPLIER_TIERS.length - 1
        const batch = isFinalTier && alive > 40 ? 3 : isFinalTier && alive > 18 ? 2 : 1
        const requested = Math.min(batch, conversion.current.remaining)
        const removed = controller?.removeFront(batch, `bonus-${conversion.current.strike}`, {
          x: (conversion.current.strike % 3 - 1) * 2.25,
          z: -2.7,
          upward: 4.8 + (conversion.current.tierIndex * 0.18),
        }) ?? 0
        if (removed > 0) {
          conversion.current.remaining = Math.max(0, conversion.current.remaining - Math.min(removed, requested))
          cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.22)
          audioManager.playGateHit()
        }
        const aliveAfter = controller?.getAliveCount() ?? 0
        if (!controller || aliveAfter <= 0) {
          conversion.current.active = false
          const finalState = useGameStore.getState()
          finalState.setBonusPoints(calculateBonusPoints(finalState.remainingCrowdAfterBoss, finalState.finishMultiplier))
          state.finishRun()
          audioManager.playWin()
        } else if (conversion.current.remaining <= 0) {
          conversion.current.active = false
          bonusTierIndex.current += 1
          state.setRunStage('bonus')
        }
      }
    }

    previousZ.current = currentZ
  })

  return (
    <>
      <group position={[0, 0, BOSS_WORLD_Z]}>
        <BossCharacter defeated={bossDefeated} />
        {!bossDefeated && (
          <TextSign
            title={balance.bossHealth.toString()}
            subtitle="BOSS POWER"
            accent="#c084fc"
            position={[0, 2.15, 1.3]}
            size={[2.9, 1.45]}
          />
        )}
      </group>
      {MULTIPLIER_TIERS.map((tier) => (
        <MultiplierGate key={tier.multiplier} tier={tier} earned={finishMultiplier} />
      ))}
    </>
  )
}
