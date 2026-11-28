"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import worldAtlasRaw from "world-atlas/countries-110m.json";
import { Cloud, Compass, Grid3X3, Minus, Plus, RotateCcw, SunMoon } from "lucide-react";
import { formatPersen } from "@/lib/format";
import {
  computeMarketSpikeHeight,
  computeSubsolarPoint,
  computeSunDirectionLocal,
  formatGeoCoordinates,
  latLonToSphereCoords,
} from "@/lib/globe-math";
import type { GlobalMarketHubSnapshot, GlobalMarketId } from "@/lib/global-markets";

interface WorldGlobe3DProps {
  hubs: GlobalMarketHubSnapshot[];
  selectedHubId: GlobalMarketId;
  onSelectHub: (id: GlobalMarketId) => void;
  scrollProgressRef?: React.RefObject<number>;
  reducedMotion?: boolean;
}

const DEG2RAD = Math.PI / 180;
const EARTH_RADIUS = 1.0;
const BASE_CAMERA_Z = 3.15;
const MOBILE_CAMERA_Z = 3.48;
const MIN_CAMERA_Z = 2.25;
const MAX_CAMERA_Z = 4.05;
const UP_VECTOR = new THREE.Vector3(0, 1, 0);

function latLonToVector3(lat: number, lon: number, radius: number = EARTH_RADIUS): THREE.Vector3 {
  const c = latLonToSphereCoords(lat, lon, radius);
  return new THREE.Vector3(c.x, c.y, c.z);
}

function getTargetRotationForLatLon(lat: number, lon: number): { rotX: number; rotY: number } {
  const clampedLat = Math.max(-56, Math.min(56, lat));
  return {
    rotX: clampedLat * DEG2RAD,
    rotY: -(lon + 90) * DEG2RAD,
  };
}

function shortestAngleDiff(current: number, target: number): number {
  const twoPi = Math.PI * 2;
  let diff = ((target - current + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
  if (diff < -Math.PI) diff += twoPi;
  return diff;
}

function extractCountryFeatures(): Feature<Polygon | MultiPolygon>[] {
  const topology = worldAtlasRaw as unknown as Topology<{
    countries: GeometryCollection;
  }>;
  const fc = feature(
    topology,
    topology.objects.countries
  ) as unknown as FeatureCollection<Polygon | MultiPolygon>;
  return fc.features || [];
}

function traceRingOnCanvas(
  ctx: CanvasRenderingContext2D,
  ring: Position[],
  width: number,
  height: number
) {
  if (ring.length < 2) return;
  for (let i = 0; i < ring.length; i += 1) {
    const [lon, lat] = ring[i];
    const x = ((lon + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      const [prevLon] = ring[i - 1];
      if (Math.abs(lon - prevLon) > 180) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.closePath();
}

function drawLandMask(
  ctx: CanvasRenderingContext2D,
  features: Feature<Polygon | MultiPolygon>[],
  width: number,
  height: number,
  fillStyle: string,
  strokeStyle?: string
) {
  ctx.beginPath();
  for (const feat of features) {
    const geom = feat.geometry;
    if (!geom) continue;
    if (geom.type === "Polygon") {
      for (const ring of geom.coordinates) traceRingOnCanvas(ctx, ring, width, height);
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        for (const ring of poly) traceRingOnCanvas(ctx, ring, width, height);
      }
    }
  }
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Tekstur fallback prosedural instan saat tekstur NASA sedang di-stream.
 */
function createFallbackTextures(features: Feature<Polygon | MultiPolygon>[]): {
  dayTex: THREE.CanvasTexture;
  nightTex: THREE.CanvasTexture;
  topoTex: THREE.CanvasTexture;
} {
  const w = 1024;
  const h = 512;

  const dayCanvas = document.createElement("canvas");
  dayCanvas.width = w;
  dayCanvas.height = h;
  const dCtx = dayCanvas.getContext("2d")!;
  dCtx.fillStyle = "#0C213D";
  dCtx.fillRect(0, 0, w, h);
  drawLandMask(dCtx, features, w, h, "#273C54", "#3E627A");

  const nightCanvas = document.createElement("canvas");
  nightCanvas.width = w;
  nightCanvas.height = h;
  const nCtx = nightCanvas.getContext("2d")!;
  nCtx.fillStyle = "#000000";
  nCtx.fillRect(0, 0, w, h);

  const topoCanvas = document.createElement("canvas");
  topoCanvas.width = w;
  topoCanvas.height = h;
  const tCtx = topoCanvas.getContext("2d")!;
  tCtx.fillStyle = "#181818";
  tCtx.fillRect(0, 0, w, h);
  drawLandMask(tCtx, features, w, h, "#9A9A9A");

  const dayTex = new THREE.CanvasTexture(dayCanvas);
  dayTex.colorSpace = THREE.SRGBColorSpace;
  const nightTex = new THREE.CanvasTexture(nightCanvas);
  nightTex.colorSpace = THREE.SRGBColorSpace;
  const topoTex = new THREE.CanvasTexture(topoCanvas);

  return { dayTex, nightTex, topoTex };
}

/**
 * Membangun ~5.400 micro-dot benua berbasis Fibonacci Sphere (tanpa penumpukan di kutub)
 * dalam 1 single draw call InstancedMesh ala GitHub / Stripe Globe.
 */
function buildContinentalDotMatrix(
  features: Feature<Polygon | MultiPolygon>[],
  radius: number
): THREE.InstancedMesh {
  const maskW = 720;
  const maskH = 360;
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = maskW;
  maskCanvas.height = maskH;
  const mCtx = maskCanvas.getContext("2d")!;
  mCtx.clearRect(0, 0, maskW, maskH);
  drawLandMask(mCtx, features, maskW, maskH, "#FFFFFF");
  const imgData = mCtx.getImageData(0, 0, maskW, maskH).data;

  const sampleCount = 18500;
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const landMatrices: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < sampleCount; i += 1) {
    const yNorm = 1 - (2 * (i + 0.5)) / sampleCount; // +1 .. -1
    const lat = Math.asin(Math.max(-1, Math.min(1, yNorm))) / DEG2RAD;
    const rawLon = ((i / goldenRatio) % 1) * 360 - 180;
    const px = Math.min(maskW - 1, Math.max(0, Math.floor(((rawLon + 180) / 360) * maskW)));
    const py = Math.min(maskH - 1, Math.max(0, Math.floor(((90 - lat) / 180) * maskH)));
    const alpha = imgData[(py * maskW + px) * 4 + 3];

    if (alpha > 110) {
      const pos = latLonToVector3(lat, rawLon, radius);
      dummy.position.copy(pos);
      dummy.lookAt(pos.clone().multiplyScalar(2));
      dummy.updateMatrix();
      landMatrices.push(dummy.matrix.clone());
    }
  }

  const dotGeo = new THREE.CircleGeometry(0.0044, 6);
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0x5eead4,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const instanced = new THREE.InstancedMesh(dotGeo, dotMat, landMatrices.length);
  for (let i = 0; i < landMatrices.length; i += 1) {
    instanced.setMatrixAt(i, landMatrices[i]);
  }
  instanced.instanceMatrix.needsUpdate = true;
  return instanced;
}

function buildCountryBorderGeometry(
  features: Feature<Polygon | MultiPolygon>[],
  radius: number
): THREE.BufferGeometry {
  const positions: number[] = [];

  const pushRing = (ring: Position[]) => {
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [lonA, latA] = ring[i];
      const [lonB, latB] = ring[i + 1];
      if (Math.abs(lonB - lonA) > 180) continue;
      const a = latLonToVector3(latA, lonA, radius);
      const b = latLonToVector3(latB, lonB, radius);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  };

  for (const feat of features) {
    const geom = feat.geometry;
    if (!geom) continue;
    if (geom.type === "Polygon") {
      for (const ring of geom.coordinates) pushRing(ring);
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        for (const ring of poly) pushRing(ring);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/**
 * Custom GLSL Dark Orbital Earth Shader:
 * - Color-grades NASA Blue Marble ke palet Obsidian Sapphire + Steel Slate (tanpa pantulan plastik!)
 * - Real-time topographic micro-hillshading dari earth-topology.png
 * - Real-time UTC Day/Night Terminator dengan golden twilight band & NASA Black Marble city lights
 * - Built-in front atmospheric rim scattering
 */
function createOrbitalEarthMaterial(
  dayTex: THREE.Texture,
  nightTex: THREE.Texture,
  topoTex: THREE.Texture,
  sunDirLocal: THREE.Vector3
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: dayTex },
      uNightMap: { value: nightTex },
      uTopoMap: { value: topoTex },
      uSunDirLocal: { value: sunDirLocal.clone().normalize() },
      uSolarMode: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vLocalNormal;
      varying vec3 vViewNormal;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        vLocalNormal = normalize(normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uDayMap;
      uniform sampler2D uNightMap;
      uniform sampler2D uTopoMap;
      uniform vec3 uSunDirLocal;
      uniform float uSolarMode;

      varying vec2 vUv;
      varying vec3 vLocalNormal;
      varying vec3 vViewNormal;
      varying vec3 vViewDir;

      void main() {
        vec3 rawDay = texture2D(uDayMap, vUv).rgb;
        vec3 rawNight = texture2D(uNightMap, vUv).rgb;
        float topoC = texture2D(uTopoMap, vUv).r;
        float topoR = texture2D(uTopoMap, vUv + vec2(0.0012, 0.0)).r;
        float topoU = texture2D(uTopoMap, vUv + vec2(0.0, 0.0022)).r;

        // Deteksi lautan vs kontinen dari NASA Blue Marble + elevasi topografi
        float blueDominance = rawDay.b - max(rawDay.r, rawDay.g) * 0.86;
        float oceanMask = smoothstep(0.015, 0.12, blueDominance) * (1.0 - smoothstep(0.08, 0.22, topoC));
        float landMask = 1.0 - oceanMask;

        // Micro-hillshade dari gradien topografi untuk relief pegunungan 3D halus
        float slopeX = (topoR - topoC) * 4.2;
        float slopeY = (topoU - topoC) * 4.2;
        float reliefShade = clamp(1.0 + (slopeX * 0.65 - slopeY * 0.55) * landMask, 0.72, 1.38);

        // Color-grading siang bergaya Dark Orbital Obsidian-Sapphire (terbaca jelas, tanpa glare plastik)
        float dayLum = dot(rawDay, vec3(0.299, 0.587, 0.114));
        vec3 oceanDay = mix(vec3(0.032, 0.078, 0.145), vec3(0.068, 0.155, 0.255), clamp(dayLum * 2.1, 0.0, 1.0));
        vec3 landBase = mix(vec3(0.115, 0.185, 0.255), vec3(0.235, 0.355, 0.435), clamp(dayLum * 1.45 + topoC * 0.45, 0.0, 1.0));
        vec3 landDay = mix(landBase, rawDay * vec3(0.55, 0.72, 0.82), 0.24) * reliefShade;
        vec3 gradedDay = mix(landDay, oceanDay, oceanMask);

        // Sisi malam: lautan & daratan midnight pekat + lampu kota emas NASA Black Marble (core + soft bloom halo)
        vec3 oceanNight = vec3(0.014, 0.028, 0.058);
        vec3 landNight = vec3(0.036, 0.058, 0.095) * (0.85 + topoC * 0.35);
        vec3 nightBase = mix(landNight, oceanNight, oceanMask);

        vec3 nBlur = (
          texture2D(uNightMap, vUv + vec2(0.0014, 0.0)).rgb +
          texture2D(uNightMap, vUv - vec2(0.0014, 0.0)).rgb +
          texture2D(uNightMap, vUv + vec2(0.0, 0.0022)).rgb +
          texture2D(uNightMap, vUv - vec2(0.0, 0.0022)).rgb
        ) * 0.25;

        float coreWarm = max(0.0, rawNight.r - rawNight.b * 0.66) + max(0.0, rawNight.g - rawNight.b * 0.78) * 0.55;
        float haloWarm = max(0.0, nBlur.r - nBlur.b * 0.66) + max(0.0, nBlur.g - nBlur.b * 0.78) * 0.55;
        float cityCore = smoothstep(0.032, 0.25, coreWarm);
        float cityHalo = smoothstep(0.022, 0.22, haloWarm);
        vec3 goldLights = vec3(1.0, 0.87, 0.48) * cityCore * 2.05 + vec3(0.96, 0.56, 0.14) * cityHalo * 0.92;
        vec3 gradedNight = nightBase + goldLights;

        // Real-time Solar Day/Night Terminator
        float sunDot = dot(normalize(vLocalNormal), normalize(uSunDirLocal));
        float realDayMix = smoothstep(-0.20, 0.24, sunDot);
        float dayMix = mix(0.84, realDayMix, uSolarMode);

        // Pencahayaan difus lembut di sisi siang
        float diffuseLift = mix(0.86, 1.16, smoothstep(-0.1, 0.9, sunDot));
        vec3 surfaceColor = mix(gradedNight, gradedDay * diffuseLift, dayMix);

        // Pita senja (Dual-Tone Twilight): emas hangat di sisi gelap + cyan orbital di tepi siang
        float sunsetBand = exp(-pow((sunDot + 0.05) * 6.4, 2.0)) * uSolarMode;
        float dawnScatter = exp(-pow((sunDot - 0.085) * 5.0, 2.0)) * uSolarMode;
        surfaceColor += vec3(0.98, 0.50, 0.15) * sunsetBand * (0.34 + 0.16 * landMask);
        surfaceColor += vec3(0.14, 0.74, 0.92) * dawnScatter * 0.24;

        // Pendar atmosfer tipis menyatu di tepi bola bumi (subtle front Fresnel scattering)
        float ndotv = clamp(dot(normalize(vViewNormal), normalize(vViewDir)), 0.0, 1.0);
        float frontRim = pow(1.0 - ndotv, 3.6);
        vec3 rimColor = mix(vec3(0.11, 0.68, 0.72), vec3(0.24, 0.72, 0.96), dayMix * 0.55);
        surfaceColor += rimColor * frontRim * (0.34 + 0.28 * dayMix);

        gl_FragColor = vec4(surfaceColor, 1.0);
      }
    `,
  });
}

/**
 * Ultra-thin realistic outer atmosphere halo (menggantikan cincin neon tebal sebelumnya).
 */
function createThinAtmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColorInner: { value: new THREE.Color("#2DD4BF") },
      uColorOuter: { value: new THREE.Color("#38BDF8") },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColorInner;
      uniform vec3 uColorOuter;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float rim = clamp(0.56 - dot(vNormal, vViewDir), 0.0, 1.0);
        float intensity = pow(rim, 3.9) * 0.85;
        vec3 col = mix(uColorOuter, uColorInner, clamp(rim * 1.8, 0.0, 1.0));
        gl_FragColor = vec4(col, intensity);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Custom GLSL Animated Comet Trail Material untuk 3D Tube Arcs menuju Jakarta.
 */
function createCometArcMaterial(
  colorHex: number,
  isSelected: boolean,
  phaseOffset: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uTime: { value: 0 },
      uPhase: { value: phaseOffset },
      uBaseOpacity: { value: isSelected ? 0.42 : 0.16 },
      uCometBoost: { value: isSelected ? 1.0 : 0.72 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uPhase;
      uniform float uBaseOpacity;
      uniform float uCometBoost;
      varying vec2 vUv;

      void main() {
        // Memudar lembut di kedua ujung arc
        float endFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);

        // Komet cahaya berjalan dari bursa asal (0.0) menuju Jakarta (1.0)
        float head = fract(uTime * 0.32 + uPhase);
        float distBehind = head - vUv.x;
        if (distBehind < 0.0) distBehind += 1.0;

        float cometTail = smoothstep(0.26, 0.0, distBehind) * uCometBoost;
        float headSpark = exp(-distBehind * 42.0) * uCometBoost;

        float alpha = clamp((uBaseOpacity + cometTail * 0.78 + headSpark * 0.6) * endFade, 0.0, 1.0);
        vec3 finalCol = mix(uColor, vec3(0.88, 1.0, 0.98), clamp(headSpark * 0.85, 0.0, 1.0));
        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

function createGreatCircleArcCurve(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): THREE.QuadraticBezierCurve3 {
  const start = latLonToVector3(fromLat, fromLon, EARTH_RADIUS * 1.008);
  const end = latLonToVector3(toLat, toLon, EARTH_RADIUS * 1.008);
  const angle = start.angleTo(end);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  if (mid.lengthSq() < 0.0001) mid.set(0, 1, 0);
  const altitude = EARTH_RADIUS + 0.15 + Math.min(0.42, angle * 0.21);
  mid.normalize().multiplyScalar(altitude);
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

/**
 * Hybrid Dark Orbital Earth 3D Globe (Gabungan Opsi A + Opsi B):
 * - NASA Blue Marble + Black Marble Night Lights + Topology Relief + Drifting Clouds
 * - Custom GLSL Real-Time UTC Day/Night Terminator + Golden Twilight Band
 * - ~5.400 Fibonacci Instanced Micro-Dots benua (1 draw call)
 * - Glowing 3D Tube Arcs dengan Animated Comet Trail ke Jakarta (IDX)
 * - 3D Vertical Market Spikes + Radar Ripples + Anti-Overlap Telemetry Labels
 */
export const WorldGlobe3D: React.FC<WorldGlobe3DProps> = ({
  hubs,
  selectedHubId,
  onSelectHub,
  scrollProgressRef,
  reducedMotion = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelElsRef = useRef<Map<GlobalMarketId, HTMLButtonElement>>(new Map());
  const onSelectHubRef = useRef(onSelectHub);
  const hubsRef = useRef(hubs);
  const selectedHubIdRef = useRef(selectedHubId);
  const reducedMotionRef = useRef(reducedMotion);

  const [webglFailed, setWebglFailed] = useState(false);
  const [solarMode, setSolarMode] = useState(true);
  const [showClouds, setShowClouds] = useState(true);
  const [showDots, setShowDots] = useState(true);

  const solarModeRef = useRef(solarMode);
  const showCloudsRef = useRef(showClouds);
  const showDotsRef = useRef(showDots);

  useEffect(() => {
    onSelectHubRef.current = onSelectHub;
  }, [onSelectHub]);

  useEffect(() => {
    hubsRef.current = hubs;
  }, [hubs]);

  useEffect(() => {
    selectedHubIdRef.current = selectedHubId;
  }, [selectedHubId]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    solarModeRef.current = solarMode;
  }, [solarMode]);

  useEffect(() => {
    showCloudsRef.current = showClouds;
  }, [showClouds]);

  useEffect(() => {
    showDotsRef.current = showDots;
  }, [showDots]);

  const targetRotRef = useRef<{ rotX: number; rotY: number }>(
    getTargetRotationForLatLon(-6.2088, 106.8456)
  );
  const targetZoomRef = useRef<number>(BASE_CAMERA_Z);
  const userInteractedAtRef = useRef<number>(0);

  useEffect(() => {
    const activeHub = hubs.find((h) => h.id === selectedHubId);
    if (!activeHub) return;
    targetRotRef.current = getTargetRotationForLatLon(activeHub.lat, activeHub.lon);
    userInteractedAtRef.current = Date.now();
  }, [selectedHubId, hubs]);

  const handleZoomIn = useCallback(() => {
    targetZoomRef.current = Math.max(MIN_CAMERA_Z, targetZoomRef.current - 0.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    targetZoomRef.current = Math.min(MAX_CAMERA_Z, targetZoomRef.current + 0.3);
  }, []);

  const handleResetView = useCallback(() => {
    const w = containerRef.current?.clientWidth ?? 640;
    targetZoomRef.current = w < 460 ? MOBILE_CAMERA_Z : BASE_CAMERA_Z;
    const activeHub = hubsRef.current.find((h) => h.id === selectedHubIdRef.current);
    targetRotRef.current = activeHub
      ? getTargetRotationForLatLon(activeHub.lat, activeHub.lon)
      : getTargetRotationForLatLon(-6.2088, 106.8456);
  }, []);

  const countryFeatures = useMemo(() => extractCountryFeatures(), []);
  const selectedHub = useMemo(
    () => hubs.find((h) => h.id === selectedHubId) ?? hubs[0],
    [hubs, selectedHubId]
  );

  const [solarUtcLabel, setSolarUtcLabel] = useState<string>(
    () => computeSubsolarPoint().utcTimeLabel
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setSolarUtcLabel(computeSubsolarPoint().utcTimeLabel);
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const highlightUpdaterRef = useRef<((isoNumeric: string) => void) | null>(null);
  const dynamicDataUpdaterRef = useRef<
    ((nextHubs: GlobalMarketHubSnapshot[], nextSelectedId: GlobalMarketId) => void) | null
  >(null);

  useEffect(() => {
    const hub = hubs.find((h) => h.id === selectedHubId);
    if (hub && highlightUpdaterRef.current) {
      highlightUpdaterRef.current(hub.isoNumeric);
    }
    if (dynamicDataUpdaterRef.current) {
      dynamicDataUpdaterRef.current(hubs, selectedHubId);
    }
  }, [hubs, selectedHubId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setWebglFailed(true));
      return;
    }

    const initWidth = Math.max(280, container.clientWidth);
    const initHeight = Math.max(320, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initWidth, initHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initCameraZ = initWidth < 460 ? MOBILE_CAMERA_Z : BASE_CAMERA_Z;
    targetZoomRef.current = initCameraZ;
    const camera = new THREE.PerspectiveCamera(40, initWidth / initHeight, 0.1, 30);
    camera.position.set(0, 0, initCameraZ);

    // Starfield depth parallax layer
    const starCount = 460;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const r = 4.6 + ((i * 7919) % 1000) / 300;
      const theta = (((i * 104729) % 1000) / 1000) * Math.PI * 2;
      const phi = Math.acos(2 * (((i * 3571) % 1000) / 1000) - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xcffafe,
      size: 0.02,
      transparent: true,
      opacity: 0.42,
      sizeAttenuation: true,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Root Globe Group
    const globeGroup = new THREE.Group();
    globeGroup.rotation.order = "XYZ";
    globeGroup.rotation.x = targetRotRef.current.rotX;
    globeGroup.rotation.y = targetRotRef.current.rotY;
    scene.add(globeGroup);

    // 1. Orbital Earth with Custom GLSL Day/Night Terminator Shader
    const fallbacks = createFallbackTextures(countryFeatures);
    const sunInit = computeSunDirectionLocal();
    const sunVec = new THREE.Vector3(sunInit.x, sunInit.y, sunInit.z).normalize();

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 80, 80);
    const earthMat = createOrbitalEarthMaterial(
      fallbacks.dayTex,
      fallbacks.nightTex,
      fallbacks.topoTex,
      sunVec
    );
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // 2. Drifting Satellite Cloud Layer (r = 1.012)
    const cloudsGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 64, 64);
    const cloudsMat = new THREE.MeshBasicMaterial({
      color: 0xd8f3ff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    globeGroup.add(cloudsMesh);

    // Load local public-domain NASA textures asynchronously (same-origin, zero CORS)
    const loader = new THREE.TextureLoader();
    const loadedTextures: THREE.Texture[] = [];
    let disposed = false;

    const loadTex = (url: string, isColor: boolean, onReady: (tex: THREE.Texture) => void) => {
      loader.load(
        url,
        (tex) => {
          if (disposed) {
            tex.dispose();
            return;
          }
          if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          loadedTextures.push(tex);
          onReady(tex);
        },
        undefined,
        () => {
          // Graceful fallback stays active if texture fails
        }
      );
    };

    loadTex("/textures/earth-day.jpg", true, (tex) => {
      earthMat.uniforms.uDayMap.value = tex;
    });
    loadTex("/textures/earth-night.jpg", false, (tex) => {
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      earthMat.uniforms.uNightMap.value = tex;
    });
    loadTex("/textures/earth-topology.png", false, (tex) => {
      earthMat.uniforms.uTopoMap.value = tex;
    });
    loadTex("/textures/earth-clouds.png", false, (tex) => {
      cloudsMat.alphaMap = tex;
      cloudsMat.map = tex;
      cloudsMat.opacity = 0.16;
      cloudsMat.needsUpdate = true;
    });

    // 3. Subtle Continental Micro-Dot Matrix (InstancedMesh, 1 draw call)
    const dotMatrixMesh = buildContinentalDotMatrix(countryFeatures, EARTH_RADIUS * 1.0035);
    globeGroup.add(dotMatrixMesh);

    // 4. Crisp Country Borders + Glowing Active Country Highlight
    const allBordersGeo = buildCountryBorderGeometry(countryFeatures, EARTH_RADIUS * 1.0025);
    const allBordersMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.11,
    });
    const allBordersLines = new THREE.LineSegments(allBordersGeo, allBordersMat);
    globeGroup.add(allBordersLines);

    let highlightLines: THREE.LineSegments | null = null;
    const highlightMat = new THREE.LineBasicMaterial({
      color: 0x5eead4,
      transparent: true,
      opacity: 0.95,
    });

    const updateHighlightCountry = (isoNumeric: string) => {
      if (highlightLines) {
        globeGroup.remove(highlightLines);
        highlightLines.geometry.dispose();
        highlightLines = null;
      }
      const matched = countryFeatures.filter(
        (f) => String(f.id ?? "").padStart(3, "0") === isoNumeric
      );
      if (matched.length === 0) return;
      const geo = buildCountryBorderGeometry(matched, EARTH_RADIUS * 1.006);
      highlightLines = new THREE.LineSegments(geo, highlightMat);
      globeGroup.add(highlightLines);
    };
    highlightUpdaterRef.current = updateHighlightCountry;

    // 5. Thin Realistic Outer Fresnel Atmosphere Halo (r = 1.055)
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.055, 64, 64);
    const atmosMat = createThinAtmosphereMaterial();
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // Subtle Orbital Telemetry Ring
    const ringGeo = new THREE.RingGeometry(EARTH_RADIUS * 1.19, EARTH_RADIUS * 1.193, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
    });
    const orbitalRing = new THREE.Mesh(ringGeo, ringMat);
    orbitalRing.rotation.x = Math.PI / 2 - 0.2;
    orbitalRing.rotation.y = 0.24;
    scene.add(orbitalRing);

    // 6. 3D Vertical Market Spikes, Radar Ripples & Glowing Tube Arcs
    interface MarkerEntry {
      id: GlobalMarketId;
      tipPos: THREE.Vector3;
      basePos: THREE.Vector3;
      ringMeshA: THREE.Mesh;
      ringMeshB: THREE.Mesh;
      isOpen: boolean;
    }

    const markersGroup = new THREE.Group();
    const arcsGroup = new THREE.Group();
    globeGroup.add(markersGroup);
    globeGroup.add(arcsGroup);

    const markerEntries: MarkerEntry[] = [];
    const cometMaterials: THREE.ShaderMaterial[] = [];
    const dynamicDisposables: (THREE.BufferGeometry | THREE.Material)[] = [];
    const hitMeshes: THREE.Mesh[] = [];

    const capGeo = new THREE.SphereGeometry(0.011, 14, 14);
    const hitGeo = new THREE.SphereGeometry(0.072, 12, 12);
    const pulseRingGeo = new THREE.RingGeometry(0.018, 0.026, 28);

    const jakartaHub = hubsRef.current.find((h) => h.id === "ID");
    const jktLat = jakartaHub?.lat ?? -6.2088;
    const jktLon = jakartaHub?.lon ?? 106.8456;

    const clearDynamicVisuals = () => {
      while (markersGroup.children.length > 0) markersGroup.remove(markersGroup.children[0]);
      while (arcsGroup.children.length > 0) arcsGroup.remove(arcsGroup.children[0]);
      for (const d of dynamicDisposables) d.dispose();
      dynamicDisposables.length = 0;
      markerEntries.length = 0;
      cometMaterials.length = 0;
      hitMeshes.length = 0;
    };

    const rebuildHubVisuals = (
      currentHubs: GlobalMarketHubSnapshot[],
      activeId: GlobalMarketId
    ) => {
      clearDynamicVisuals();

      currentHubs.forEach((hub, index) => {
        const basePos = latLonToVector3(hub.lat, hub.lon, EARTH_RADIUS * 1.006);
        const normal = basePos.clone().normalize();
        const isSelected = hub.id === activeId;
        const isUp = hub.primaryIndex.changePercent >= 0;
        const accentHex = isSelected ? 0x2dd4bf : isUp ? 0x22c55e : 0xef4444;

        // 3D Vertical Market Spike rising radially from the exchange
        const spikeHeight = computeMarketSpikeHeight(hub.primaryIndex.changePercent, isSelected);
        const spikeGeo = new THREE.CylinderGeometry(
          isSelected ? 0.0042 : 0.0026,
          isSelected ? 0.0085 : 0.0058,
          spikeHeight,
          10
        );
        const spikeMat = new THREE.MeshBasicMaterial({
          color: accentHex,
          transparent: true,
          opacity: isSelected ? 0.95 : 0.78,
        });
        dynamicDisposables.push(spikeGeo, spikeMat);

        const spikeMesh = new THREE.Mesh(spikeGeo, spikeMat);
        spikeMesh.position.copy(basePos).addScaledVector(normal, spikeHeight * 0.5);
        spikeMesh.quaternion.setFromUnitVectors(UP_VECTOR, normal);
        markersGroup.add(spikeMesh);

        // Luminous orb tip at the top of the spike
        const tipPos = basePos.clone().addScaledVector(normal, spikeHeight + 0.004);
        const capMat = new THREE.MeshBasicMaterial({
          color: isSelected ? 0x99f6e4 : accentHex,
        });
        dynamicDisposables.push(capMat);
        const capMesh = new THREE.Mesh(capGeo, capMat);
        capMesh.position.copy(tipPos);
        if (isSelected) capMesh.scale.setScalar(1.35);
        markersGroup.add(capMesh);

        // Dual Concentric Surface Radar Ripples
        const rMatA = new THREE.MeshBasicMaterial({
          color: accentHex,
          transparent: true,
          opacity: isSelected ? 0.8 : hub.session.isOpen ? 0.6 : 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const rMatB = new THREE.MeshBasicMaterial({
          color: accentHex,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        dynamicDisposables.push(rMatA, rMatB);

        const ringMeshA = new THREE.Mesh(pulseRingGeo, rMatA);
        ringMeshA.position.copy(basePos.clone().multiplyScalar(1.002));
        ringMeshA.lookAt(basePos.clone().multiplyScalar(2));
        markersGroup.add(ringMeshA);

        const ringMeshB = new THREE.Mesh(pulseRingGeo, rMatB);
        ringMeshB.position.copy(basePos.clone().multiplyScalar(1.003));
        ringMeshB.lookAt(basePos.clone().multiplyScalar(2));
        markersGroup.add(ringMeshB);

        // Invisible Raycast Hit Sphere
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        dynamicDisposables.push(hitMat);
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.position.copy(tipPos);
        hitMesh.userData = { hubId: hub.id };
        markersGroup.add(hitMesh);
        hitMeshes.push(hitMesh);

        markerEntries.push({
          id: hub.id,
          tipPos,
          basePos,
          ringMeshA,
          ringMeshB,
          isOpen: hub.session.isOpen,
        });

        // Glowing 3D Tube Arc menuju Jakarta dengan Animated Comet Trail
        if (hub.id !== "ID") {
          const curve = createGreatCircleArcCurve(hub.lat, hub.lon, jktLat, jktLon);
          const tubeRadius = isSelected ? 0.0052 : 0.003;
          const tubeGeo = new THREE.TubeGeometry(curve, 52, tubeRadius, 7, false);
          const cometMat = createCometArcMaterial(accentHex, isSelected, (index * 0.13) % 1);
          dynamicDisposables.push(tubeGeo, cometMat);
          cometMaterials.push(cometMat);

          const tubeMesh = new THREE.Mesh(tubeGeo, cometMat);
          arcsGroup.add(tubeMesh);
        }
      });
    };

    dynamicDataUpdaterRef.current = rebuildHubVisuals;
    rebuildHubVisuals(hubsRef.current, selectedHubIdRef.current);
    const initialHub = hubsRef.current.find((h) => h.id === selectedHubIdRef.current);
    if (initialHub) {
      updateHighlightCountry(initialHub.isoNumeric);
    }

    // Pointer Interaction (Drag rotates, click selects pin, hover drives subtle camera parallax)
    let isDragging = false;
    let dragDistance = 0;
    let prevX = 0;
    let prevY = 0;
    const pointerNdc = new THREE.Vector2(0, 0);
    const pointerParallax = { targetX: 0, targetY: 0, curX: 0, curY: 0 };
    const raycaster = new THREE.Raycaster();

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragDistance = 0;
      prevX = e.clientX;
      prevY = e.clientY;
      userInteractedAtRef.current = Date.now();
      renderer.domElement.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointerNdc.set(nx, ny);
      pointerParallax.targetX = nx * 0.11;
      pointerParallax.targetY = ny * 0.075;

      if (isDragging) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        dragDistance += Math.hypot(dx, dy);
        prevX = e.clientX;
        prevY = e.clientY;

        targetRotRef.current.rotY += dx * 0.0065;
        targetRotRef.current.rotX = Math.max(
          -1.05,
          Math.min(1.05, targetRotRef.current.rotX + dy * 0.0055)
        );
        userInteractedAtRef.current = Date.now();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDragging && dragDistance < 6) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(hitMeshes, false);
        if (hits.length > 0) {
          const hubId = hits[0].object.userData?.hubId as GlobalMarketId | undefined;
          if (hubId) onSelectHubRef.current(hubId);
        }
      }
      isDragging = false;
      if (renderer.domElement.hasPointerCapture(e.pointerId)) {
        renderer.domElement.releasePointerCapture(e.pointerId);
      }
    };

    const onPointerLeave = () => {
      pointerParallax.targetX = 0;
      pointerParallax.targetY = 0;
    };

    // Ctrl+Wheel zooms; plain scroll flows cleanly to Scroll-Linked Parallax
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      targetZoomRef.current = Math.max(
        MIN_CAMERA_Z,
        Math.min(MAX_CAMERA_Z, targetZoomRef.current + e.deltaY * 0.002)
      );
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height);
      renderer.render(scene, camera);
    });
    resizeObserver.observe(container);

    let isVisible = true;
    let isTabVisible = !document.hidden;
    let rafId = 0;
    let lastFrameMs = performance.now();
    let elapsedSec = 0;
    let lastSunSyncMs = 0;

    const worldPosScratch = new THREE.Vector3();
    const camDirScratch = new THREE.Vector3();
    const projScratch = new THREE.Vector3();

    const animate = () => {
      if (disposed || !isVisible || !isTabVisible) {
        rafId = 0;
        return;
      }

      rafId = window.requestAnimationFrame(animate);
      const nowMs = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
      lastFrameMs = nowMs;
      elapsedSec += dt;
      const elapsed = elapsedSec;
      const isReduced = reducedMotionRef.current;

      // Sync live UTC sun direction every 30s & smooth solarMode toggle
      if (nowMs - lastSunSyncMs > 30_000) {
        lastSunSyncMs = nowMs;
        const s = computeSunDirectionLocal();
        earthMat.uniforms.uSunDirLocal.value.set(s.x, s.y, s.z).normalize();
      }
      const targetSolar = solarModeRef.current ? 1.0 : 0.0;
      earthMat.uniforms.uSolarMode.value +=
        (targetSolar - earthMat.uniforms.uSolarMode.value) * Math.min(1, dt * 6);

      // Toggle layers cleanly without recreating geometry
      cloudsMesh.visible = showCloudsRef.current;
      dotMatrixMesh.visible = showDotsRef.current;

      // Drifting satellite clouds
      if (!isReduced && cloudsMesh.visible) {
        cloudsMesh.rotation.y += dt * 0.009;
      }

      // Scroll-coupled parallax pitch & subtle camera pull-back
      const scrollP = isReduced ? 0 : Math.max(0, Math.min(1, scrollProgressRef?.current ?? 0));

      const idleMs = Date.now() - userInteractedAtRef.current;
      if (!isDragging && !isReduced && idleMs > 6500) {
        targetRotRef.current.rotY += dt * 0.055;
      }

      const desiredRotX = targetRotRef.current.rotX + scrollP * 0.22;
      const desiredRotY = targetRotRef.current.rotY + scrollP * 0.18;

      globeGroup.rotation.x += (desiredRotX - globeGroup.rotation.x) * Math.min(1, dt * 6.5);
      globeGroup.rotation.y +=
        shortestAngleDiff(globeGroup.rotation.y, desiredRotY) * Math.min(1, dt * 6.5);

      // Pointer parallax on camera & starfield
      pointerParallax.curX += (pointerParallax.targetX - pointerParallax.curX) * Math.min(1, dt * 5);
      pointerParallax.curY += (pointerParallax.targetY - pointerParallax.curY) * Math.min(1, dt * 5);

      const desiredZ = targetZoomRef.current + scrollP * 0.34;
      camera.position.z += (desiredZ - camera.position.z) * Math.min(1, dt * 6);
      camera.position.x = isReduced ? 0 : pointerParallax.curX;
      camera.position.y = isReduced ? 0 : pointerParallax.curY;
      camera.lookAt(0, 0, 0);

      starField.rotation.y = elapsed * (isReduced ? 0 : 0.007) - pointerParallax.curX * 0.35;
      starField.rotation.x = pointerParallax.curY * 0.35;
      orbitalRing.rotation.z = elapsed * (isReduced ? 0 : 0.035);

      // Animate comet trails along all 3D tube arcs
      const shaderTime = isReduced ? 0.5 : elapsed;
      for (const cm of cometMaterials) {
        cm.uniforms.uTime.value = shaderTime;
      }

      // Animate dual concentric radar ripples on surface
      for (const m of markerEntries) {
        const isSel = m.id === selectedHubIdRef.current;
        if (!isReduced && (m.isOpen || isSel)) {
          const speed = isSel ? 1.15 : 0.85;
          const wA = ((elapsed * speed + m.basePos.x) % 1 + 1) % 1;
          const wB = (wA + 0.5) % 1;
          const maxScale = isSel ? 2.8 : 2.1;

          m.ringMeshA.scale.setScalar(1 + wA * maxScale);
          (m.ringMeshA.material as THREE.MeshBasicMaterial).opacity =
            (1 - wA) * (isSel ? 0.85 : 0.58);

          m.ringMeshB.scale.setScalar(1 + wB * maxScale);
          (m.ringMeshB.material as THREE.MeshBasicMaterial).opacity =
            (1 - wB) * (isSel ? 0.65 : 0.42);
        } else {
          m.ringMeshA.scale.setScalar(1.1);
          (m.ringMeshA.material as THREE.MeshBasicMaterial).opacity = 0.22;
          (m.ringMeshB.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      }

      renderer.render(scene, camera);

      // Project 3D spike tips to HTML HUD labels with 4-pass collision separation
      const canvasW = renderer.domElement.clientWidth;
      const canvasH = renderer.domElement.clientHeight;
      globeGroup.updateMatrixWorld();

      interface ProjectedLabel {
        id: GlobalMarketId;
        el: HTMLButtonElement;
        x: number;
        y: number;
        fade: number;
        priority: number;
      }

      const visibleLabels: ProjectedLabel[] = [];

      for (const m of markerEntries) {
        const el = labelElsRef.current.get(m.id);
        if (!el) continue;

        worldPosScratch.copy(m.tipPos).applyMatrix4(globeGroup.matrixWorld);
        camDirScratch.copy(camera.position).sub(worldPosScratch).normalize();
        const surfaceNormal = worldPosScratch.clone().normalize();
        const facing = surfaceNormal.dot(camDirScratch);

        if (facing > 0.16) {
          projScratch.copy(worldPosScratch).project(camera);
          const sx = (projScratch.x * 0.5 + 0.5) * canvasW;
          const sy = (-projScratch.y * 0.5 + 0.5) * canvasH;
          const fade = Math.min(1, (facing - 0.16) / 0.24);
          visibleLabels.push({
            id: m.id,
            el,
            x: sx,
            y: sy,
            fade,
            priority: m.id === selectedHubIdRef.current ? 10 : facing,
          });
        } else {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
        }
      }

      visibleLabels.sort((a, b) => b.priority - a.priority);
      const minDx = 76;
      const minDy = 24;
      for (let pass = 0; pass < 4; pass += 1) {
        for (let i = 0; i < visibleLabels.length; i += 1) {
          for (let j = i + 1; j < visibleLabels.length; j += 1) {
            const a = visibleLabels[i];
            const b = visibleLabels[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            if (Math.abs(dx) < minDx && Math.abs(dy) < minDy) {
              const pushY = dy >= 0 ? minDy - dy : -(minDy + dy);
              b.y += pushY * 0.78;
              if (Math.abs(dx) < minDx * 0.65) {
                b.x += (dx >= 0 ? 1 : -1) * 10;
              }
            }
          }
        }
      }

      const minTopY = canvasW < 440 ? 66 : 46;
      for (const lbl of visibleLabels) {
        const cx = Math.max(46, Math.min(canvasW - 46, lbl.x));
        const cy = Math.max(minTopY, Math.min(canvasH - 46, lbl.y));
        lbl.el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translate(-50%, -118%)`;
        lbl.el.style.opacity = lbl.fade.toFixed(2);
        lbl.el.style.pointerEvents = "auto";
      }
    };

    const startLoop = () => {
      if (!disposed && isVisible && isTabVisible && rafId === 0) {
        lastFrameMs = performance.now();
        animate();
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        isVisible = Boolean(entries[0]?.isIntersecting);
        if (isVisible) startLoop();
      },
      { threshold: 0.05 }
    );
    io.observe(container);

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) startLoop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    startLoop();

    return () => {
      disposed = true;
      highlightUpdaterRef.current = null;
      dynamicDataUpdaterRef.current = null;
      if (rafId) window.cancelAnimationFrame(rafId);
      io.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("wheel", onWheel);

      clearDynamicVisuals();
      earthGeo.dispose();
      earthMat.dispose();
      cloudsGeo.dispose();
      cloudsMat.dispose();
      fallbacks.dayTex.dispose();
      fallbacks.nightTex.dispose();
      fallbacks.topoTex.dispose();
      for (const t of loadedTextures) t.dispose();
      dotMatrixMesh.geometry.dispose();
      (dotMatrixMesh.material as THREE.Material).dispose();
      allBordersGeo.dispose();
      allBordersMat.dispose();
      highlightMat.dispose();
      if (highlightLines) highlightLines.geometry.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      capGeo.dispose();
      hitGeo.dispose();
      pulseRingGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [countryFeatures, scrollProgressRef]);

  if (webglFailed) {
    return (
      <div className="w-full h-full min-h-[340px] flex flex-col items-center justify-center p-5 bg-[#080B12] rounded-lg border border-white/[0.06] text-center space-y-3">
        <Compass className="w-7 h-7 text-[#2DD4BF]" />
        <p className="text-xs text-slate-300 font-medium">
          WebGL tidak tersedia di perangkat ini — gunakan pemilih negara cepat:
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
          {hubs.map((hub) => {
            const isSel = hub.id === selectedHubId;
            return (
              <button
                key={hub.id}
                type="button"
                onClick={() => onSelectHub(hub.id)}
                className={`px-2.5 py-1.5 rounded-md border text-[11px] font-mono transition ${
                  isSel
                    ? "bg-[#1E7B85] border-[#2DD4BF] text-white font-semibold"
                    : "bg-[#0F131C] border-white/[0.08] text-slate-300 hover:border-white/[0.2]"
                }`}
              >
                {hub.id} {formatPersen(hub.primaryIndex.changePercent, 1, true)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[340px] sm:min-h-[405px] select-none overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_48%,rgba(14,42,66,0.34),rgba(7,10,16,0.98)_72%)]">
      {/* Kanvas WebGL Three.js */}
      <div
        ref={containerRef}
        aria-label="Peta Bola Dunia 3D Pasar Saham Global Interaktif"
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />

      {/* HUD Kiri Atas: Telemetri Koordinat & Matahari UTC */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 z-20 flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0B0E15]/78 backdrop-blur-md border border-white/[0.07] text-[10px] font-mono tnum text-slate-300">
        {selectedHub && (
          <>
            <span className="text-[#2DD4BF] font-semibold">{selectedHub.id}</span>
            <span>{formatGeoCoordinates(selectedHub.lat, selectedHub.lon)}</span>
          </>
        )}
        <span className="hidden sm:inline text-slate-600">&bull;</span>
        <span className="hidden sm:inline text-slate-400">{solarUtcLabel}</span>
      </div>

      {/* HUD Kanan Atas: Toggle Layer (Siang/Malam, Awan, Titik) */}
      <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-[#0B0E15]/82 backdrop-blur-md border border-white/[0.08] p-1 rounded-md text-[10px] font-sans">
        <button
          type="button"
          onClick={() => setSolarMode((v) => !v)}
          aria-pressed={solarMode}
          title="Toggle pencahayaan Siang/Malam UTC real-time"
          className={`inline-flex items-center gap-1 px-1.5 py-1 rounded transition ${
            solarMode
              ? "bg-[#1E7B85]/35 text-[#5EEAD4] border border-[#2DD4BF]/40"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <SunMoon className="w-3 h-3" aria-hidden="true" />
          <span className="hidden sm:inline">Siang/Malam</span>
        </button>
        <button
          type="button"
          onClick={() => setShowClouds((v) => !v)}
          aria-pressed={showClouds}
          title="Tampilkan / sembunyikan lapisan awan orbital"
          className={`inline-flex items-center gap-1 px-1.5 py-1 rounded transition ${
            showClouds
              ? "bg-[#1E7B85]/35 text-[#5EEAD4] border border-[#2DD4BF]/40"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <Cloud className="w-3 h-3" aria-hidden="true" />
          <span className="hidden md:inline">Awan</span>
        </button>
        <button
          type="button"
          onClick={() => setShowDots((v) => !v)}
          aria-pressed={showDots}
          title="Tampilkan / sembunyikan matriks titik benua"
          className={`inline-flex items-center gap-1 px-1.5 py-1 rounded transition ${
            showDots
              ? "bg-[#1E7B85]/35 text-[#5EEAD4] border border-[#2DD4BF]/40"
              : "text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <Grid3X3 className="w-3 h-3" aria-hidden="true" />
          <span className="hidden md:inline">Titik</span>
        </button>
      </div>

      {/* Screen-Projected Interactive Hub Badges */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {hubs.map((hub) => {
          const isSelected = hub.id === selectedHubId;
          const isUp = hub.primaryIndex.changePercent >= 0;
          return (
            <button
              key={hub.id}
              type="button"
              ref={(el) => {
                if (el) labelElsRef.current.set(hub.id, el);
                else labelElsRef.current.delete(hub.id);
              }}
              onClick={() => onSelectHub(hub.id)}
              style={{ opacity: 0 }}
              title={`${hub.countryName} (${hub.exchange}) • ${hub.primaryIndex.name} ${formatPersen(
                hub.primaryIndex.changePercent,
                2,
                true
              )}`}
              className={`absolute top-0 left-0 px-1.5 py-0.5 rounded border backdrop-blur-md transition-colors text-[9.5px] font-mono tnum flex items-center gap-1 shadow-lg ${
                isSelected
                  ? "z-20 bg-[#0F131C]/95 border-[#2DD4BF] text-white shadow-[#2DD4BF]/25"
                  : "z-10 bg-[#0B0E15]/82 border-white/[0.12] text-slate-200 hover:border-[#2DD4BF]/70 hover:bg-[#161C29]/95"
              }`}
            >
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  hub.session.isOpen
                    ? isUp
                      ? "bg-[#22C55E]"
                      : "bg-[#EF4444]"
                    : "bg-slate-500"
                }`}
              />
              <span className="font-bold">{hub.id}</span>
              <span className={isUp ? "text-[#22C55E]" : "text-[#EF4444]"}>
                {formatPersen(hub.primaryIndex.changePercent, 1, true)}
              </span>
            </button>
          );
        })}
      </div>

      {/* HUD Kiri Bawah: Petunjuk Interaksi */}
      <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-20 flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0B0E15]/80 backdrop-blur-md border border-white/[0.07] text-[10px] text-slate-400 font-sans">
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
          <span>Buka</span>
        </span>
        <span className="text-slate-600">&bull;</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          <span>Tutup</span>
        </span>
        <span className="hidden sm:inline text-slate-600">&bull;</span>
        <span className="hidden sm:inline text-slate-300">Drag putar &bull; Klik pin negara</span>
      </div>

      {/* HUD Kanan Bawah: Kontrol Zoom (+ / - / Reset) */}
      <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 bg-[#0B0E15]/85 backdrop-blur-md border border-white/[0.08] p-1 rounded-md">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Perbesar globe"
          title="Perbesar globe"
          className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.08] transition"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Perkecil globe"
          title="Perkecil globe"
          className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.08] transition"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          aria-label="Reset sudut pandang globe"
          title="Reset sudut pandang"
          className="w-6 h-6 rounded flex items-center justify-center text-slate-300 hover:text-[#2DD4BF] hover:bg-white/[0.08] transition"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
