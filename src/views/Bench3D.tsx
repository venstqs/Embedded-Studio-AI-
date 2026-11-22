import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Live, Part, Wire } from '../types';
import { LED_COLORS, PARTS, pinPos, ref, toWorld, partBounds } from '../parts/catalog';
import { MODELS } from '../three/models';
import type { Model } from '../three/models';

/**
 * The circuit built for real, in 3D: the same parts and wires as the 2D
 * workplane, standing on the bench at true scale (millimetres). The
 * simulation drives it live: LEDs glow, motors and servos move, buttons go
 * down when pressed. Orbit with the left mouse, pan with the right, zoom
 * with the wheel. Click a part to select it; while running, click buttons
 * and switches to use them.
 */

export type ViewPreset = 'iso' | 'top' | 'front';

interface Props {
  parts: Part[];
  wires: Wire[];
  live: Record<string, Live>;
  running: boolean;
  flow: Record<string, number>;
  dark: boolean;
  selected: string[];
  preset: { name: ViewPreset; n: number };
  onSelect: (id: string | null) => void;
  onPress: (id: string, down: boolean) => void;
  onToggle: (id: string) => void;
  /** Turn slowly on its own until someone grabs it (for showcases). */
  autoRotate?: boolean;
  /** Frame the circuit tighter (above 1) or looser. */
  zoom?: number;
}

const S = 2.54 / 12; // millimetres per workplane unit
const BB_TOP = 9.5;
/** Where hole a1 sits in the breadboard model, and on the 2D breadboard. */
const BB_A1_3D = new THREE.Vector2(-36.8, -14);
const BB_A1_2D = { x: 24, y: 48 };
/** Parts whose model origin is the middle of the part rather than the middle of its pins. */
const CENTRED = new Set(['uno', 'esp32', 'multimeter', 'scope', 'lcd', 'servo', 'motor']);
/** Models that are scaled to fit the part's 2D footprint. */
const FIT = new Set(['multimeter', 'scope', 'battery', 'lcd', 'servo', 'motor']);

interface Placed { key: string; model: Model; holder: THREE.Group; size: THREE.Box3; part: Part; glow?: THREE.MeshStandardMaterial[] }

const propKey = (p: Part) => {
  const { pressed: _a, pos: _b, ...rest } = p.props;
  return `${p.type}|${JSON.stringify(rest)}`;
};

function disposeTree(o: THREE.Object3D) {
  o.traverse(c => {
    const m = c as THREE.Mesh;
    m.geometry?.dispose();
    const mt = m.material as THREE.Material | THREE.Material[] | undefined;
    (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach(x => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
  });
}

export default function Bench3D(props: Props) {
  const el = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const api = useRef<{ sync: () => void; preset: (n: ViewPreset) => void; fit: () => void } | null>(null);
  const [failed, setFailed] = useState(false);

  // ---- one-time scene setup ----
  useEffect(() => {
    const host = el.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    const camera = new THREE.PerspectiveCamera(32, 1, 1, 6000);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    scene.add(sun, sun.target, new THREE.HemisphereLight(0xffffff, 0x444444, 0.35));

    // The bench mat
    const matMat = new THREE.MeshStandardMaterial({ roughness: 0.92 });
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matMat);
    mat.rotation.x = -Math.PI / 2;
    mat.receiveShadow = true;
    scene.add(mat);
    let grid = new THREE.GridHelper(1, 1);
    scene.add(grid);

    const parts = new Map<string, Placed>();
    const wireGroup = new THREE.Group();
    const flowGroup = new THREE.Group();
    scene.add(wireGroup, flowGroup);
    const selBox = new THREE.Box3Helper(new THREE.Box3(), 0xffffff);
    selBox.visible = false;
    scene.add(selBox);
    let flowDots: { curve: THREE.Curve<THREE.Vector3>; mesh: THREE.InstancedMesh; wire: string }[] = [];
    const pinHeights = new Map<string, number>();
    const centre = new THREE.Vector3();
    let extent = 200;

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.screenSpacePanning = true;
    orbit.maxPolarAngle = Math.PI / 2 - 0.04;
    orbit.autoRotateSpeed = 0.8;
    let grabbed = false;
    orbit.addEventListener('start', () => { grabbed = true; });

    const onBreadboard = (part: Part, all: Part[]) => {
      const holes = new Set<string>();
      for (const b of all) if (b.type === 'breadboard') for (const p of PARTS.breadboard.pins) { const w = pinPos(b, p); holes.add(`${Math.round(w.x)},${Math.round(w.y)}`); }
      return PARTS[part.type].pins.some(p => { const w = pinPos(part, p); return holes.has(`${Math.round(w.x)},${Math.round(w.y)}`); });
    };

    /** Bring the 3D scene in line with the project. Models are reused when only position changes. */
    const sync = () => {
      const { parts: list, wires, dark } = latest.current;
      scene.background = new THREE.Color(dark ? 0x0d0d10 : 0xe9e9ec);
      matMat.color.setHex(dark ? 0x1c1d22 : 0x50555f);
      const seen = new Set<string>();
      pinHeights.clear();
      const box = new THREE.Box3();
      for (const part of list) {
        seen.add(part.id);
        const key = propKey(part);
        let pl = parts.get(part.id);
        if (pl && pl.key !== key) { scene.remove(pl.holder); disposeTree(pl.holder); pl = undefined; }
        if (!pl) {
          const model = MODELS[part.type]();
          const holder = new THREE.Group();
          holder.add(model.group);
          holder.userData.partId = part.id;
          model.group.traverse(o => { o.userData.partId = part.id; });
          let size = new THREE.Box3().setFromObject(model.group);
          if (FIT.has(part.type)) {
            // Instruments and big modules are drawn bench-sized in 2D; shrink the real-size model to that footprint.
            const [x0, y0, x1, y1] = PARTS[part.type].box;
            const dim = size.getSize(new THREE.Vector3());
            const k = Math.min(1, ((x1 - x0) * S) / dim.x, ((y1 - y0) * S) / dim.z);
            model.group.scale.setScalar(k);
            size = new THREE.Box3().setFromObject(model.group);
          }
          pl = { key, model, holder, size, part };
          if (part.type === 'led') {
            // Tint the lens to the LED's colour.
            const hex = new THREE.Color(LED_COLORS[String(part.props.color)]?.hex ?? '#ef2b2d');
            const glow: THREE.MeshStandardMaterial[] = [];
            model.group.traverse(o => {
              const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
              if (m && m.transparent && !glow.includes(m)) { m.color.copy(hex); glow.push(m); }
              const light = o as THREE.PointLight;
              if (light.isPointLight) light.color.copy(hex);
            });
            pl.glow = glow;
          }
          scene.add(holder);
          parts.set(part.id, pl);
        }
        pl.part = part;
        // Position: anchor the model on the 2D layout.
        const r = (part.rot * Math.PI) / 180;
        let ax: number, az: number;
        if (part.type === 'breadboard') {
          const w = toWorld(part, BB_A1_2D.x, BB_A1_2D.y);
          // Model offset from a1, rotated with the part.
          const ox = -BB_A1_3D.x, oz = -BB_A1_3D.y;
          ax = w.x * S + ox * Math.cos(r) - oz * Math.sin(r);
          az = w.y * S + ox * Math.sin(r) + oz * Math.cos(r);
        } else if (CENTRED.has(part.type)) {
          const b = partBounds(part);
          ax = ((b.x0 + b.x1) / 2) * S; az = ((b.y0 + b.y1) / 2) * S;
        } else {
          const pins = PARTS[part.type].pins.map(p => pinPos(part, p));
          ax = (pins.reduce((s, p) => s + p.x, 0) / pins.length) * S;
          az = (pins.reduce((s, p) => s + p.y, 0) / pins.length) * S;
        }
        const seated = part.type !== 'breadboard' && !FIT.has(part.type) && !CENTRED.has(part.type) && onBreadboard(part, list);
        const y = part.type === 'breadboard' ? 0 : seated ? BB_TOP : -pl.size.min.y;
        pl.holder.position.set(ax, y, az);
        pl.holder.rotation.y = -r;
        // Where a wire plugs into each pin.
        const top = part.type === 'breadboard' ? BB_TOP
          : part.type === 'uno' || part.type === 'esp32' ? y + pl.size.max.y * 0.82
          : part.type === 'multimeter' || part.type === 'scope' || part.type === 'battery' ? y + pl.size.max.y
          : seated ? BB_TOP : y + Math.max(1.5, pl.size.max.y * 0.25);
        for (const p of PARTS[part.type].pins) pinHeights.set(ref(part.id, p.id), top);
        pl.holder.updateMatrixWorld(true);
        box.expandByObject(pl.holder);
      }
      for (const [id, pl] of parts) if (!seen.has(id)) { scene.remove(pl.holder); disposeTree(pl.holder); parts.delete(id); }

      // Wires: a flexible jumper arching between two plugs.
      for (const c of [...wireGroup.children]) { wireGroup.remove(c); disposeTree(c); }
      for (const c of [...flowGroup.children]) { flowGroup.remove(c); disposeTree(c); }
      flowDots = [];
      const pinAt = new Map<string, THREE.Vector3>();
      for (const part of list) for (const p of PARTS[part.type].pins) {
        const w = pinPos(part, p);
        pinAt.set(ref(part.id, p.id), new THREE.Vector3(w.x * S, pinHeights.get(ref(part.id, p.id)) ?? 0, w.y * S));
      }
      const plugMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5 });
      const tipMat = new THREE.MeshStandardMaterial({ color: 0xc5ccd4, metalness: 0.85, roughness: 0.3 });
      const dotGeo = new THREE.SphereGeometry(0.42, 10, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (const w of wires) {
        const a = pinAt.get(w.from), b = pinAt.get(w.to);
        if (!a || !b) continue;
        const len = a.distanceTo(b);
        const lift = 5 + Math.min(18, len * 0.22);
        const bend = w.bend ? new THREE.Vector3(w.bend[0] * S * 2, 0, w.bend[1] * S * 2) : new THREE.Vector3();
        const a1 = a.clone().add(new THREE.Vector3(0, 7, 0)), b1 = b.clone().add(new THREE.Vector3(0, 7, 0));
        const mid = a1.clone().lerp(b1, 0.5).add(new THREE.Vector3(0, lift, 0)).add(bend);
        const curve = new THREE.CatmullRomCurve3([a1, a1.clone().lerp(mid, 0.45).setY(mid.y - lift * 0.15), mid, b1.clone().lerp(mid, 0.45).setY(mid.y - lift * 0.15), b1], false, 'centripetal');
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.round(len)), 0.55, 10), new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.42 }));
        tube.castShadow = true;
        tube.userData.wireId = w.id;
        wireGroup.add(tube);
        for (const [p, top] of [[a, a1], [b, b1]] as const) {
          const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 4.6, 14), plugMat);
          plug.position.set(p.x, p.y + 4.6 / 2 + 2.2, p.z);
          plug.castShadow = true;
          const pinM = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 8), tipMat);
          pinM.position.set(p.x, p.y + 1.2, p.z);
          const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, top.y - p.y - 6.4, 10), new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.42 }));
          neck.position.set(p.x, p.y + 6.8 + (top.y - p.y - 6.4) / 2, p.z);
          wireGroup.add(plug, pinM, neck);
        }
        const mesh = new THREE.InstancedMesh(dotGeo, dotMat, 6);
        mesh.visible = false;
        flowGroup.add(mesh);
        flowDots.push({ curve, mesh, wire: w.id });
      }

      // Bench size, lighting and shadow camera follow the circuit.
      if (box.isEmpty()) box.set(new THREE.Vector3(-60, 0, -40), new THREE.Vector3(60, 10, 40));
      box.getCenter(centre);
      const size = box.getSize(new THREE.Vector3());
      extent = Math.max(80, size.x, size.z);
      const m = extent * 2.2;
      mat.scale.set(m, m, 1);
      mat.position.set(centre.x, -0.02, centre.z);
      scene.remove(grid);
      disposeTree(grid);
      grid = new THREE.GridHelper(m, Math.round(m / 12.7), dark ? 0x2a2b31 : 0x6a707b, dark ? 0x232429 : 0x5f6570);
      grid.position.set(centre.x, 0.01, centre.z);
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.45;
      scene.add(grid);
      sun.position.set(centre.x + extent * 0.6, extent * 1.6, centre.z + extent * 0.9);
      sun.target.position.copy(centre);
      const sc = sun.shadow.camera;
      sc.left = sc.bottom = -extent; sc.right = sc.top = extent; sc.near = 1; sc.far = extent * 5;
      sc.updateProjectionMatrix();
    };

    const preset = (name: ViewPreset) => {
      const d = (extent * 1.55) / (latest.current.zoom ?? 1);
      orbit.target.copy(centre);
      if (name === 'top') camera.position.set(centre.x, centre.y + d * 1.25, centre.z + 0.01);
      else if (name === 'front') camera.position.set(centre.x, centre.y + d * 0.28, centre.z + d * 1.2);
      else camera.position.set(centre.x + d * 0.55, centre.y + d * 0.75, centre.z + d * 0.85);
      camera.lookAt(centre);
      orbit.update();
    };
    api.current = { sync, preset, fit: () => preset('iso') };
    sync();
    preset('iso');

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // ---- picking: click selects, buttons press while running ----
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt: { x: number; y: number; id: string | null } | null = null;
    let pressed: string | null = null;
    const pick = (e: PointerEvent): string | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects([...parts.values()].map(p => p.holder), true);
      // Prefer a part that sits on top of the breadboard over the breadboard itself.
      const ids = hits.map(h => h.object.userData.partId as string | undefined).filter(Boolean) as string[];
      return ids.find(id => parts.get(id)?.part.type !== 'breadboard') ?? ids[0] ?? null;
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const id = pick(e);
      downAt = { x: e.clientX, y: e.clientY, id };
      const p = id ? parts.get(id)?.part : undefined;
      if (latest.current.running && p?.type === 'button') {
        pressed = p.id;
        orbit.enabled = false;
        latest.current.onPress(p.id, true);
      }
    };
    const up = (e: PointerEvent) => {
      if (pressed) { latest.current.onPress(pressed, false); pressed = null; orbit.enabled = true; downAt = null; return; }
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) { downAt = null; return; }
      const id = downAt.id;
      downAt = null;
      const p = id ? parts.get(id)?.part : undefined;
      if (latest.current.running && p?.type === 'switch') latest.current.onToggle(p.id);
      latest.current.onSelect(id);
    };
    const hover = (e: PointerEvent) => {
      if (downAt) return;
      const id = pick(e);
      const p = id ? parts.get(id)?.part : undefined;
      renderer.domElement.style.cursor = latest.current.running && (p?.type === 'button' || p?.type === 'switch') ? 'pointer' : p && p.type !== 'breadboard' ? 'pointer' : 'grab';
    };
    renderer.domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointermove', hover);

    // ---- frame loop: live state ----
    let raf = 0;
    let last = performance.now();
    const m4 = new THREE.Matrix4();
    let t = 0;
    const frame = (now = performance.now()) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const { live, running, selected, flow } = latest.current;
      for (const pl of parts.values()) {
        const L = running ? live[pl.part.id] : undefined;
        const d = pl.model.demo;
        const p = pl.part;
        switch (p.type) {
          case 'led':
            d?.apply(L?.b ?? 0);
            if (pl.glow) for (const m of pl.glow) { m.emissive.copy(m.color); m.emissiveIntensity = (L?.b ?? 0) * 1.8; }
            break;
          case 'button': d?.apply(p.props.pressed ? 1 : 0); break;
          case 'potentiometer': d?.apply(+p.props.pos); break;
          case 'switch': d?.apply(p.props.pos ? 1 : 0); break;
          case 'servo': d?.apply((L?.angle ?? 90) / 180); break;
          case 'motor': d?.apply(Math.min(1, Math.abs(L?.rps ?? 0) / 14)); break;
          case 'lcd': d?.apply(running && L?.backlight !== false && L?.lcd ? 1 : 0); break;
          case 'multimeter': d?.apply(p.props.mode === 'A' ? 0.5 : p.props.mode === 'Ω' ? 1 : 0); break;
          case 'uno': d?.apply(L?.on ? 1 : 0); break;
          default: break;
        }
        pl.model.tick?.(dt);
      }
      // Selection outline
      const sel = selected.length === 1 ? parts.get(selected[0]) : undefined;
      if (sel && sel.part.type !== 'breadboard') {
        selBox.box.setFromObject(sel.holder).expandByScalar(0.8);
        selBox.visible = true;
        (selBox.material as THREE.LineBasicMaterial).color.setHex(latest.current.dark ? 0xffffff : 0x111111);
      } else selBox.visible = false;
      // Current flow: bright beads sliding along wires that carry current.
      for (const f of flowDots) {
        const amps = running ? flow[f.wire] ?? 0 : 0;
        const on = Math.abs(amps) > 1e-4;
        f.mesh.visible = on;
        if (!on) continue;
        const speed = 0.25 + Math.min(1.2, Math.log10(Math.abs(amps) * 1e4) * 0.3);
        for (let i = 0; i < 6; i++) {
          let u = (t * speed + i / 6) % 1;
          if (amps < 0) u = 1 - u;
          const p = f.curve.getPointAt(u);
          m4.makeTranslation(p.x, p.y + 0.15, p.z);
          f.mesh.setMatrixAt(i, m4);
        }
        f.mesh.instanceMatrix.needsUpdate = true;
      }
      orbit.autoRotate = !!latest.current.autoRotate && !grabbed;
      orbit.update();
      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      orbit.dispose();
      renderer.domElement.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointermove', hover);
      disposeTree(scene);
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  // Rebuild when the layout changes; the frame loop picks up live state by itself.
  useEffect(() => { api.current?.sync(); }, [props.parts, props.wires, props.dark]);
  useEffect(() => { if (props.preset.n) api.current?.preset(props.preset.name); }, [props.preset]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="absolute inset-0" data-bench3d="" />
      {failed && <p className="absolute inset-0 grid place-items-center text-fg-3">3D needs WebGL, which this browser has turned off.</p>}
    </div>
  );
}
