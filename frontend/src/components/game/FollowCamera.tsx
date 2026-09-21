/**
 * FollowCamera – Smoothly follows the crowd runner for portrait-mobile play.
 *
 * Tuned for a 9:16 portrait phone shell:
 *  - Camera is LOW (Y=3.2) so the road fills the bottom half of frame
 *  - Camera is CLOSE (6 units behind) so the crowd is large on screen
 *  - Look-ahead is generous (10 units) so the next gate is always visible
 *  - FOV is handled by the Canvas camera prop (set to 65 in GameScene)
 *
 * Uses useThree() to mutate the live camera each frame — R3F idiomatic
 * approach that doesn't conflict with the Canvas camera prop on the first frame.
 */
import { useRef }    from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE    from 'three'

const CAM_HEIGHT = 3.2    // Y above track — low angle shows road and sky nicely
const CAM_BEHIND = 6.0    // Z units behind the crowd anchor
const LOOK_AHEAD = 10.0   // how far ahead of the crowd the camera looks
const LERP_X     = 7.0    // lateral follow tightness (exponential)
const LERP_YZ    = 5.0    // depth/height follow (slightly looser)

interface FollowCameraProps {
  crowdXRef: React.RefObject<number>
  crowdZRef: React.RefObject<number>
  crowdDepthRef: React.RefObject<number>
  cameraShakeRef: React.MutableRefObject<number>
}

export function FollowCamera({ crowdXRef, crowdZRef, crowdDepthRef, cameraShakeRef }: FollowCameraProps) {
  const { camera } = useThree()
  const target  = useRef(new THREE.Vector3())
  const lookAt  = useRef(new THREE.Vector3())

  useFrame((_, dt) => {
    const cx = crowdXRef.current
    const cz = crowdZRef.current
    const depth = Math.max(0, crowdDepthRef.current)
    const shake = cameraShakeRef.current
    cameraShakeRef.current = Math.max(0, shake - dt * 2.8)
    const now = performance.now()
    const shakeX = shake > 0 ? Math.sin(now * 0.075) * shake * 0.2 : 0
    const shakeY = shake > 0 ? Math.cos(now * 0.093) * shake * 0.13 : 0

    // Desired camera world position
    target.current.set(
      cx + shakeX,
      CAM_HEIGHT + Math.min(3.2, depth * 0.28) + shakeY,
      cz + CAM_BEHIND + Math.min(6.5, depth * 0.72),
    )

    // Lateral follow — tight so steering feels responsive
    const kx = 1 - Math.pow(0.001, dt * LERP_X)
    camera.position.x += (target.current.x - camera.position.x) * kx

    // Height + depth follow — slightly smoother
    const kyz = 1 - Math.pow(0.001, dt * LERP_YZ)
    camera.position.y += (target.current.y - camera.position.y) * kyz
    camera.position.z += (target.current.z - camera.position.z) * kyz

    // Look ahead of the crowd — sees the incoming gate clearly
    lookAt.current.set(cx * 0.6, 0.6, cz - LOOK_AHEAD)
    camera.lookAt(lookAt.current)

    if ('fov' in camera) {
      const perspective = camera as THREE.PerspectiveCamera
      const desiredFov = 68 + Math.min(7, depth * 0.42)
      const nextFov = THREE.MathUtils.damp(perspective.fov, desiredFov, 4, dt)
      if (Math.abs(nextFov - perspective.fov) > 0.01) {
        perspective.fov = nextFov
        perspective.updateProjectionMatrix()
      }
    }
  })

  return null
}
