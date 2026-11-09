/**
 * Visor del maniquí (y de la prenda aproximada encima).
 * Se gira arrastrando en horizontal; el desplazamiento vertical sigue
 * moviendo la pantalla.
 */
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import type { BodyModelData } from '../core/bodyModel';
import type { Shell } from '../core/garmentShell';
import { color, font, radius, space } from '../lib/theme';
import { Canvas3D } from './Canvas3D';

const VIEWS = [
  { label: 'Frente', yaw: 0 },
  { label: 'Perfil', yaw: Math.PI / 2 },
  { label: 'Espalda', yaw: Math.PI },
];

function indexAttr(index: Uint32Array, vertexCount: number) {
  return vertexCount < 65536 ? new THREE.BufferAttribute(Uint16Array.from(index), 1) : new THREE.BufferAttribute(index, 1);
}

function CameraRig({ height }: { height: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, height * 0.56, height * 2.55);
    camera.lookAt(0, height * 0.5, 0);
    camera.updateProjectionMatrix();
  }, [camera, height]);
  return null;
}

function Scene({ model, vertices, shell, yaw, bodyHeight }: {
  model: BodyModelData; vertices: Float32Array; shell: Shell | null; yaw: number; bodyHeight: number;
}) {
  const body = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    g.setIndex(indexAttr(model.faces, model.vertexCount));
    g.computeVertexNormals();
    return g;
  }, [model, vertices]);

  const cloth = useMemo(() => {
    if (!shell || shell.index.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(shell.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(shell.colors, 3));
    g.setIndex(indexAttr(shell.index, model.vertexCount));
    g.computeVertexNormals();
    return g;
  }, [model, shell]);

  useEffect(() => () => body.dispose(), [body]);
  useEffect(() => () => cloth?.dispose(), [cloth]);

  return (
    <>
      <CameraRig height={bodyHeight} />
      <hemisphereLight args={['#ffffff', '#cdbfae', 0.7]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.7} />
      <directionalLight position={[-3, 2, -2.5]} intensity={0.6} />
      {/* El modelo mira hacia −Z: media vuelta para que «Frente» lo enseñe de frente. */}
      <group rotation={[0, yaw + Math.PI, 0]}>
        <mesh geometry={body}>
          <meshStandardMaterial color={color.skin} roughness={0.7} metalness={0} />
        </mesh>
        {cloth && (
          <mesh geometry={cloth}>
            <meshStandardMaterial vertexColors transparent opacity={0.9} roughness={0.85} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <circleGeometry args={[0.45, 48]} />
        <meshStandardMaterial color="#DDD3C5" roughness={1} />
      </mesh>
    </>
  );
}

export function BodyViewer({ model, vertices, shell = null, height = 420, bodyHeight }: {
  model: BodyModelData;
  vertices: Float32Array;
  shell?: Shell | null;
  height?: number;
  /** Altura del cuerpo en metros (encuadre). */
  bodyHeight: number;
}) {
  const [yaw, setYaw] = useState(0);
  // El ángulo vive en el cierre de los gestos: el render solo lee el estado.
  const [gesture] = useState(() => {
    let current = 0;
    let start = 0;
    const turnTo = (v: number) => {
      current = v;
      setYaw(v);
    };
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // En captura: el lienzo 3D de iOS/Android reclama los toques para sí y,
      // sin esto, el arrastre horizontal no llegaría a girar el maniquí.
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        start = current;
      },
      onPanResponderMove: (_, g) => turnTo(start + g.dx * 0.012),
      onPanResponderTerminationRequest: () => false,
    });
    return { responder, turnTo };
  });

  return (
    <View style={[styles.stage, { height }]}>
      <View style={StyleSheet.absoluteFill} {...gesture.responder.panHandlers}
        accessible accessibilityLabel="Maniquí en 3D. Arrastra en horizontal para girarlo.">
        <Canvas3D>
          <Scene model={model} vertices={vertices} shell={shell} yaw={yaw} bodyHeight={bodyHeight} />
        </Canvas3D>
      </View>
      <View style={styles.views} pointerEvents="box-none">
        {VIEWS.map((v) => (
          <Pressable key={v.label} onPress={() => gesture.turnTo(v.yaw)} style={styles.viewBtn} accessibilityRole="button">
            <Text style={styles.viewText}>{v.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: color.stage },
  views: { position: 'absolute', bottom: space.sm, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  viewBtn: {
    backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: space.md, paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1, borderColor: color.line,
  },
  viewText: { fontSize: font.small, color: color.ink, fontWeight: '600' },
});
