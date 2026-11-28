"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import worldAtlasRaw from "world-atlas/countries-110m.json";
import { Compass, Minus, Plus, RotateCcw } from "lucide-react";
import { formatPersen } from "@/lib/format";
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
const BASE_CAMERA_Z = 3.24;
const MOBILE_CAMERA_Z = 3.58;
const MIN_CAMERA_Z = 2.3;
const MAX_CAMERA_Z = 4.1;

const MAJOR_CITY_LIGHTS: [number, number, number][] = [
  [-6.2, 106.8, 1.35], // Jakarta
  [1.35, 103.8, 1.15], // Singapore
  [35.68, 139.65, 1.45], // Tokyo
  [37.56, 126.98, 1.2], // Seoul
  [31.23, 121.47, 1.35], // Shanghai
  [22.32, 114.17, 1.25], // Hong Kong
  [-33.87, 151.21, 1.1], // Sydney
  [40.71, -74.01, 1.5], // New York
  [37.77, -122.42, 1.1], // San Francisco
  [41.88, -87.63, 1.0], // Chicago
  [51.51, -0.13, 1.4], // London
  [50.11, 8.68, 1.2], // Frankfurt
  [48.85, 2.35, 1.1], // Paris
  [47.37, 8.54, 0.9], // Zurich
  [19.07, 72.88, 1.15], // Mumbai
  [25.2, 55.27, 1.05], // Dubai
  [-23.55, -46.63, 1.05], // Sao Paulo
  [39.9, 116.4, 1.2], // Beijing
];

function latLonToVector3(lat: number, lon: number, radius: number = EARTH_RADIUS): THREE.Vector3 {
  const phi = (lon + 180) * DEG2RAD;
  const theta = (90 - lat) * DEG2RAD;
  const sinTheta = Math.sin(theta);
  return new THREE.Vector3(
    -radius * sinTheta * Math.cos(phi),
    radius * Math.cos(theta),
    radius * sinTheta * Math.sin(phi)
  );
}

function getTargetRotationForLatLon(lat: number, lon: number): { rotX: number; rotY: number } {
  const clampedLat = Math.max(-58, Math.min(58, lat));
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
      // Hindari garis menyeberang antimeridian (+/- 180°)
      if (Math.abs(lon - prevLon) > 180) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.closePath();
}

function drawPolygonCollection(
  ctx: CanvasRenderingContext2D,
  features: Feature<Polygon | MultiPolygon>[],
  width: number,
  height: number,
  options: { fillStyle?: string; strokeStyle?: string; lineWidth?: number }
) {
  ctx.beginPath();
  for (const feat of features) {
    const geom = feat.geometry;
    if (!geom) continue;
    if (geom.type === "Polygon") {
      for (const ring of geom.coordinates) {
        traceRingOnCanvas(ctx, ring, width, height);
      }
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates) {
        for (const ring of poly) {
          traceRingOnCanvas(ctx, ring, width, height);
        }
      }
    }
  }
  if (options.fillStyle) {
    ctx.fillStyle = options.fillStyle;
    ctx.fill();
  }
  if (options.strokeStyle) {
    ctx.strokeStyle = options.strokeStyle;
    ctx.lineWidth = options.lineWidth ?? 1;
    ctx.stroke();
  }
}

/**
 * Mensintesis 3 tekstur PBR (Albedo + Night-Lights, Bump/Relief, Roughness/Ocean Specular)
 * secara lokal dari poligon geografis asli world-atlas — bebas CDN/CORS failure.
 */
function buildProceduralEarthTextures(features: Feature<Polygon | MultiPolygon>[]): {
  albedoTex: THREE.CanvasTexture;
  bumpTex: THREE.CanvasTexture;
  roughnessTex: THREE.CanvasTexture;
} {
  const width = 2048;
  const height = 1024;

  // 1. Albedo & Night-Lights Canvas
  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const aCtx = albedoCanvas.getContext("2d")!;

  const oceanGrad = aCtx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, "#050912");
  oceanGrad.addColorStop(0.5, "#08101E");
  oceanGrad.addColorStop(1, "#04070E");
  aCtx.fillStyle = oceanGrad;
  aCtx.fillRect(0, 0, width, height);

  // Graticule garis lintang/bujur halus ala radar obsidian
  aCtx.strokeStyle = "rgba(45, 212, 191, 0.055)";
  aCtx.lineWidth = 1;
  for (let lon = -150; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * width;
    aCtx.beginPath();
    aCtx.moveTo(x, 0);
    aCtx.lineTo(x, height);
    aCtx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * height;
    aCtx.beginPath();
    aCtx.moveTo(0, y);
    aCtx.lineTo(width, y);
    aCtx.stroke();
  }

  // Daratan Slate-Obsidian dengan garis pantai teal
  drawPolygonCollection(aCtx, features, width, height, {
    fillStyle: "#121C2E",
    strokeStyle: "rgba(45, 212, 191, 0.28)",
    lineWidth: 1.25,
  });

  // Tekstur elevasi mikro & klaster cahaya kota malam (Night Lights)
  for (const [lat, lon, intensity] of MAJOR_CITY_LIGHTS) {
    const cx = ((lon + 180) / 360) * width;
    const cy = ((90 - lat) / 180) * height;
    const rad = 18 * intensity;
    const glow = aCtx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    glow.addColorStop(0, "rgba(251, 191, 36, 0.72)");
    glow.addColorStop(0.35, "rgba(45, 212, 191, 0.32)");
    glow.addColorStop(1, "rgba(45, 212, 191, 0)");
    aCtx.fillStyle = glow;
    aCtx.beginPath();
    aCtx.arc(cx, cy, rad, 0, Math.PI * 2);
    aCtx.fill();
  }

  // 2. Topography / Surface Relief Bump Map Canvas
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext("2d")!;

  bCtx.fillStyle = "#121212";
  bCtx.fillRect(0, 0, width, height);

  // Lapisan kontinen terangkat + bevel tepi pantai halus untuk efek relief 3D
  bCtx.save();
  bCtx.filter = "blur(3px)";
  drawPolygonCollection(bCtx, features, width, height, {
    fillStyle: "#8C8C8C",
  });
  bCtx.restore();

  drawPolygonCollection(bCtx, features, width, height, {
    fillStyle: "#B8B8B8",
    strokeStyle: "#E2E2E2",
    lineWidth: 1.5,
  });

  // 3. Roughness Map (Laut sedikit lebih mengilap, daratan lebih matte)
  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rCtx = roughCanvas.getContext("2d")!;

  rCtx.fillStyle = "#525252"; // Ocean semi-gloss
  rCtx.fillRect(0, 0, width, height);
  drawPolygonCollection(rCtx, features, width, height, {
    fillStyle: "#D8D8D8", // Matte elevated land
  });

  const albedoTex = new THREE.CanvasTexture(albedoCanvas);
  albedoTex.colorSpace = THREE.SRGBColorSpace;
  albedoTex.anisotropy = 4;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.anisotropy = 4;

  const roughnessTex = new THREE.CanvasTexture(roughCanvas);
  roughnessTex.anisotropy = 4;

  return { albedoTex, bumpTex, roughnessTex };
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

function createFresnelAtmosphereMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color("#2DD4BF") },
      uIntensity: { value: 0.72 },
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
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(max(0.0, 0.72 - dot(vNormal, vViewDir)), 3.2);
        gl_FragColor = vec4(uColor, fresnel * uIntensity);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
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
  if (mid.lengthSq() < 0.0001) {
    mid.set(0, 1, 0);
  }
  const altitude = EARTH_RADIUS + 0.14 + Math.min(0.42, angle * 0.19);
  mid.normalize().multiplyScalar(altitude);
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

/**
 * 3D Interactive World Globe berbasis Three.js:
 * - PBR Relief Bump-Mapping & Specular Ocean dari poligon asli world-atlas
 * - Fresnel Teal Atmosphere + Starfield Depth Layer
 * - Animated 3D Capital Flow Arcs menuju Jakarta (IDX)
 * - Highlight poligon negara aktif + pulsing exchange pins + HTML HUD badges
 * - Pointer Parallax + Scroll-Coupled Camera Pitch + IntersectionObserver Auto-Pause
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

  // Sync latest callbacks/props into refs for zero-reinit animation loop
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

  const targetRotRef = useRef<{ rotX: number; rotY: number }>(
    getTargetRotationForLatLon(-6.2088, 106.8456)
  );
  const targetZoomRef = useRef<number>(BASE_CAMERA_Z);
  const userInteractedAtRef = useRef<number>(0);

  // Imperative fly-to whenever selectedHubId changes
  useEffect(() => {
    const activeHub = hubs.find((h) => h.id === selectedHubId);
    if (!activeHub) return;
    targetRotRef.current = getTargetRotationForLatLon(activeHub.lat, activeHub.lon);
    userInteractedAtRef.current = Date.now();
  }, [selectedHubId, hubs]);

  const handleZoomIn = useCallback(() => {
    targetZoomRef.current = Math.max(MIN_CAMERA_Z, targetZoomRef.current - 0.32);
  }, []);

  const handleZoomOut = useCallback(() => {
    targetZoomRef.current = Math.min(MAX_CAMERA_Z, targetZoomRef.current + 0.32);
  }, []);

  const handleResetView = useCallback(() => {
    targetZoomRef.current = BASE_CAMERA_Z;
    const activeHub = hubsRef.current.find((h) => h.id === selectedHubIdRef.current);
    if (activeHub) {
      targetRotRef.current = getTargetRotationForLatLon(activeHub.lat, activeHub.lon);
    } else {
      targetRotRef.current = getTargetRotationForLatLon(-6.2088, 106.8456);
    }
  }, []);

  // Precompute GeoJSON country features once per module mount
  const countryFeatures = useMemo(() => extractCountryFeatures(), []);

  // Ref for rebuilding highlight outline when selectedHubId changes
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initCameraZ = initWidth < 460 ? MOBILE_CAMERA_Z : BASE_CAMERA_Z;
    targetZoomRef.current = initCameraZ;
    const camera = new THREE.PerspectiveCamera(40, initWidth / initHeight, 0.1, 30);
    camera.position.set(0, 0, initCameraZ);

    // Pencahayaan sinematik untuk menonjolkan relief bump-map & kilau lautan
    const ambientLight = new THREE.AmbientLight(0x94b8c8, 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xe0f7fa, 1.85);
    keyLight.position.set(4.2, 2.6, 3.8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x2dd4bf, 1.05);
    rimLight.position.set(-4.0, -1.6, -2.5);
    scene.add(rimLight);

    // Starfield depth parallax layer
    const starCount = 380;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const r = 4.6 + ((i * 7919) % 1000) / 350;
      const theta = (((i * 104729) % 1000) / 1000) * Math.PI * 2;
      const phi = Math.acos(2 * (((i * 3571) % 1000) / 1000) - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x99f6e4,
      size: 0.022,
      transparent: true,
      opacity: 0.35,
      sizeAttenuation: true,
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // Root Globe Group (rotated by drag & fly-to)
    const globeGroup = new THREE.Group();
    globeGroup.rotation.order = "XYZ";
    globeGroup.rotation.x = targetRotRef.current.rotX;
    globeGroup.rotation.y = targetRotRef.current.rotY;
    scene.add(globeGroup);

    // Earth Mesh with PBR Bump Relief & Roughness
    const { albedoTex, bumpTex, roughnessTex } = buildProceduralEarthTextures(countryFeatures);
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 72, 72);
    const earthMat = new THREE.MeshStandardMaterial({
      map: albedoTex,
      bumpMap: bumpTex,
      bumpScale: 0.045,
      roughnessMap: roughnessTex,
      roughness: 0.92,
      metalness: 0.12,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // Subtle 3D country borders overlay
    const allBordersGeo = buildCountryBorderGeometry(countryFeatures, EARTH_RADIUS * 1.003);
    const allBordersMat = new THREE.LineBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.16,
    });
    const allBordersLines = new THREE.LineSegments(allBordersGeo, allBordersMat);
    globeGroup.add(allBordersLines);

    // Active country glowing 3D border highlight
    let highlightLines: THREE.LineSegments | null = null;
    const highlightMat = new THREE.LineBasicMaterial({
      color: 0x5eead4,
      transparent: true,
      opacity: 0.92,
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
      const geo = buildCountryBorderGeometry(matched, EARTH_RADIUS * 1.007);
      highlightLines = new THREE.LineSegments(geo, highlightMat);
      globeGroup.add(highlightLines);
    };
    highlightUpdaterRef.current = updateHighlightCountry;

    // Fresnel Atmosphere Halo
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.135, 64, 64);
    const atmosMat = createFresnelAtmosphereMaterial();
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // Subtle Equatorial Telemetry Ring
    const ringGeo = new THREE.RingGeometry(EARTH_RADIUS * 1.24, EARTH_RADIUS * 1.246, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const orbitalRing = new THREE.Mesh(ringGeo, ringMat);
    orbitalRing.rotation.x = Math.PI / 2 - 0.18;
    orbitalRing.rotation.y = 0.25;
    scene.add(orbitalRing);

    // Hub Markers, Pulse Rings & Animated Arcs to Jakarta
    interface MarkerEntry {
      id: GlobalMarketId;
      pos: THREE.Vector3;
      dotMesh: THREE.Mesh;
      ringMesh: THREE.Mesh;
      hitMesh: THREE.Mesh;
      isOpen: boolean;
    }
    interface ArcEntry {
      id: GlobalMarketId;
      curve: THREE.QuadraticBezierCurve3;
      lineMesh: THREE.Line;
      pulseMesh: THREE.Mesh;
      phaseOffset: number;
    }

    const markersGroup = new THREE.Group();
    const arcsGroup = new THREE.Group();
    globeGroup.add(markersGroup);
    globeGroup.add(arcsGroup);

    const markerEntries: MarkerEntry[] = [];
    const arcEntries: ArcEntry[] = [];
    const hitMeshes: THREE.Mesh[] = [];

    const dotGeo = new THREE.SphereGeometry(0.017, 16, 16);
    const hitGeo = new THREE.SphereGeometry(0.068, 12, 12);
    const pulseRingGeo = new THREE.RingGeometry(0.022, 0.032, 24);
    const arcDotGeo = new THREE.SphereGeometry(0.012, 12, 12);

    const jakartaHub = hubsRef.current.find((h) => h.id === "ID");
    const jktLat = jakartaHub?.lat ?? -6.2088;
    const jktLon = jakartaHub?.lon ?? 106.8456;

    const rebuildHubVisuals = (
      currentHubs: GlobalMarketHubSnapshot[],
      activeId: GlobalMarketId
    ) => {
      // Clear existing markers & arcs cleanly
      while (markersGroup.children.length > 0) {
        const obj = markersGroup.children[0];
        markersGroup.remove(obj);
      }
      while (arcsGroup.children.length > 0) {
        const obj = arcsGroup.children[0];
        arcsGroup.remove(obj);
      }
      markerEntries.length = 0;
      arcEntries.length = 0;
      hitMeshes.length = 0;

      currentHubs.forEach((hub, index) => {
        const pos = latLonToVector3(hub.lat, hub.lon, EARTH_RADIUS * 1.012);
        const isSelected = hub.id === activeId;
        const isUp = hub.primaryIndex.changePercent >= 0;
        const accentHex = isSelected ? 0x2dd4bf : isUp ? 0x22c55e : 0xef4444;

        const dotMat = new THREE.MeshBasicMaterial({ color: accentHex });
        const dotMesh = new THREE.Mesh(dotGeo, dotMat);
        dotMesh.position.copy(pos);
        if (isSelected) dotMesh.scale.setScalar(1.45);
        markersGroup.add(dotMesh);

        const rMat = new THREE.MeshBasicMaterial({
          color: accentHex,
          transparent: true,
          opacity: isSelected ? 0.85 : hub.session.isOpen ? 0.65 : 0.25,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(pulseRingGeo, rMat);
        ringMesh.position.copy(pos.clone().multiplyScalar(1.003));
        ringMesh.lookAt(pos.clone().multiplyScalar(2));
        markersGroup.add(ringMesh);

        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.position.copy(pos);
        hitMesh.userData = { hubId: hub.id };
        markersGroup.add(hitMesh);
        hitMeshes.push(hitMesh);

        markerEntries.push({
          id: hub.id,
          pos,
          dotMesh,
          ringMesh,
          hitMesh,
          isOpen: hub.session.isOpen,
        });

        // Capital Flow Arc menuju Jakarta
        if (hub.id !== "ID") {
          const curve = createGreatCircleArcCurve(hub.lat, hub.lon, jktLat, jktLon);
          const curvePoints = curve.getPoints(48);
          const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
          const lineMat = new THREE.LineBasicMaterial({
            color: isSelected ? 0x2dd4bf : isUp ? 0x22c55e : 0xef4444,
            transparent: true,
            opacity: isSelected ? 0.78 : 0.26,
          });
          const lineMesh = new THREE.Line(lineGeo, lineMat);
          arcsGroup.add(lineMesh);

          const pMat = new THREE.MeshBasicMaterial({
            color: isSelected ? 0x5eead4 : isUp ? 0x4ade80 : 0xf87171,
            transparent: true,
            opacity: isSelected ? 0.95 : 0.65,
          });
          const pulseMesh = new THREE.Mesh(arcDotGeo, pMat);
          arcsGroup.add(pulseMesh);

          arcEntries.push({
            id: hub.id,
            curve,
            lineMesh,
            pulseMesh,
            phaseOffset: (index * 0.13) % 1,
          });
        }
      });
    };

    dynamicDataUpdaterRef.current = rebuildHubVisuals;
    rebuildHubVisuals(hubsRef.current, selectedHubIdRef.current);
    const initialHub = hubsRef.current.find((h) => h.id === selectedHubIdRef.current);
    if (initialHub) {
      updateHighlightCountry(initialHub.isoNumeric);
    }

    // Pointer Interaction: Drag to rotate, click pin to select, hover for 3D pointer parallax
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
      pointerParallax.targetX = nx * 0.12;
      pointerParallax.targetY = ny * 0.08;

      if (isDragging) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        dragDistance += Math.hypot(dx, dy);
        prevX = e.clientX;
        prevY = e.clientY;

        targetRotRef.current.rotY += dx * 0.0065;
        targetRotRef.current.rotX = Math.max(
          -1.08,
          Math.min(1.08, targetRotRef.current.rotX + dy * 0.0055)
        );
        userInteractedAtRef.current = Date.now();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDragging && dragDistance < 6) {
        // Click raycast against 3D exchange pins
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(hitMeshes, false);
        if (hits.length > 0) {
          const hubId = hits[0].object.userData?.hubId as GlobalMarketId | undefined;
          if (hubId) {
            onSelectHubRef.current(hubId);
          }
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

    // Ctrl+Wheel zooms; plain scroll flows naturally to page Scroll-Linked Parallax!
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

    // ResizeObserver for responsive container (immediate re-render mencegah 1-frame blink)
    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height);
      renderer.render(scene, camera);
    });
    resizeObserver.observe(container);

    // IntersectionObserver + visibility auto-pause (0% GPU saat tidak terlihat!)
    let isVisible = true;
    let isTabVisible = !document.hidden;
    let rafId = 0;
    let disposed = false;

    let lastFrameMs = performance.now();
    let elapsedSec = 0;
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

      // Scroll-coupled parallax pitch & subtle camera pull-back
      const scrollP = isReduced ? 0 : Math.max(0, Math.min(1, scrollProgressRef?.current ?? 0));

      // Gentle ambient auto-rotation only when idle & not reduced motion
      const idleMs = Date.now() - userInteractedAtRef.current;
      if (!isDragging && !isReduced && idleMs > 6500) {
        targetRotRef.current.rotY += dt * 0.065;
      }

      // Smooth damped rotation towards target + scroll pitch coupling
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

      // Counter-parallax starfield
      starField.rotation.y = elapsed * (isReduced ? 0 : 0.008) - pointerParallax.curX * 0.35;
      starField.rotation.x = pointerParallax.curY * 0.35;
      orbitalRing.rotation.z = elapsed * (isReduced ? 0 : 0.04);

      // Animate pulsing rings for OPEN markets & active hub
      for (const m of markerEntries) {
        const isSel = m.id === selectedHubIdRef.current;
        if (!isReduced && (m.isOpen || isSel)) {
          const wave = ((elapsed * (isSel ? 1.35 : 0.95) + m.pos.x) % 1 + 1) % 1;
          const scale = 1 + wave * (isSel ? 2.4 : 1.75);
          m.ringMesh.scale.setScalar(scale);
          (m.ringMesh.material as THREE.MeshBasicMaterial).opacity = (1 - wave) * (isSel ? 0.85 : 0.6);
        } else {
          m.ringMesh.scale.setScalar(1.1);
        }
      }

      // Animate glowing capital-flow signal dots along arcs to Jakarta
      for (const arc of arcEntries) {
        const t = isReduced ? 0.5 : (elapsed * 0.28 + arc.phaseOffset) % 1;
        arc.curve.getPointAt(t, arc.pulseMesh.position);
      }

      renderer.render(scene, camera);

      // Project 3D hub coordinates to HTML HUD badges dengan anti-overlap collision separation
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

        worldPosScratch.copy(m.pos).applyMatrix4(globeGroup.matrixWorld);
        camDirScratch.copy(camera.position).sub(worldPosScratch).normalize();
        const surfaceNormal = worldPosScratch.clone().normalize();
        const facing = surfaceNormal.dot(camDirScratch);

        if (facing > 0.14) {
          projScratch.copy(worldPosScratch).project(camera);
          const sx = (projScratch.x * 0.5 + 0.5) * canvasW;
          const sy = (-projScratch.y * 0.5 + 0.5) * canvasH;
          const fade = Math.min(1, (facing - 0.14) / 0.25);
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

      // Prioritaskan pin aktif, lalu dorong lembut pin bertetangga (e.g. CN/KR/JP & UK/DE) agar tidak bertumpuk
      visibleLabels.sort((a, b) => b.priority - a.priority);
      const minDx = 72;
      const minDy = 24;
      for (let pass = 0; pass < 3; pass += 1) {
        for (let i = 0; i < visibleLabels.length; i += 1) {
          for (let j = i + 1; j < visibleLabels.length; j += 1) {
            const a = visibleLabels[i];
            const b = visibleLabels[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            if (Math.abs(dx) < minDx && Math.abs(dy) < minDy) {
              const pushY = dy >= 0 ? minDy - dy : -(minDy + dy);
              b.y += pushY * 0.72;
              if (Math.abs(dx) < minDx * 0.6) {
                b.x += (dx >= 0 ? 1 : -1) * 8;
              }
            }
          }
        }
      }

      for (const lbl of visibleLabels) {
        const cx = Math.max(42, Math.min(canvasW - 42, lbl.x));
        const cy = Math.max(30, Math.min(canvasH - 44, lbl.y));
        lbl.el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translate(-50%, -120%)`;
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

      earthGeo.dispose();
      earthMat.dispose();
      albedoTex.dispose();
      bumpTex.dispose();
      roughnessTex.dispose();
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
      dotGeo.dispose();
      hitGeo.dispose();
      pulseRingGeo.dispose();
      arcDotGeo.dispose();
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
    <div className="relative w-full h-full min-h-[340px] sm:min-h-[410px] select-none overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_46%,rgba(30,123,133,0.16),rgba(8,10,15,0.96)_72%)]">
      {/* Kanvas WebGL Three.js */}
      <div
        ref={containerRef}
        aria-label="Peta Bola Dunia 3D Pasar Saham Global Interaktif"
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />

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
              className={`absolute top-0 left-0 px-1.5 py-0.5 rounded border backdrop-blur-md transition-colors text-[10px] font-mono tnum flex items-center gap-1 shadow-lg ${
                isSelected
                  ? "z-20 bg-[#0F131C]/95 border-[#2DD4BF] text-white shadow-[#2DD4BF]/20"
                  : "z-10 bg-[#0B0E15]/85 border-white/[0.12] text-slate-200 hover:border-[#2DD4BF]/70 hover:bg-[#161C29]/95"
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
