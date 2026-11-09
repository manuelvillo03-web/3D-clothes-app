/** Lienzo 3D en iOS y Android (expo-gl). */
import { Canvas } from '@react-three/fiber/native';
import type { ReactNode } from 'react';

export function Canvas3D({ children }: { children: ReactNode }) {
  return (
    <Canvas camera={{ fov: 28, near: 0.05, far: 50 }} style={{ flex: 1 }}>
      {children}
    </Canvas>
  );
}
