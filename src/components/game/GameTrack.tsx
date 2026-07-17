/**
 * GameTrack – Infinite scrolling runway for the gameplay scene.
 *
 * Strategy: Three long track tiles arranged end-to-end.
 * As the crowd moves forward (−Z direction in world space),
 * the tile that has passed behind the camera is recycled ahead
 * of the leading tile, creating a seamless infinite loop.
 *
 * World convention:
 *   - Forward  = −Z
 *   - Right    = +X
 *   - Up       = +Y
 *   - Track surface at Y = 0
 *   - Track width = TRACK_WIDTH (5 units, matching home screen road)
 *
 * Props:
 *   crowdZ – the crowd's current world Z, used to drive tile recycling.
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group }    from 'three'

// ── Constants ──────────────────────────────────────────────────────────────
export const TRACK_WIDTH     = 5.0   // total drivable width
export const TRACK_HALF      = TRACK_WIDTH / 2 - 0.35  // usable half-width (keeps crowd off rails)
const TILE_LENGTH   = 60   // length of each tile segment
const NUM_TILES     = 3    // tiles in the pool

// Dash mark Z positions within a tile (local)
const DASH_ZS = [-22, -14, -6, 2, 10, 18]

export interface TrackTheme {
  road: string
  shoulder: string
  rail: string
  dash: string
}

// ── Track tile ─────────────────────────────────────────────────────────────
function TrackTile({ posZ, theme }: { posZ: number; theme: TrackTheme }) {
  return (
    <group position={[0, 0, posZ]}>
      {/* Main road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[TRACK_WIDTH, TILE_LENGTH]} />
        <meshStandardMaterial
          color={theme.road}
          roughness={0.60}
          metalness={0.18}
        />
      </mesh>

      {/* Centre dashes */}
      {DASH_ZS.map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]}>
          <planeGeometry args={[0.15, 3.0]} />
          <meshStandardMaterial color={theme.dash} opacity={0.2} transparent />
        </mesh>
      ))}

      {/* Gold edge rails */}
      {([-2.57, 2.57] as const).map((x) => (
        <mesh key={x} position={[x, 0.04, 0]}>
          <boxGeometry args={[0.10, 0.06, TILE_LENGTH]} />
          <meshStandardMaterial
            color={theme.rail}
            emissive={theme.rail}
            emissiveIntensity={0.85}
            roughness={0.04}
            metalness={1}
          />
        </mesh>
      ))}

      {/* Shoulder pads */}
      {([-3.75, 3.75] as const).map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, 0]} receiveShadow>
          <planeGeometry args={[2.5, TILE_LENGTH]} />
          <meshStandardMaterial color={theme.shoulder} roughness={0.85} metalness={0.05} />
        </mesh>
      ))}
    </group>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
interface GameTrackProps {
  crowdZRef: React.RefObject<number>
  theme: TrackTheme
}

export function GameTrack({ crowdZRef, theme }: GameTrackProps) {
  // Each tile stores its own Z offset (world position)
  const tilesRef = useRef<number[]>(
    Array.from({ length: NUM_TILES }, (_, i) => -i * TILE_LENGTH)
  )
  const groupRefs = useRef<(Group | null)[]>(Array(NUM_TILES).fill(null))

  useFrame(() => {
    const crowdZ = crowdZRef.current
    const tiles  = tilesRef.current

    for (let i = 0; i < NUM_TILES; i++) {
      const g = groupRefs.current[i]
      if (!g) continue

      // Recycle tile when it is more than one tile length behind the crowd
      if (tiles[i] > crowdZ + TILE_LENGTH) {
        // Find the furthest-forward tile to place this one ahead of it
        const minZ = Math.min(...tiles)
        tiles[i] = minZ - TILE_LENGTH
        g.position.z = tiles[i]
      }
    }
  })

  return (
    <group>
      {tilesRef.current.map((z, i) => (
        <group
          key={i}
          ref={(el) => { groupRefs.current[i] = el }}
          position={[0, 0, z]}
        >
          <TrackTile posZ={0} theme={theme} />
        </group>
      ))}
    </group>
  )
}
