'use client';

import { forwardRef, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { R6Pose, R6PartName, Vec3 } from '@/types';
import { useAnimationStore } from '@/store/useAnimationStore';
import {
  interpolatePose,
  advanceFrame,
} from '@/components/3d/InterpolationEngine';
import { degToRad, radToDeg } from '@/utils/mathUtils';

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

const Joint = forwardRef<THREE.Group, JointProps>(function Joint(
  { name, rotation, isSelected, onSelect, children },
  ref
) {
  const [px, py, pz] = JOINT_POSITIONS[name];
  const [ox, oy, oz] = MESH_OFFSETS[name];
  const [sx, sy, sz] = PART_SIZES[name];

  return (
    <group
      ref={ref}
      position={[px, py, pz]}
      rotation={[
        degToRad(rotation.x),
        degToRad(rotation.y),
        degToRad(rotation.z),
      ]}
    >
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
});

function Face() {
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
  const rigRootRef = useRef<THREE.Group>(null);
  const jointRefs = {
    head: useRef<THREE.Group>(null),
    torso: useRef<THREE.Group>(null),
    leftArm: useRef<THREE.Group>(null),
    rightArm: useRef<THREE.Group>(null),
    leftLeg: useRef<THREE.Group>(null),
    rightLeg: useRef<THREE.Group>(null),
  } as Record<R6PartName, React.RefObject<THREE.Group>>;

  const {
    keyframes,
    currentFrame,
    isPlaying,
    speed,
    loop,
    totalFrames,
    fps,
    selectedPart,
    gizmoMode,
    setCurrentFrame,
    selectPart,
    pause,
    updatePartRotation,
    updatePartPosition,
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

  const torsoPos = pose.torso.position || { x: 0, y: 0, z: 0 };

  // Gizmo target: when translating the torso, drive the outer rig root
  // (which holds torso.position). For every other case use the joint group
  // so rotation pivots at the shoulder/hip/neck.
  const gizmoTarget =
    interactive && !isPlaying && selectedPart
      ? gizmoMode === 'translate' && selectedPart === 'torso'
        ? rigRootRef.current
        : gizmoMode === 'rotate'
          ? jointRefs[selectedPart].current
          : null
      : null;

  const handleGizmoChange = () => {
    if (!selectedPart) return;
    const frame = Math.round(currentFrame);
    if (gizmoMode === 'rotate') {
      const obj = jointRefs[selectedPart].current;
      if (!obj) return;
      updatePartRotation(frame, selectedPart, {
        x: radToDeg(obj.rotation.x),
        y: radToDeg(obj.rotation.y),
        z: radToDeg(obj.rotation.z),
      });
    } else if (gizmoMode === 'translate' && selectedPart === 'torso') {
      const obj = rigRootRef.current;
      if (!obj) return;
      updatePartPosition(frame, 'torso', {
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z,
      });
    }
  };

  return (
    <>
      <group ref={rigRootRef} position={[torsoPos.x, torsoPos.y, torsoPos.z]}>
        <Joint
          ref={jointRefs.torso}
          name="torso"
          rotation={pose.torso.rotation}
          isSelected={interactive && selectedPart === 'torso'}
          onSelect={() => select('torso')}
        >
          <Joint
            ref={jointRefs.head}
            name="head"
            rotation={pose.head.rotation}
            isSelected={interactive && selectedPart === 'head'}
            onSelect={() => select('head')}
          >
            <Face />
          </Joint>
          <Joint
            ref={jointRefs.leftArm}
            name="leftArm"
            rotation={pose.leftArm.rotation}
            isSelected={interactive && selectedPart === 'leftArm'}
            onSelect={() => select('leftArm')}
          />
          <Joint
            ref={jointRefs.rightArm}
            name="rightArm"
            rotation={pose.rightArm.rotation}
            isSelected={interactive && selectedPart === 'rightArm'}
            onSelect={() => select('rightArm')}
          />
          <Joint
            ref={jointRefs.leftLeg}
            name="leftLeg"
            rotation={pose.leftLeg.rotation}
            isSelected={interactive && selectedPart === 'leftLeg'}
            onSelect={() => select('leftLeg')}
          />
          <Joint
            ref={jointRefs.rightLeg}
            name="rightLeg"
            rotation={pose.rightLeg.rotation}
            isSelected={interactive && selectedPart === 'rightLeg'}
            onSelect={() => select('rightLeg')}
          />
        </Joint>
      </group>

      {gizmoTarget && (
        <TransformControls
          object={gizmoTarget}
          mode={gizmoMode}
          size={0.8}
          onObjectChange={handleGizmoChange}
        />
      )}
    </>
  );
}
