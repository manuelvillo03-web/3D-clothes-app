/**
 * El probador: el maniquí sobre un escenario añil, con la cinta métrica de
 * pared a escala a la izquierda, la prenda aproximada encima y, si se pide,
 * la cinta amarilla marcando por dónde se toma una medida.
 *
 * Se gira arrastrando en horizontal; el desplazamiento vertical sigue
 * moviendo la pantalla.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import type { Marker } from '../core/bodyMarkers';
import type { BodyModelData } from '../core/bodyModel';
import type { Shell } from '../core/garmentShell';
import { color, family, radius, space } from '../lib/theme';
import { Canvas3D } from './Canvas3D';

const VIEWS = [
  { label: 'Frente', yaw: 0 },
  { label: 'Perfil', yaw: Math.PI / 2 },
  { label: 'Espalda', yaw: Math.PI },
];

// Encuadre: el cuerpo queda algo alto para dejar sitio a los botones de vista.
const FOV = 28;
const CAM_Y = 0.52;
const CAM_Z = 2.78;
const LOOK_Y = 0.455;

/**
 * Posición vertical en pantalla (0 arriba, 1 abajo) de una altura `y` (m) en
 * el plano del maniquí, para un cuerpo de altura `h` (m). Es la misma
 * proyección que hace la cámara, así la cinta de pared queda a escala.
 */
export function screenY(y: number, h: number): number {
  const fy = (LOOK_Y - CAM_Y) * h;
  const fz = -CAM_Z * h;
  const len = Math.hypot(fy, fz);
  const dy = y - CAM_Y * h;
  const depth = (dy * fy + CAM_Z * h * CAM_Z * h) / len;
  const up = (dy * -fz + -CAM_Z * h * fy) / len;
  return 0.5 * (1 - up / (depth * Math.tan((FOV / 2) * (Math.PI / 180))));
}

function indexAttr(index: Uint32Array, vertexCount: number) {
  return vertexCount < 65536 ? new THREE.BufferAttribute(Uint16Array.from(index), 1) : new THREE.BufferAttribute(index, 1);
}

function CameraRig({ height }: { height: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, height * CAM_Y, height * CAM_Z);
    camera.lookAt(0, height * LOOK_Y, 0);
    camera.updateProjectionMatrix();
  }, [camera, height]);
  return null;
}

/** Geometría de la cinta: una banda alrededor del contorno o un cordón a lo largo. */
function tapeGeometry(marker: Marker): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos: number[] = [];
  const idx: number[] = [];
  if (marker.kind === 'ring') {
    const pts = marker.points;
    const c = [0, 0, 0];
    for (const p of pts) {
      c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length;
    }
    const n = marker.normal;
    const half = 0.011;
    const out = 0.006;
    pts.forEach((p, i) => {
      let d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      const along = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
      d = [d[0] - along * n[0], d[1] - along * n[1], d[2] - along * n[2]];
      const l = Math.hypot(d[0], d[1], d[2]) || 1;
      const q = [p[0] + (d[0] / l) * out, p[1] + (d[1] / l) * out, p[2] + (d[2] / l) * out];
      pos.push(q[0] - n[0] * half, q[1] - n[1] * half, q[2] - n[2] * half, q[0] + n[0] * half, q[1] + n[1] * half, q[2] + n[2] * half);
      const a = i * 2;
      const b = ((i + 1) % pts.length) * 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    });
  } else {
    // Cordón de sección cuadrada entre cada par de puntos.
    const r = 0.006;
    for (let s = 0; s + 1 < marker.points.length; s++) {
      const a = new THREE.Vector3(...marker.points[s]);
      const b = new THREE.Vector3(...marker.points[s + 1]);
      const dir = b.clone().sub(a).normalize();
      const u = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const w = new THREE.Vector3().crossVectors(dir, u);
      const base = pos.length / 3;
      for (const end of [a, b]) {
        for (const [su, sw] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
          const p = end.clone().addScaledVector(u, su * r).addScaledVector(w, sw * r);
          pos.push(p.x, p.y, p.z);
        }
      }
      for (let k = 0; k < 4; k++) {
        const k2 = (k + 1) % 4;
        idx.push(base + k, base + k2, base + 4 + k, base + 4 + k, base + k2, base + 4 + k2);
      }
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function Scene({ model, vertices, shell, marker, yaw, spin, bodyHeight }: {
  model: BodyModelData; vertices: Float32Array; shell: Shell | null; marker: Marker | null;
  yaw: number; spin: boolean; bodyHeight: number;
}) {
  const group = useRef<THREE.Group>(null);
  const turn = useRef({ shown: yaw, extra: 0 });

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

  const tape = useMemo(() => (marker ? tapeGeometry(marker) : null), [marker]);

  useEffect(() => () => body.dispose(), [body]);
  useEffect(() => () => cloth?.dispose(), [cloth]);
  useEffect(() => () => tape?.dispose(), [tape]);

  useFrame((_, dt) => {
    const t = turn.current;
    if (spin) t.extra += dt * 0.45;
    t.shown += (yaw - t.shown) * Math.min(1, dt * 12);
    // El modelo mira hacia −Z: media vuelta para que «Frente» lo enseñe de frente.
    if (group.current) group.current.rotation.y = t.shown + t.extra + Math.PI;
  });

  return (
    <>
      <CameraRig height={bodyHeight} />
      <hemisphereLight args={['#ffffff', '#5a61a8', 0.85]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
      <directionalLight position={[-3, 2, -2.5]} intensity={0.7} color="#aab4ff" />
      <group ref={group}>
        <mesh geometry={body}>
          <meshStandardMaterial color={color.mannequin} roughness={0.62} metalness={0.02} />
        </mesh>
        {cloth && (
          <mesh geometry={cloth}>
            <meshStandardMaterial vertexColors transparent opacity={0.93} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        )}
        {tape && (
          <mesh geometry={tape} renderOrder={2}>
            <meshBasicMaterial color={color.tape} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.003, 0]}>
        <circleGeometry args={[0.52 * (bodyHeight / 1.7), 56]} />
        <meshBasicMaterial color={color.indigoDeep} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <ringGeometry args={[0.5 * (bodyHeight / 1.7), 0.52 * (bodyHeight / 1.7), 56]} />
        <meshBasicMaterial color={color.tape} />
      </mesh>
    </>
  );
}

/** Cinta métrica de pared, a escala con el maniquí. */
function WallTape({ stageHeight, bodyHeight }: { stageHeight: number; bodyHeight: number }) {
  const topCm = Math.round(bodyHeight * 100);
  const floor = screenY(0, bodyHeight) * stageHeight;
  const ticks: ReactNode[] = [];
  for (let cm = 0; cm <= 230; cm += 5) {
    const y = screenY(cm / 100, bodyHeight) * stageHeight;
    if (y < 12) break;
    const ten = cm % 10 === 0;
    ticks.push(
      <View key={cm} style={[styles.tick, { top: y - 0.75, width: ten ? 12 : 7 }]} />,
      ten && cm > 0 && y > 22 ? <Text key={`n${cm}`} style={[styles.tickText, { top: y - 6.5 }]}>{cm}</Text> : null,
    );
  }
  const head = screenY(bodyHeight, bodyHeight) * stageHeight;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.tape, { height: floor }]}>{ticks}</View>
      <View style={[styles.headLine, { top: head }]} />
      <View style={[styles.flag, { top: head - 13 }]}>
        <Text style={styles.flagText}>{topCm}</Text>
        <Text style={styles.flagUnit}>cm</Text>
      </View>
    </View>
  );
}

export function BodyViewer({
  model, vertices, shell = null, marker = null, height = 420, bodyHeight, spin = false, controls = true,
  ruler = true, caption, children, flat,
}: {
  model: BodyModelData;
  vertices: Float32Array;
  shell?: Shell | null;
  /** Cinta amarilla sobre el maniquí (por dónde se toma una medida). */
  marker?: Marker | null;
  height?: number;
  /** Altura del cuerpo en metros (encuadre y escala de la cinta de pared). */
  bodyHeight: number;
  /** Gira solo hasta que el usuario lo toca. */
  spin?: boolean;
  controls?: boolean;
  ruler?: boolean;
  /** Texto corto sobre el escenario (la medida que se está tomando). */
  caption?: ReactNode;
  /** Elementos superpuestos (etiquetas, leyenda). */
  children?: ReactNode;
  /** Sin esquinas redondeadas (escenario a sangre). */
  flat?: boolean;
}) {
  const [yaw, setYaw] = useState(0);
  const [touched, setTouched] = useState(false);
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setCalm(v)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // El ángulo vive en el cierre de los gestos: el render solo lee el estado.
  const [gesture] = useState(() => {
    let current = 0;
    let start = 0;
    const turnTo = (v: number) => {
      current = v;
      setYaw(v);
      setTouched(true);
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

  const active = VIEWS.findIndex((v) => Math.abs(((yaw - v.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.2);

  return (
    <View style={[styles.stage, { height }, flat && { borderRadius: 0 }]}>
      <View style={[styles.spot, { width: height * 0.9, height: height * 0.9, borderRadius: height, top: height * 0.02 }]} />
      <View style={StyleSheet.absoluteFill} {...gesture.responder.panHandlers}
        accessible accessibilityLabel="Maniquí en 3D. Arrastra en horizontal para girarlo.">
        <Canvas3D>
          <Scene model={model} vertices={vertices} shell={shell} marker={marker} yaw={yaw}
            spin={spin && !touched && !calm} bodyHeight={bodyHeight} />
        </Canvas3D>
      </View>
      {ruler ? <WallTape stageHeight={height} bodyHeight={bodyHeight} /> : null}
      {caption ? <View style={styles.caption} pointerEvents="none">{caption}</View> : null}
      {children}
      {controls ? (
        <View style={styles.views} pointerEvents="box-none">
          {VIEWS.map((v, i) => (
            <Pressable key={v.label} onPress={() => gesture.turnTo(v.yaw)} accessibilityRole="button"
              accessibilityLabel={`Ver de ${v.label.toLowerCase()}`}
              style={[styles.viewBtn, touched && i === active && styles.viewBtnOn]}>
              <Text style={[styles.viewText, touched && i === active && { color: color.tapeInk }]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Hueco del escenario mientras el maniquí se prepara. */
export function StagePlaceholder({ height = 420, children, flat }: { height?: number; children?: ReactNode; flat?: boolean }) {
  return (
    <View style={[styles.stage, { height, alignItems: 'center', justifyContent: 'center' }, flat && { borderRadius: 0 }]}>
      <View style={[styles.spot, { width: height * 0.9, height: height * 0.9, borderRadius: height, top: height * 0.02 }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%', borderRadius: radius.xl, overflow: 'hidden', backgroundColor: color.indigo },
  spot: { position: 'absolute', alignSelf: 'center', backgroundColor: '#272D6E' },
  tape: { position: 'absolute', left: 0, top: 0, width: 30, backgroundColor: color.tape, borderBottomRightRadius: 3 },
  tick: { position: 'absolute', right: 0, height: 1.5, backgroundColor: color.tapeInk },
  tickText: { position: 'absolute', left: 2, width: 15, fontSize: 10, lineHeight: 13, color: color.tapeInk, fontFamily: family.numBold, textAlign: 'left' },
  headLine: { position: 'absolute', left: 30, width: '32%', height: 1, backgroundColor: 'rgba(255,212,58,0.55)' },
  flag: {
    position: 'absolute', left: 30, flexDirection: 'row', alignItems: 'baseline', gap: 2, backgroundColor: color.tape,
    paddingLeft: 6, paddingRight: 8, height: 26, borderTopRightRadius: 13, borderBottomRightRadius: 13,
  },
  flagText: { fontFamily: family.numBold, fontSize: 19, lineHeight: 26, color: color.tapeInk },
  flagUnit: { fontFamily: family.num, fontSize: 11, color: color.tapeInk },
  caption: { position: 'absolute', top: space.md, right: space.md, alignItems: 'flex-end' },
  views: { position: 'absolute', bottom: 10, left: 30, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  viewBtn: { backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 13, paddingVertical: 6, borderRadius: radius.pill },
  viewBtnOn: { backgroundColor: color.tape },
  viewText: { fontSize: 12, color: color.onIndigo, fontFamily: family.semibold },
});
