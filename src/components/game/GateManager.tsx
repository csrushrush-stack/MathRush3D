import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../store/useGameStore'
import { audioManager } from '../../utils/audioManager'
import { crossedPlane } from '../../utils/gameBalance'
import { applyGateOption, type GateOption, type GatePairData } from '../../utils/mathGates'

const GATE_WIDTH = 2.1
const GATE_HEIGHT = 2.7
const GATE_CENTER_X = 1.22
const PANEL_DEPTH = 0.16

interface GatePairState extends GatePairData {
  triggered: boolean
}

function createGateTexture(option: GateOption, gateNumber: number, accent: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 192
  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(3, 18, 48, 0.72)'
  context.fillRect(8, 8, canvas.width - 16, canvas.height - 16)
  context.strokeStyle = accent
  context.lineWidth = 8
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16)
  const operationStyle = option.operation === 'add'
    ? { label: 'ADD THE ANSWER', symbol: '+', color: '#4ade80' }
    : option.operation === 'divide'
      ? { label: 'DIVIDE BY ANSWER', symbol: '÷', color: '#f472b6' }
      : option.operation === 'multiply'
        ? { label: 'MULTIPLY BY ANSWER', symbol: '×', color: '#c084fc' }
        : { label: 'SUBTRACT ANSWER', symbol: '−', color: '#fb7185' }

  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.shadowColor = operationStyle.color
  context.shadowBlur = 16
  context.beginPath()
  context.arc(58, 111, 35, 0, Math.PI * 2)
  context.fillStyle = `${operationStyle.color}33`
  context.fill()
  context.lineWidth = 6
  context.strokeStyle = operationStyle.color
  context.stroke()
  context.fillStyle = '#ffffff'
  context.font = '900 54px Nunito, Arial, sans-serif'
  context.fillText(operationStyle.symbol, 58, 108)
  context.textAlign = 'center'
  context.font = '900 60px Nunito, Arial, sans-serif'
  context.fillText(option.expr, 232, 111)
  context.shadowBlur = 0
  context.textAlign = 'center'
  context.fillStyle = operationStyle.color
  context.font = '900 19px Nunito, Arial, sans-serif'
  context.fillText(`${operationStyle.label} · GATE ${gateNumber}`, canvas.width / 2, 34)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  return texture
}

function GatePanel({
  side,
  option,
  gateNumber,
}: {
  side: 'left' | 'right'
  option: GateOption
  gateNumber: number
}) {
  const centerX = side === 'left' ? -GATE_CENTER_X : GATE_CENTER_X
  const accent = side === 'left' ? '#818cf8' : '#22d3ee'
  const texture = useMemo(
    () => createGateTexture(option, gateNumber, accent),
    [accent, gateNumber, option],
  )

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <group position={[centerX, GATE_HEIGHT / 2, 0]}>
      <mesh>
        <boxGeometry args={[GATE_WIDTH, GATE_HEIGHT, PANEL_DEPTH]} />
        <meshStandardMaterial
          color="#0c4a6e"
          emissive={accent}
          emissiveIntensity={0.22}
          roughness={0.22}
          metalness={0.35}
          transparent
          opacity={0.66}
        />
      </mesh>
      <mesh position={[0, 0, PANEL_DEPTH / 2 + 0.012]}>
        <planeGeometry args={[1.82, 0.92]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
      {[
        [0, GATE_HEIGHT / 2, GATE_WIDTH + 0.18, 0.13],
        [0, -GATE_HEIGHT / 2, GATE_WIDTH + 0.18, 0.13],
        [-GATE_WIDTH / 2, 0, 0.13, GATE_HEIGHT],
        [GATE_WIDTH / 2, 0, 0.13, GATE_HEIGHT],
      ].map(([x, y, width, height], index) => (
        <mesh key={index} position={[x, y, 0.02]} castShadow>
          <boxGeometry args={[width, height, PANEL_DEPTH + 0.08]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={0.7}
            roughness={0.2}
            metalness={0.75}
          />
        </mesh>
      ))}
    </group>
  )
}

const GatePair = memo(function GatePair({ pair }: { pair: GatePairState }) {
  const groupRef = useRef<THREE.Group>(null)
  const scaleRef = useRef(1)

  useFrame((_, delta) => {
    if (!pair.triggered || !groupRef.current) return
    scaleRef.current = Math.max(0, scaleRef.current - Math.min(delta, 0.05) * 5.5)
    groupRef.current.scale.setScalar(scaleRef.current)
    groupRef.current.rotation.y += delta * 1.8
    groupRef.current.visible = scaleRef.current > 0.01
  })

  return (
    <group ref={groupRef} position={[0, 0, pair.worldZ]}>
      <GatePanel side="left" option={pair.left} gateNumber={pair.id + 1} />
      <GatePanel side="right" option={pair.right} gateNumber={pair.id + 1} />
      <mesh position={[0, GATE_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[0.34, GATE_HEIGHT + 0.22, 0.34]} />
        <meshStandardMaterial
          color="#e0f2fe"
          emissive="#38bdf8"
          emissiveIntensity={0.5}
          roughness={0.18}
          metalness={0.85}
        />
      </mesh>
    </group>
  )
})

interface GateManagerProps {
  pairs: GatePairData[]
  crowdXRef: React.RefObject<number>
  crowdZRef: React.RefObject<number>
  isPaused: boolean
}

export function GateManager({ pairs: sourcePairs, crowdXRef, crowdZRef, isPaused }: GateManagerProps) {
  const [pairs, setPairs] = useState<GatePairState[]>(
    () => sourcePairs.map((pair) => ({ ...pair, triggered: false })),
  )
  const processed = useRef(new Set<number>())
  const previousZ = useRef(0)

  useFrame(() => {
    const currentZ = crowdZRef.current
    if (isPaused) {
      previousZ.current = currentZ
      return
    }

    for (const pair of sourcePairs) {
      if (processed.current.has(pair.id)) continue
      if (!crossedPlane(previousZ.current, currentZ, pair.worldZ)) continue

      processed.current.add(pair.id)
      const chosenSide = crowdXRef.current < 0 ? 'left' : 'right'
      const chosen = chosenSide === 'left' ? pair.left : pair.right
      const state = useGameStore.getState()
      const crowdBefore = state.crowdSize
      const crowdAfter = applyGateOption(crowdBefore, chosen)
      const leftResult = applyGateOption(crowdBefore, pair.left)
      const rightResult = applyGateOption(crowdBefore, pair.right)

      state.setCrowdSize(crowdAfter)
      state.recordGateChoice({
        gateIndex: pair.id,
        worldZ: pair.worldZ,
        leftExpression: pair.left.expr,
        rightExpression: pair.right.expr,
        chosenSide,
        chosenDelta: crowdAfter - crowdBefore,
        optimalDelta: Math.max(leftResult, rightResult) - crowdBefore,
        crowdBefore,
        crowdAfter,
      })
      setPairs((current) => current.map((item) => (
        item.id === pair.id ? { ...item, triggered: true } : item
      )))
      audioManager.playGateHit()
    }

    previousZ.current = currentZ
  })

  return <>{pairs.map((pair) => <GatePair key={pair.id} pair={pair} />)}</>
}
