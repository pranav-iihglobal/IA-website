"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Procedural 3D farm scene in the IKSARVA palette — low-poly rolling field,
 * swaying crops, a warm sun, drifting seed particles and a slowly turning
 * FloraMax sachet. No downloaded models or textures: everything is generated
 * in code, so the only network cost is the three.js library itself (which is
 * lazy-loaded after first paint via next/dynamic).
 */

const COLORS = {
  soilLight: "#A9B489",
  soil: "#8A9A6E",
  stem: "#4A5A42",
  leaf: "#5E7153",
  leafLight: "#7F8F6E",
  fruit: "#C66828",
  sun: "#D47A42",
  wheat: "#CBAF8A",
  wheatDark: "#BA9470",
  cream: "#FCFCE4",
  russet: "#783E19",
};

function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(26, 16, 42, 26);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z =
        Math.sin(x * 0.55) * 0.35 +
        Math.cos(y * 0.7 + x * 0.25) * 0.3 +
        Math.sin((x + y) * 0.3) * 0.2;
      pos.setZ(i, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -1.4, -2]}
    >
      <meshStandardMaterial
        color={COLORS.soilLight}
        flatShading
        roughness={1}
      />
    </mesh>
  );
}

function Plant({
  position,
  scale = 1,
  phase = 0,
}: {
  position: [number, number, number];
  scale?: number;
  phase?: number;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.z =
        Math.sin(clock.elapsedTime * 0.9 + phase) * 0.07;
    }
  });
  return (
    <group ref={group} position={position} scale={scale}>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.035, 0.055, 1, 6]} />
        <meshStandardMaterial color={COLORS.stem} flatShading />
      </mesh>
      <mesh position={[-0.28, 0.62, 0]} rotation={[0, 0, 0.9]} scale={[1, 0.45, 0.6]}>
        <sphereGeometry args={[0.28, 8, 6]} />
        <meshStandardMaterial color={COLORS.leaf} flatShading />
      </mesh>
      <mesh position={[0.28, 0.78, 0.05]} rotation={[0, 0, -0.9]} scale={[1, 0.45, 0.6]}>
        <sphereGeometry args={[0.26, 8, 6]} />
        <meshStandardMaterial color={COLORS.leafLight} flatShading />
      </mesh>
      <mesh position={[-0.2, 0.95, -0.05]} rotation={[0, 0.6, 0.7]} scale={[1, 0.4, 0.55]}>
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshStandardMaterial color={COLORS.leafLight} flatShading />
      </mesh>
      <mesh position={[0, 1.12, 0]}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshStandardMaterial
          color={COLORS.fruit}
          flatShading
          emissive={COLORS.fruit}
          emissiveIntensity={0.25}
        />
      </mesh>
    </group>
  );
}

function WheatTuft({
  position,
  phase = 0,
}: {
  position: [number, number, number];
  phase?: number;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.z =
        Math.sin(clock.elapsedTime * 1.1 + phase) * 0.1;
    }
  });
  const stalks = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        x: (i - 2) * 0.09,
        z: ((i * 7) % 3) * 0.05 - 0.05,
        h: 0.7 + ((i * 13) % 4) * 0.08,
        lean: (i - 2) * 0.1,
      })),
    [],
  );
  return (
    <group ref={group} position={position}>
      {stalks.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, 0, s.lean]}>
          <mesh position={[0, s.h / 2, 0]}>
            <cylinderGeometry args={[0.012, 0.02, s.h, 5]} />
            <meshStandardMaterial color={COLORS.wheatDark} flatShading />
          </mesh>
          <mesh position={[0, s.h + 0.09, 0]} scale={[1, 1.9, 1]}>
            <sphereGeometry args={[0.055, 6, 5]} />
            <meshStandardMaterial color={COLORS.wheat} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Sun() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 1.4) * 0.035;
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <group position={[2.7, 3.1, -5.5]}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.85, 20, 16]} />
        <meshStandardMaterial
          color={COLORS.sun}
          emissive={COLORS.sun}
          emissiveIntensity={0.9}
          roughness={0.6}
        />
      </mesh>
      <pointLight color={COLORS.sun} intensity={22} distance={18} decay={1.6} />
    </group>
  );
}

function Seeds({ count = 42 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: ((i * 37) % 100) / 100 * 12 - 6,
        y: ((i * 53) % 100) / 100 * 4 - 0.5,
        z: ((i * 71) % 100) / 100 * 6 - 4,
        speed: 0.4 + ((i * 29) % 50) / 100,
        phase: ((i * 97) % 628) / 100,
        size: 0.035 + ((i * 41) % 30) / 1000,
      })),
    [count],
  );

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      dummy.position.set(
        s.x + Math.sin(t * s.speed + s.phase) * 0.6,
        s.y + Math.sin(t * s.speed * 0.8 + s.phase * 2) * 0.5,
        s.z,
      );
      dummy.rotation.set(t * s.speed + s.phase, s.phase, 0);
      dummy.scale.set(s.size * 1.6, s.size, s.size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 5]} />
      <meshStandardMaterial color={COLORS.wheat} flatShading />
    </instancedMesh>
  );
}

/** The FloraMax 25g sachet — front label drawn onto a canvas texture. */
function Sachet() {
  const group = useRef<THREE.Group>(null);

  const labelTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 340;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = COLORS.cream;
      ctx.fillRect(0, 0, 256, 340);
      ctx.fillStyle = COLORS.fruit;
      ctx.fillRect(0, 0, 256, 44);
      // flower mark
      ctx.fillStyle = COLORS.fruit;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
          128 + Math.cos(a) * 30,
          130 + Math.sin(a) * 30,
          20,
          12,
          a,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = "#F9ECC9";
      ctx.beginPath();
      ctx.arc(128, 130, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.russet;
      ctx.font = "bold 40px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("FloraMax", 128, 235);
      ctx.font = "24px Georgia, serif";
      ctx.fillText("25g · 1 acre", 128, 275);
      ctx.font = "16px Georgia, serif";
      ctx.fillStyle = COLORS.leaf;
      ctx.fillText("flowering bio-stimulant", 128, 305);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({
      color: COLORS.leaf,
      roughness: 0.6,
    });
    const front = new THREE.MeshStandardMaterial({
      map: labelTexture,
      roughness: 0.55,
    });
    // order: +x, -x, +y, -y, +z (front), -z (back)
    return [side, side, side, side, front, side];
  }, [labelTexture]);

  useFrame(({ clock }) => {
    if (group.current) {
      const t = clock.elapsedTime;
      group.current.rotation.y = Math.sin(t * 0.5) * 0.55 + 0.15;
      group.current.position.y = 0.65 + Math.sin(t * 1.2) * 0.12;
    }
  });

  return (
    <group ref={group} position={[1.35, 0.65, 0.9]} rotation={[0.04, 0, 0.03]}>
      <mesh material={materials}>
        <boxGeometry args={[1.5, 2, 0.35]} />
      </mesh>
      {/* crimped sachet top */}
      <mesh position={[0, 1.08, 0]}>
        <boxGeometry args={[1.56, 0.16, 0.12]} />
        <meshStandardMaterial color={COLORS.stem} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Mouse parallax: the whole scene leans gently toward the cursor. */
function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ pointer }) => {
    if (group.current) {
      group.current.rotation.y +=
        (pointer.x * 0.14 - group.current.rotation.y) * 0.05;
      group.current.rotation.x +=
        (-pointer.y * 0.06 - group.current.rotation.x) * 0.05;
    }
  });
  return <group ref={group}>{children}</group>;
}

export default function Hero3DScene() {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <Canvas
      camera={{ position: [0, 1.15, 8.8], fov: 42 }}
      dpr={[1, 1.75]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ antialias: true, alpha: true }}
      aria-label="Animated 3D farm scene with crops, seeds and a FloraMax sachet"
      role="img"
    >
      <ambientLight intensity={0.85} color="#FFFDF0" />
      <directionalLight position={[4, 6, 3]} intensity={1.4} color="#FFF2DC" />
      <Rig>
        <Terrain />
        <Sun />
        <Plant position={[-2.3, -0.75, 0.4]} scale={1.25} phase={0.5} />
        <Plant position={[-0.9, -0.9, 1.2]} scale={0.95} phase={2.1} />
        <Plant position={[-0.1, -0.85, 0.1]} scale={1.1} phase={3.6} />
        <WheatTuft position={[-4.2, -1, -0.6]} phase={1.2} />
        <WheatTuft position={[-1.9, -1, -1.4]} phase={2.8} />
        <WheatTuft position={[1.6, -1, -1.1]} phase={0.2} />
        <WheatTuft position={[3.9, -1.05, -0.4]} phase={4.1} />
        <Seeds />
        <Sachet />
      </Rig>
    </Canvas>
  );
}
