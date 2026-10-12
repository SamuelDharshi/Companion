"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * The product's story in one picture: a student's allowance leaving Chennai and arriving in Bloomington, Indiana, in about
 * a second. A dotted globe, the two cities, and a pulse travelling along the great-circle route between them.
 *
 * The two cities are about 126 degrees apart, so the camera looks at the midpoint of the route (over the Arctic), which keeps
 * both cities and the whole arc on the visible face. It renders nothing if WebGL is unavailable, pauses when off screen or in a
 * background tab, and draws one still frame for people who prefer reduced motion.
 */

const CHENNAI = { lat: 13.0827, lon: 80.2707 };
const BLOOMINGTON = { lat: 39.1653, lon: -86.5264 };

const R = 1;
const DEEP = new THREE.Color("#007a1e");
const BRAND = new THREE.Color("#00ff22");
const TINT = new THREE.Color("#f2fff4");

function toVec(lat: number, lon: number, r = R) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

/** The great-circle route, lifted off the surface in the middle so it reads as a flight path. */
class RouteCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly a: THREE.Vector3,
    private readonly b: THREE.Vector3,
    private readonly lift: number,
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const omega = this.a.angleTo(this.b);
    const s = Math.sin(omega);
    const p = this.a
      .clone()
      .multiplyScalar(Math.sin((1 - t) * omega) / s)
      .add(this.b.clone().multiplyScalar(Math.sin(t * omega) / s))
      .normalize()
      .multiplyScalar(R + this.lift * Math.sin(Math.PI * t));
    return target.copy(p);
  }
}

/** A soft round dot, drawn once into a small canvas, so points render as circles instead of squares. */
function dotTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.55, "rgba(255,255,255,0.95)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function Globe({ className = "" }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const fromLabel = useRef<HTMLDivElement>(null);
  const toLabel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return; // no WebGL: the page still has the phones and the copy
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.setAttribute("aria-hidden", "true");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 4.4);

    // The globe sits in a group that is turned so the route's midpoint faces the camera.
    const globe = new THREE.Group();
    scene.add(globe);
    const a = toVec(CHENNAI.lat, CHENNAI.lon);
    const b = toVec(BLOOMINGTON.lat, BLOOMINGTON.lon);
    // Looking straight at the route's midpoint would show its plane edge-on, as a straight line, so the view is tilted out of
    // that plane, then rolled so the route runs left to right with its arch on top.
    const mid = a.clone().add(b).normalize();
    const orient = (tilt: number) => {
      const normal = a.clone().cross(b).normalize();
      const view = mid.clone().multiplyScalar(Math.cos(tilt)).add(normal.multiplyScalar(Math.sin(tilt))).normalize();
      const q1 = new THREE.Quaternion().setFromUnitVectors(view, new THREE.Vector3(0, 0, 1));
      const a1 = a.clone().applyQuaternion(q1);
      const b1 = b.clone().applyQuaternion(q1);
      const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.atan2(b1.y - a1.y, b1.x - a1.x));
      return roll.multiply(q1);
    };
    let base = orient(0.62);
    if (mid.clone().applyQuaternion(base).y < a.clone().applyQuaternion(base).y) base = orient(-0.62);
    globe.quaternion.copy(base);

    // An inner sphere hides the dots on the far side and gives the globe a soft body.
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.985, 64, 64),
      new THREE.MeshBasicMaterial({ color: TINT, transparent: true, opacity: 0.88 }),
    );
    globe.add(body);

    // A dotted surface: tiny discs spread evenly with a Fibonacci lattice. Real geometry rather than point sprites, because some
    // GPUs draw sprites at one pixel.
    const count = 2400;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const dots = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.0095, 6),
      new THREE.MeshBasicMaterial({ color: DEEP, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      count,
    );
    const place = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = golden * i;
      place.position.set(Math.cos(theta) * radius * R * 1.001, y * R * 1.001, Math.sin(theta) * radius * R * 1.001);
      place.lookAt(place.position.clone().multiplyScalar(2));
      place.updateMatrix();
      dots.setMatrixAt(i, place.matrix);
    }
    globe.add(dots);

    // Faint parallels and meridians, so it reads as a globe at a glance.
    const lines: number[] = [];
    const seg = 96;
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let k = 0; k < seg; k++) {
        lines.push(...toVec(lat, (k / seg) * 360 - 180, R * 1.0005).toArray(), ...toVec(lat, ((k + 1) / seg) * 360 - 180, R * 1.0005).toArray());
      }
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let k = 0; k < seg; k++) {
        lines.push(...toVec((k / seg) * 180 - 90, lon, R * 1.0005).toArray(), ...toVec(((k + 1) / seg) * 180 - 90, lon, R * 1.0005).toArray());
      }
    }
    const grid = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(lines, 3)),
      new THREE.LineBasicMaterial({ color: DEEP, transparent: true, opacity: 0.14 }),
    );
    globe.add(grid);
    const sprite = dotTexture();

    // A thin rim of light around the edge.
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.035, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { color: { value: BRAND } },
        vertexShader: `varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 color; varying vec3 vNormal; void main(){ float i = pow(0.6 - dot(vNormal, vec3(0.0,0.0,1.0)), 4.0); gl_FragColor = vec4(color, clamp(i, 0.0, 0.28)); }`,
      }),
    );
    scene.add(rim);

    // The route, the moving pulse and its fading trail.
    const route = new RouteCurve(a, b, 0.42);
    const arc = new THREE.Mesh(
      new THREE.TubeGeometry(route, 160, 0.008, 8, false),
      new THREE.MeshBasicMaterial({ color: DEEP, transparent: true, opacity: 0.7 }),
    );
    globe.add(arc);
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.035, 24, 24), new THREE.MeshBasicMaterial({ color: BRAND }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: BRAND, transparent: true, opacity: 0.55, depthWrite: false }));
    halo.scale.set(0.22, 0.22, 1);
    pulse.add(halo);
    globe.add(pulse);
    const trail = Array.from({ length: 14 }, (_, i) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.016 * (1 - i / 16), 12, 12),
        new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.6 * (1 - i / 14) }),
      );
      globe.add(m);
      return m;
    });

    // The two cities: a dot and a ring that ripples outwards.
    const makeMarker = (at: THREE.Vector3) => {
      const group = new THREE.Group();
      group.position.copy(at.clone().multiplyScalar(1.002));
      group.lookAt(at.clone().multiplyScalar(2));
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), new THREE.MeshBasicMaterial({ color: DEEP }));
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.045, 0.06, 40),
        new THREE.MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
      );
      group.add(dot, ring);
      globe.add(group);
      return ring;
    };
    const ringFrom = makeMarker(a);
    const ringTo = makeMarker(b);

    // Size to the container.
    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Keep the city labels on their markers, and hide one when it turns away.
    const project = (local: THREE.Vector3, label: HTMLDivElement | null) => {
      if (!label) return;
      const world = local.clone().applyQuaternion(globe.quaternion);
      const facingCamera = world.clone().normalize().dot(camera.position.clone().normalize()) > 0.15;
      const screen = world.clone().project(camera);
      label.style.transform = `translate(-50%, -140%) translate(${((screen.x + 1) / 2) * el.clientWidth}px, ${((1 - screen.y) / 2) * el.clientHeight}px)`;
      label.style.opacity = facingCamera ? "1" : "0";
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const wobble = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const clock = new THREE.Clock();
    let frame = 0;
    let visible = true;

    const draw = (elapsed: number) => {
      // The pulse takes 2.4 s per crossing, then rests 0.8 s at the destination while its ring ripples.
      const cycle = 3.2;
      const phase = (elapsed % cycle) / 2.4;
      const t = Math.min(phase, 1);
      pulse.position.copy(route.getPoint(t));
      pulse.visible = phase <= 1;
      trail.forEach((m, i) => {
        const tt = t - (i + 1) * 0.012;
        m.visible = phase <= 1 && tt > 0;
        if (m.visible) m.position.copy(route.getPoint(tt));
      });
      const ripple = (x: number) => 1 + 1.6 * (x % 1);
      ringFrom.scale.setScalar(ripple(elapsed * 0.6));
      (ringFrom.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - ((elapsed * 0.6) % 1));
      const arrived = phase > 1 ? (phase - 1) / 0.33 : 0;
      ringTo.scale.setScalar(1 + 2.2 * arrived);
      (ringTo.material as THREE.MeshBasicMaterial).opacity = phase > 1 ? 0.9 * (1 - arrived) : 0.5;

      // A slow sway and a gentle lean towards the pointer, never far enough to hide either city.
      euler.set(pointer.y * 0.08, Math.sin(elapsed * 0.25) * 0.22 + pointer.x * 0.12, 0);
      wobble.setFromEuler(euler);
      globe.quaternion.copy(base).premultiply(wobble);

      renderer.render(scene, camera);
      project(a, fromLabel.current);
      project(b, toLabel.current);
    };

    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (visible && !document.hidden) draw(clock.getElapsedTime());
    };
    if (reduceMotion) draw(1.4);
    else loop();

    const io = new IntersectionObserver(([entry]) => (visible = entry?.isIntersecting ?? true));
    io.observe(el);

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
      sprite.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={host} className={`relative ${className}`}>
      <div
        ref={fromLabel}
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full border border-line bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm transition-opacity"
      >
        Chennai · Kavya
      </div>
      <div
        ref={toLabel}
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-full border border-line bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-sm transition-opacity"
      >
        Bloomington · Arjun
      </div>
    </div>
  );
}
