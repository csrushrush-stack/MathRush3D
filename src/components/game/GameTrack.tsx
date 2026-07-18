/**
 * GameTrack – A finite runway that visibly terminates after the bonus stage.
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
// ── Constants ──────────────────────────────────────────────────────────────
export const TRACK_WIDTH     = 5.0   // total drivable width
export const TRACK_HALF      = TRACK_WIDTH / 2 - 0.35  // usable half-width (keeps crowd off rails)
export const TRACK_END_Z = -352
const TRACK_START_Z = 30
const TRACK_LENGTH = TRACK_START_Z - TRACK_END_Z
const TRACK_CENTER_Z = (TRACK_START_Z + TRACK_END_Z) / 2

const DASH_ZS = Array.from({ length: Math.floor(TRACK_LENGTH / 8) }, (_, index) => TRACK_START_Z - 6 - index * 8)

export interface TrackTheme {
  road: string
  shoulder: string
  rail: string
  dash: string
}

// ── Track tile ─────────────────────────────────────────────────────────────
function TrackTile({ theme }: { theme: TrackTheme }) {
  return (
    <group>
      {/* Main road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, TRACK_CENTER_Z]} receiveShadow>
        <planeGeometry args={[TRACK_WIDTH, TRACK_LENGTH]} />
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
        <mesh key={x} position={[x, 0.04, TRACK_CENTER_Z]}>
          <boxGeometry args={[0.10, 0.06, TRACK_LENGTH]} />
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
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, TRACK_CENTER_Z]} receiveShadow>
          <planeGeometry args={[2.5, TRACK_LENGTH]} />
          <meshStandardMaterial color={theme.shoulder} roughness={0.85} metalness={0.05} />
        </mesh>
      ))}
    </group>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
interface GameTrackProps { theme: TrackTheme }

export function GameTrack({ theme }: GameTrackProps) {
  return (
    <TrackTile theme={theme} />
  )
}
