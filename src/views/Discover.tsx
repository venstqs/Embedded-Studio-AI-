import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ArrowRight, Pause, Play } from 'lucide-react';
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
}

/** A turntable for one part: drag to spin it, tap the dots to learn what each piece does. */
function Stage({ type, active, onActive, demoValue, spin }: { type: PartType; active: number | null; onActive: (i: number | null) => void; demoValue: number; spin: boolean }) {
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
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c6d6, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
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
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(discR, discR, discR * 0.03, 96), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
    disc.position.y = floorY - discR * 0.015;
    disc.receiveShadow = true;
    scene.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(discR, discR * 0.006, 8, 120), new THREE.MeshBasicMaterial({ color: 0x09090b }));
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
    const frame = () => {
      raf = requestAnimationFrame(frame);
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
        (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach(x => x.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
      model.current = null;
    };
  }, [type]);

  useEffect(() => { model.current?.demo?.apply(demoValue); }, [demoValue, callouts]);
  useEffect(() => { if (controls.current) controls.current.autoRotate = spin; }, [spin, callouts]);

  if (failed) return <div className="grid h-full place-items-center p-6 text-center text-sm text-muted">3D needs WebGL, which this browser has turned off. The notes on the right still apply.</div>;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      <div ref={dots} className="pointer-events-none absolute inset-0">
        {callouts.map((c, i) => (
          <div key={c.title} className="absolute top-0 left-0">
            <button onClick={() => onActive(active === i ? null : i)} aria-label={c.title} aria-pressed={active === i}
              className={`pointer-events-auto absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-[11px] font-bold shadow-md transition-transform ${active === i ? 'scale-125 bg-white text-ink ring-2 ring-ink' : 'bg-ink text-white hover:scale-110'}`}>
              {i + 1}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Discover({ type, onPick, onOpenStarter }: Props) {
  const spec = PARTS[type];
  const lesson = LESSONS[type];
  const starter = starterFor(type);
  const [active, setActive] = useState<number | null>(null);
  const [demo, setDemo] = useState<{ label: string; read: (v: number) => string } | null>(null);
  const [value, setValue] = useState(0.5);
  const [spin, setSpin] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [callouts, setCallouts] = useState<Callout[]>([]);

  // Read the model's labels and demo once per part (cheap: plain data, built without a renderer).
  useEffect(() => {
    const m = MODELS[type]();
    setCallouts(m.callouts);
    setDemo(m.demo ? { label: m.demo.label, read: m.demo.read } : null);
    setValue(m.demo?.start ?? 0.5);
    setActive(null);
  }, [type]);

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <nav className="scroll-thin flex shrink-0 gap-1 overflow-auto border-b border-line bg-panel p-2 lg:w-52 lg:flex-col lg:gap-0.5 lg:border-b-0 lg:border-r lg:p-3" aria-label="Parts to explore">
        {PART_ORDER.map(t => (
          <button key={t} onClick={() => onPick(t)} aria-current={t === type}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${t === type ? 'bg-ink text-white' : 'hover:bg-paper'}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${t === type ? 'bg-white/90' : 'bg-paper'}`}>
              <PartThumb part={{ id: t, type: t, x: 0, y: 0, rot: 0, props: PARTS[t].defaults }} size={26} />
            </span>
            <span className="whitespace-nowrap">{PARTS[t].name}</span>
          </button>
        ))}
      </nav>

      <section className="relative min-h-[320px] flex-1 lg:min-h-0" aria-label={`3D model of ${spec.name}`}>
        <Stage key={type} type={type} active={active} onActive={setActive} demoValue={value} spin={spin && active === null} />
        <div className="pointer-events-none absolute top-4 left-5 right-5">
          <h1 className="text-3xl leading-none font-bold sm:text-4xl">{spec.name}</h1>
          <p className="mt-1.5 max-w-md text-sm text-muted">{spec.blurb}</p>
        </div>
        <div className="absolute right-4 bottom-4 left-4 flex flex-wrap items-end gap-3">
          {demo && (
            <label className="float block w-64 max-w-full p-3 text-sm">
              <span className="flex justify-between gap-2"><span className="font-medium">{demo.label}</span><span className="tabular-nums text-muted">{demo.read(value)}</span></span>
              <input type="range" min={0} max={1} step={0.01} value={value} onChange={e => setValue(+e.target.value)} />
            </label>
          )}
          <span className="flex-1" />
          <button className="btn" onClick={() => setSpin(s => !s)}>{spin ? <Pause size={15} /> : <Play size={15} />}{spin ? 'Stop spinning' : 'Spin'}</button>
        </div>
      </section>

      <aside className="scroll-thin shrink-0 overflow-auto border-t border-line bg-panel p-5 lg:w-[380px] lg:border-t-0 lg:border-l">
        <h2 className="text-lg font-semibold">How it works</h2>
        <p className="mt-1 text-[15px] leading-relaxed">{lesson.how}</p>

        <h2 className="mt-5 text-lg font-semibold">What you are looking at</h2>
        <ol className="mt-2 flex flex-col gap-1">
          {callouts.map((c, i) => (
            <li key={c.title}>
              <button onClick={() => setActive(active === i ? null : i)} aria-expanded={active === i}
                className={`flex w-full gap-2.5 rounded-lg p-2 text-left ${active === i ? 'bg-paper' : 'hover:bg-paper'}`}>
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${active === i ? 'bg-white text-ink ring-2 ring-ink' : 'bg-ink text-white'}`}>{i + 1}</span>
                <span>
                  <span className="block text-sm font-semibold">{c.title}</span>
                  {active === i && <span className="mt-0.5 block text-sm leading-relaxed">{c.text}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <h2 className="mt-5 text-lg font-semibold">Wiring it up</h2>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
          {lesson.wiring.map(w => <li key={w}>{w}</li>)}
        </ul>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-line pt-4 text-sm">
          {lesson.facts.map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>

        <p className="mt-4 rounded-lg border border-ink p-3 text-sm leading-relaxed"><strong>Watch out.</strong> {lesson.watchOut}</p>

        {starter && (
          <button className="btn btn-ink mt-4 h-auto w-full justify-between py-2.5 text-left" onClick={() => onOpenStarter(starter.id)}>
            <span><span className="block text-xs font-normal opacity-75">Build with it</span>{starter.title}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </aside>
    </div>
  );
}
