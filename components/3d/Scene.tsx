'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { R6Model } from '@/components/3d/R6Model';
import { Suspense } from 'react';

const GROUND_Y = -3; // matches R6Model: torso origin at y=0, leg hip at y=-1, leg length 2.

export function Scene() {
  return (
    <div className="w-full h-full bg-[#0a0a0a]">
      <Canvas
        shadows
        camera={{ position: [5, 2, 8], fov: 45 }}
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <color attach="background" args={['#0a0a0a']} />
          <ambientLight intensity={0.45} />
          <directionalLight
            position={[6, 10, 6]}
            intensity={1.1}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-camera-bottom={-8}
            shadow-camera-near={0.1}
            shadow-camera-far={40}
          />
          <directionalLight position={[-6, 4, -6]} intensity={0.3} color="#8ab4ff" />

          <R6Model />

          <Grid
            args={[30, 30]}
            position={[0, GROUND_Y, 0]}
            cellColor="#1f2937"
            sectionColor="#3b82f6"
            cellSize={1}
            sectionSize={5}
            fadeDistance={30}
            fadeStrength={1.5}
            infiniteGrid={false}
          />

          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, GROUND_Y, 0]}
            receiveShadow
          >
            <planeGeometry args={[60, 60]} />
            <shadowMaterial opacity={0.35} />
          </mesh>

          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            minDistance={4}
            maxDistance={25}
            target={[0, 0, 0]}
            maxPolarAngle={Math.PI * 0.52}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
