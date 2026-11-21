import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ArrowRight, Pause, Play, Search, TriangleAlert } from 'lucide-react';
import type { PartType } from '../types';
import { PARTS, PART_ORDER } from '../parts/catalog';
import { PartThumb } from '../parts/PartArt';
import { MODELS } from '../three/models';
import type { Callout, Model } from '../three/models';
import { LESSONS } from '../data/learn';
import { starterFor } from '../data/projects';

interface Props {
  type: PartType;
  onPick: (t: PartType) => void;
  onOpenStarter: (id: string) => void;
  dark: boolean;
}

/** A turntable for one part: drag to spin it, tap the dots to learn what each piece does. */
function Stage({ type, active, onActive, demoValue, spin, dark }: { type: PartType; active: number | null; onActive: (i: number | null) => void; demoValue: number; spin: boolean; dark: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const dots = useRef<HTMLDivElement>(null);
  const model = useRef<Model | null>(null);
  const controls = useRef<OrbitControls | null>(null);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // A soft studio room for reflections, so metal looks like metal.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.55;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, dark ? 0x2a2a30 : 0xb9c6d6, dark ? 0.6 : 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdbe8ff, 0.7);
    fill.position.set(-1, 0.4, -1);
    scene.add(fill);

    const m = MODELS[type]();
    model.current = m;
    setCallouts(m.callouts);
    const bounds = new THREE.Box3().setFromObject(m.group);
    const centre = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
    m.group.position.sub(centre);
    scene.add(m.group);

    // Turntable disc under the part
    const size = bounds.getSize(new THREE.Vector3());
    const discR = Math.max(Math.hypot(size.x, size.z) * 0.62, radius * 0.5);
    const floorY = bounds.min.y - centre.y;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(discR, discR, discR * 0.03, 96), new THREE.MeshStandardMaterial({ color: dark ? 0x1b1b20 : 0xffffff, roughness: 0.85 }));
    disc.position.y = floorY - discR * 0.015;
    disc.receiveShadow = true;
    scene.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(discR, discR * 0.0035, 8, 160), new THREE.MeshBasicMaterial({ color: dark ? 0x3a3a42 : 0xc4c4cb }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = floorY + discR * 0.004;
    scene.add(ring);

    const reach = Math.max(radius, Math.hypot(discR, floorY));
    sun.position.set(reach * 1.2, reach * 3, reach * 1.8);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -reach * 1.5; sc.right = sc.top = reach * 1.5; sc.near = 0.1; sc.far = reach * 10;
    sc.updateProjectionMatrix();

    const dist = (reach / Math.sin((camera.fov * Math.PI) / 360)) * 1.12;
    camera.position.set(dist * 0.6, dist * 0.46, dist * 0.66);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.enablePan = false;
    orbit.minDistance = dist * 0.35;
    orbit.maxDistance = dist * 2;
    orbit.autoRotateSpeed = 1.4;
    controls.current = orbit;

    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const v = new THREE.Vector3();
    let raf = 0;
    let last = performance.now();
    const frame = (now = performance.now()) => {
      raf = requestAnimationFrame(frame);
      m.tick?.(Math.min(0.05, (now - last) / 1000));
      last = now;
      orbit.update();
      renderer.render(scene, camera);
      const { width, height } = el.getBoundingClientRect();
      const nodes = dots.current?.children;
      if (nodes) m.callouts.forEach((c, i) => {
        const node = nodes[i] as HTMLElement | undefined;
        if (!node) return;
        v.set(c.at[0], c.at[1], c.at[2]).sub(centre).project(camera);
        node.style.transform = `translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px)`;
      });
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      orbit.dispose();
      scene.traverse(o => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mt = mesh.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach(x => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      model.current = null;
    };
  }, [type, dark]);

  useEffect(() => { model.current?.demo?.apply(demoValue); }, [demoValue, callouts]);
  useEffect(() => { if (controls.current) controls.current.autoRotate = spin; }, [spin, callouts]);

  if (failed) return <div className="grid h-full place-items-center p-6 text-center text-fg-3">3D needs WebGL, which this browser has turned off. The notes on the right still apply.</div>;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <div ref={dots} className="pointer-events-none absolute inset-0">
        {callouts.map((c, i) => (
          <div key={c.title} className="absolute top-0 left-0">
            <button onClick={() => onActive(active === i ? null : i)} aria-label={c.title} aria-pressed={active === i}
              className={`pointer-events-auto absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-[11px] font-semibold shadow-lg transition-transform ${active === i ? 'scale-125 bg-inverse text-on-inverse' : 'bg-surface text-fg ring-1 ring-line-2 hover:scale-110'}`}>
              {i + 1}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Discover({ type, onPick, onOpenStarter, dark }: Props) {
  const spec = PARTS[type];
  const lesson = LESSONS[type];
  const starter = starterFor(type);
  const [active, setActive] = useState<number | null>(null);
  const [demo, setDemo] = useState<{ label: string; read: (v: number) => string } | null>(null);
  const [value, setValue] = useState(0.5);
  const [spin, setSpin] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [query, setQuery] = useState('');

  // Read the model's labels and demo once per part, then free the throwaway copy.
  useEffect(() => {
    const m = MODELS[type]();
    m.group.traverse(o => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mt = mesh.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach(x => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
    });
    setCallouts(m.callouts);
    setDemo(m.demo ? { label: m.demo.label, read: m.demo.read } : null);
    setValue(m.demo?.start ?? 0.5);
    setActive(null);
  }, [type]);

  const q = query.trim().toLowerCase();
  const list = PART_ORDER.filter(t => !q || PARTS[t].name.toLowerCase().includes(q));

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <nav className="flex shrink-0 flex-col border-b border-line bg-surface lg:w-[240px] lg:border-r lg:border-b-0" aria-label="Parts to explore">
        <div className="hidden p-2.5 lg:block">
          <label className="relative block">
            <span className="sr-only">Search parts</span>
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-3" aria-hidden="true" />
            <input className="input pl-8" placeholder="Search parts" value={query} onChange={e => setQuery(e.target.value)} />
          </label>
        </div>
        <div className="scroll flex gap-1 overflow-auto p-2 lg:block lg:flex-1 lg:space-y-px lg:px-2.5 lg:pt-0">
          {list.map(t => (
            <button key={t} onClick={() => onPick(t)} aria-current={t === type}
              className={`flex w-auto shrink-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] lg:w-full ${t === type ? 'bg-surface-3 text-fg' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'}`}>
              <span className="tile-art h-8 w-8 shrink-0"><PartThumb part={{ id: t, type: t, x: 0, y: 0, rot: 0, props: PARTS[t].defaults }} size={24} /></span>
              <span className="whitespace-nowrap">{PARTS[t].name}</span>
            </button>
          ))}
        </div>
      </nav>

      <section className="relative min-h-[340px] flex-1 bg-canvas lg:min-h-0" aria-label={`3D model of ${spec.name}`}
        style={{ backgroundImage: 'radial-gradient(ellipse at 50% 40%, var(--surface-2), transparent 70%)' }}>
        <Stage key={type} type={type} active={active} onActive={setActive} demoValue={value} spin={spin && active === null} dark={dark} />
        <div className="pointer-events-none absolute top-5 right-6 left-6">
          <p className="eyebrow">{spec.group}</p>
          <h1 className="mt-1 text-[28px] leading-tight tracking-[-0.025em]">{spec.name}</h1>
          <p className="mt-1 max-w-md text-fg-2">{spec.blurb}</p>
        </div>
        <div className="absolute right-4 bottom-4 left-4 flex flex-wrap items-end gap-3">
          {demo && (
            <label className="popover block w-72 max-w-full p-3">
              <span className="flex items-baseline justify-between gap-2"><span className="label">{demo.label}</span><span className="font-mono text-[11.5px] text-fg tabular-nums">{demo.read(value)}</span></span>
              <input type="range" className="mt-2" min={0} max={1} step={0.01} value={value} onChange={e => setValue(+e.target.value)} />
            </label>
          )}
          <span className="flex-1" />
          <span className="hidden text-[12px] text-fg-3 sm:inline">Drag to turn, scroll to zoom</span>
          <button className="btn" onClick={() => setSpin(s => !s)} aria-pressed={spin}>{spin ? <Pause size={13} /> : <Play size={13} />}{spin ? 'Pause' : 'Spin'}</button>
        </div>
      </section>

      <aside className="scroll shrink-0 overflow-auto border-t border-line bg-surface lg:w-[380px] lg:border-t-0 lg:border-l">
        <section className="border-b border-line p-5">
          <h2 className="text-[13px]">How it works</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-2">{lesson.how}</p>
        </section>

        <section className="border-b border-line p-5">
          <h2 className="text-[13px]">What you’re looking at</h2>
          <ol className="mt-2 space-y-0.5">
            {callouts.map((c, i) => (
              <li key={c.title}>
                <button onClick={() => setActive(active === i ? null : i)} aria-expanded={active === i}
                  className={`flex w-full gap-3 rounded-md p-2 text-left ${active === i ? 'bg-surface-2' : 'hover:bg-surface-2'}`}>
                  <span className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[10.5px] font-semibold ${active === i ? 'bg-inverse text-on-inverse' : 'bg-surface-3 text-fg-2'}`}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{c.title}</span>
                    {active === i && <span className="mt-1 block text-[12.5px] leading-relaxed text-fg-2">{c.text}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-b border-line p-5">
          <h2 className="text-[13px]">Wiring it up</h2>
          <ul className="mt-2 space-y-2">
            {lesson.wiring.map(w => (
              <li key={w} className="flex gap-2.5 text-[13px] leading-relaxed text-fg-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-fg-3" aria-hidden="true" />{w}</li>
            ))}
          </ul>
        </section>

        <section className="border-b border-line p-5">
          <h2 className="text-[13px]">Specifications</h2>
          <dl className="mt-2 divide-y divide-line rounded-lg border border-line">
            {lesson.facts.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 px-3 py-2 text-[12.5px]"><dt className="text-fg-3">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
          </dl>
        </section>

        <section className="space-y-3 p-5">
          <div className="flex gap-2.5 rounded-lg border border-line bg-surface-2 p-3 text-[12.5px] leading-relaxed">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warn" aria-hidden="true" />
            <p><span className="font-semibold text-fg">Watch out.</span> <span className="text-fg-2">{lesson.watchOut}</span></p>
          </div>
          {starter && (
            <button className="group card flex w-full items-center gap-3 p-3 text-left transition-colors hover:border-line-2" onClick={() => onOpenStarter(starter.id)}>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] text-fg-3">Build with it</p>
                <p className="truncate text-[13px] font-semibold">{starter.title}</p>
              </div>
              <ArrowRight size={15} className="shrink-0 text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden="true" />
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}
