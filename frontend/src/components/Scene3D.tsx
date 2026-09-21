import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment } from '@react-three/drei'
import { Suspense } from 'react'

/**
 * Ground plane using Drei's Grid helper
 */
function Ground() {
  return (
    <Grid
      position={[0, 0, 0]}
      args={[30, 30]}
      cellSize={1}
      cellThickness={0.5}
      cellColor="#1e40af"
      sectionSize={5}
      sectionThickness={1}
      sectionColor="#3b82f6"
      fadeDistance={40}
      fadeStrength={1}
      infiniteGrid
    />
  )
}

/**
 * Placeholder cube sitting on the ground
 */
function PlaceholderObject() {
  return (
    <mesh position={[0, 0.5, 0]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#6366f1" roughness={0.3} metalness={0.4} />
    </mesh>
  )
}

/**
 * Basic 3D scene: camera, lights, ground, placeholder object
 */
export function Scene3D() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 8, 14], fov: 50, near: 0.1, far: 200 }}
      className="w-full h-full"
    >
      <Suspense fallback={null}>
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <pointLight position={[-5, 8, -5]} intensity={0.6} color="#a5b4fc" />

        {/* Environment */}
        <Environment preset="city" />

        {/* Scene objects */}
        <Ground />
        <PlaceholderObject />

        {/* Camera controls – orbit while developing */}
        <OrbitControls
          enablePan={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.5}
          minDistance={6}
          maxDistance={30}
        />
      </Suspense>
    </Canvas>
  )
}
