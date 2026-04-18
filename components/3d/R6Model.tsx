'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { R6Pose, R6PartName, Vec3 } from '@/types';
import { useAnimationStore } from '@/store/useAnimationStore';
import {
  interpolatePose,
  advanceFrame,
} from '@/components/3d/InterpolationEngine';
import { degToRad } from '@/utils/mathUtils';

// R6 proportions (Roblox stud units).
const PART_SIZES: Record<R6PartName, [number, number, number]> = {
  head: [1.2, 1.2, 1.2],
  torso: [2, 2, 1],
  leftArm: [1, 2, 1],
  rightArm: [1, 2, 1],
  leftLeg: [1, 2, 1],
  rightLeg: [1, 2, 1],
};

// Joint (pivot) positions in world space, centered around torso origin.
const JOINT_POSITIONS: Record<R6PartName, [number, number, number]> = {
  torso: [0, 0, 0],
  head: [0, 1.0, 0],
  leftArm: [-1.5, 1.0, 0],
  rightArm: [1.5, 1.0, 0],
  leftLeg: [-0.5, -1.0, 0],
  rightLeg: [0.5, -1.0, 0],
};

// Offsets from joint to mesh center so limbs hang below their joint,
// head sits above the neck, and torso stays centered.
const MESH_OFFSETS: Record<R6PartName, [number, number, number]> = {
  torso: [0, 0, 0],
  head: [0, 0.6, 0],
  leftArm: [0, -1, 0],
  rightArm: [0, -1, 0],
  leftLeg: [0, -1, 0],
  rightLeg: [0, -1, 0],
};

const PART_COLORS: Record<R6PartName, string> = {
  head: '#f5d76e',
  torso: '#2dd4bf',
  leftArm: '#f5d76e',
  rightArm: '#f5d76e',
  leftLeg: '#3b82f6',
  rightLeg: '#3b82f6',
};

interface JointProps {
  name: R6PartName;
  rotation: Vec3;
  isSelected: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}

function Joint({ name, rotation, isSelected, onSelect, children }: JointProps) {
  const [px, py, pz] = JOINT_POSITIONS[name];
  const [ox, oy, oz] = MESH_OFFSETS[name];
  const [sx, sy, sz] = PART_SIZES[name];

  return (
    <group position={[px, py, pz]} rotation={[degToRad(rotation.x), degToRad(rotation.y), degToRad(rotation.z)]}>
      <mesh
        position={[ox, oy, oz]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[sx, sy, sz]} />
        <meshStandardMaterial
          color={PART_COLORS[name]}
          emissive={isSelected ? '#3b82f6' : '#000000'}
          emissiveIntensity={isSelected ? 0.35 : 0}
          roughness={0.65}
        />
      </mesh>
      {children}
    </group>
  );
}

function Face() {
  // Face details attached to head mesh (local to head group).
  const [ox, oy, oz] = MESH_OFFSETS.head;
  const eyeY = oy + 0.1;
  const eyeZ = oz + 0.61;
  const mouthY = oy - 0.2;
  return (
    <group>
      <mesh position={[ox - 0.25, eyeY, eyeZ]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[ox + 0.25, eyeY, eyeZ]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[ox, mouthY, eyeZ]}>
        <boxGeometry args={[0.3, 0.05, 0.02]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

export interface R6ModelProps {
  pose?: R6Pose;
  interactive?: boolean;
}

export function R6Model({ pose: externalPose, interactive = true }: R6ModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const {
    keyframes,
    currentFrame,
    isPlaying,
    speed,
    loop,
    totalFrames,
    fps,
    selectedPart,
    setCurrentFrame,
    selectPart,
    pause,
  } = useAnimationStore();

  const interpolated = useMemo(
    () => interpolatePose(keyframes, currentFrame),
    [keyframes, currentFrame]
  );

  const pose = externalPose || interpolated;

  useFrame((_, delta) => {
    if (!isPlaying) return;
    const frameDelta = delta * fps;
    const { frame, reachedEnd } = advanceFrame(
      currentFrame,
      totalFrames,
      speed,
      loop,
      frameDelta
    );
    setCurrentFrame(frame);
    if (reachedEnd && !loop) {
      pause();
    }
  });

  const select = (name: R6PartName) => {
    if (!interactive) return;
    selectPart(name);
  };

  // Torso position override (only torso follows the optional position field for moves like jump).
  const torsoPos = pose.torso.position || { x: 0, y: 0, z: 0 };

  return (
    <group ref={groupRef} position={[torsoPos.x, torsoPos.y, torsoPos.z]}>
      <Joint
        name="torso"
        rotation={pose.torso.rotation}
        isSelected={interactive && selectedPart === 'torso'}
        onSelect={() => select('torso')}
      >
        <Joint
          name="head"
          rotation={pose.head.rotation}
          isSelected={interactive && selectedPart === 'head'}
          onSelect={() => select('head')}
        >
          <Face />
        </Joint>
        <Joint
          name="leftArm"
          rotation={pose.leftArm.rotation}
          isSelected={interactive && selectedPart === 'leftArm'}
          onSelect={() => select('leftArm')}
        />
        <Joint
          name="rightArm"
          rotation={pose.rightArm.rotation}
          isSelected={interactive && selectedPart === 'rightArm'}
          onSelect={() => select('rightArm')}
        />
        <Joint
          name="leftLeg"
          rotation={pose.leftLeg.rotation}
          isSelected={interactive && selectedPart === 'leftLeg'}
          onSelect={() => select('leftLeg')}
        />
        <Joint
          name="rightLeg"
          rotation={pose.rightLeg.rotation}
          isSelected={interactive && selectedPart === 'rightLeg'}
          onSelect={() => select('rightLeg')}
        />
      </Joint>
    </group>
  );
}
