/** Lienzo 3D en la web (WebGL del navegador). */
import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';

export function Canvas3D({ children }: { children: ReactNode }) {
  return (
    <Canvas camera={{ fov: 28, near: 0.05, far: 50 }} dpr={[1, 2]} gl={{ antialias: true }} style={{ flex: 1 }}>
      {children}
    </Canvas>
  );
}
