import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
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
export const BOSS_METER_WORLD_Z = -265
const BOSS_FIGHT_SECONDS = 3.4
const BOSS_MODEL = '/models/boss/quaternius-orc-boss.glb'
const FINISH_OVERHEAD_MODEL = '/models/finish/kenney-overhead.glb'
const FINISH_FLAG_MODEL = '/models/finish/kenney-flag-checkers.glb'
const FINISH_ROAD_END_MODEL = '/models/finish/kenney-road-end.glb'

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

function BossCharacter({ defeated, fighting }: { defeated: boolean; fighting: boolean }) {
  const groupRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group>(null)
  const axeRef = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(BOSS_MODEL)
  const model = useMemo(() => clone(scene), [scene])
  const { actions } = useAnimations(animations, modelRef)

  useEffect(() => {
    const idle = actions['CharacterArmature|Idle']
    const attack = actions['CharacterArmature|Bite_Front']
    const death = actions['CharacterArmature|Death']
    Object.values(actions).forEach((action) => action?.fadeOut(0.12))
    const next = defeated ? death : fighting ? attack : idle
    if (!next) return
    next.reset().fadeIn(0.15)
    next.setLoop(defeated ? THREE.LoopOnce : THREE.LoopRepeat, defeated ? 1 : Infinity)
    next.clampWhenFinished = defeated
    next.play()
  }, [actions, defeated, fighting])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    if (axeRef.current) {
      const swing = fighting ? Math.sin(clock.elapsedTime * 10) : -0.45
      axeRef.current.rotation.z = -0.55 + swing * 0.75
    }
    groupRef.current.position.y = defeated ? 0 : Math.sin(clock.elapsedTime * 2.2) * 0.06
  })

  return (
    <group ref={groupRef}>
      <group ref={modelRef} scale={1.6} rotation={[0, Math.PI, 0]}>
        <primitive object={model} />
      </group>
      <group ref={axeRef} position={[1.25, 2.05, 0.1]}>
        <mesh position={[0, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.075, 1.65, 8]} />
          <meshStandardMaterial color="#78350f" roughness={0.7} />
        </mesh>
        <mesh position={[0.25, 1.5, 0]} rotation={[0, 0, -0.2]} castShadow>
          <boxGeometry args={[0.65, 0.48, 0.16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>
    </group>
  )
}

useGLTF.preload(BOSS_MODEL)

function FinishZone() {
  const overheadSource = useGLTF(FINISH_OVERHEAD_MODEL).scene
  const flagSource = useGLTF(FINISH_FLAG_MODEL).scene
  const roadEndSource = useGLTF(FINISH_ROAD_END_MODEL).scene
  const overhead = useMemo(() => overheadSource.clone(true), [overheadSource])
  const leftFlag = useMemo(() => flagSource.clone(true), [flagSource])
  const rightFlag = useMemo(() => flagSource.clone(true), [flagSource])
  const roadEnd = useMemo(() => roadEndSource.clone(true), [roadEndSource])

  return (
    <group>
      <primitive object={overhead} position={[-2, 0, -344.55]} scale={4} />
      <primitive object={leftFlag} position={[-2.32, 0, -343.7]} scale={2.1} />
      <primitive object={rightFlag} position={[2.32, 0, -343.7]} scale={2.1} rotation={[0, Math.PI, 0]} />
      <primitive object={roadEnd} position={[-2.5, 0.015, -352]} scale={5} />
      {Array.from({ length: 20 }, (_, index) => {
        const column = index % 10
        const row = Math.floor(index / 10)
        return (
          <mesh key={index} rotation={[-Math.PI / 2, 0, 0]} position={[-2.25 + column * 0.5, 0.035, -343.75 - row * 0.45]}>
            <planeGeometry args={[0.5, 0.45]} />
            <meshBasicMaterial color={(column + row) % 2 === 0 ? '#f8fafc' : '#111827'} />
          </mesh>
        )
      })}
      <TextSign title="FINISH" subtitle="" accent="#facc15" position={[0, 2.05, -343.72]} size={[2.25, 0.88]} />
      <group position={[0, 0.28, -353.4]}>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[5.4, 0.7, 0.55]} /><meshStandardMaterial color="#0f172a" emissive="#7c3aed" emissiveIntensity={0.35} /></mesh>
        <TextSign title="VICTORY" subtitle="TRACK COMPLETE" accent="#22d3ee" position={[0, 1.15, 0.3]} size={[3.4, 1.35]} />
      </group>
    </group>
  )
}

useGLTF.preload(FINISH_OVERHEAD_MODEL)
useGLTF.preload(FINISH_FLAG_MODEL)
useGLTF.preload(FINISH_ROAD_END_MODEL)

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
  const [bossFighting, setBossFighting] = useState(false)
  const bossTriggered = useRef(false)
  const meterTriggered = useRef(false)
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

    const currentState = useGameStore.getState()
    if (!meterTriggered.current && crossedPlane(previousZ.current, currentZ, BOSS_METER_WORLD_Z)) {
      meterTriggered.current = true
      currentState.beginBossMeter()
      previousZ.current = currentZ
      return
    }

    if (currentState.runStage === 'meter') {
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
      setBossFighting(true)
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
          setBossFighting(false)
          state.defeatBoss(controller?.getAliveCount() ?? state.crowdSize)
          audioManager.playBossDefeat()
        } else if (!controller || controller.getAliveCount() <= 0) {
          fight.current.active = false
          setBossFighting(false)
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
      if (conversion.current.elapsed >= 0.045) {
        conversion.current.elapsed -= 0.045
        conversion.current.strike += 1
        const controller = crowdControllerRef.current
        const alive = controller?.getAliveCount() ?? 0
        const isFinalTier = conversion.current.tierIndex === MULTIPLIER_TIERS.length - 1
        const batch = isFinalTier && alive > 60 ? 6
          : isFinalTier && alive > 30 ? 4
            : isFinalTier && alive > 15 ? 3
              : isFinalTier ? 2 : 1
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
        <BossCharacter defeated={bossDefeated} fighting={bossFighting} />
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
      <FinishZone />
    </>
  )
}
