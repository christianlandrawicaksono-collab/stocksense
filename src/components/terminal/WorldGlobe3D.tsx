"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import worldAtlasRaw from "world-atlas/countries-110m.json";
import { Cloud, Compass, Eye, EyeOff, Grid3X3, Layers, Minus, Plus, RotateCcw, SunMoon } from "lucide-react";
import { formatPersen } from "@/lib/format";
import {
  computeMarketSpikeHeight,
  computeSubsolarPoint,
  computeSunDirectionLocal,
  formatGeoCoordinates,
  latLonToSphereCoords,
} from "@/lib/globe-math";
import type { GlobalMarketHubSnapshot, GlobalMarketId } from "@/lib/global-markets";
import type { GlobalNewsPinId, GlobeNewsPin } from "@/lib/global-news";

interface GlobeDisplayMarker {
  id: string;
  label: string;
  secondaryText: string;
  tooltip: string;
  lat: number;
  lon: number;
  isoNumeric: string;
  isSelected: boolean;
  isPulsing: boolean;
  accentHexNum: number;
  dotClass: string;
  secondaryClass: string;
  spikeHeight: number;
  isJakartaOrigin: boolean;
}

export type GlobeVisualTheme = "dark-orbital" | "editorial-atlas" | "editorial-cartography";

interface WorldGlobe3DProps {
  hubs?: GlobalMarketHubSnapshot[];
  selectedHubId?: GlobalMarketId;
  onSelectHub?: (id: GlobalMarketId) => void;
  newsPins?: GlobeNewsPin[];
  selectedNewsPinId?: GlobalNewsPinId;
  onSelectNewsPin?: (pin: GlobeNewsPin) => void;
  cameraZoomBias?: number;
  scrollBehavior?: "pullback" | "scrollytelling";
  scrollProgressRef?: React.RefObject<number>;
  viewOffsetXRatioRef?: React.RefObject<number>;
  visualTheme?: GlobeVisualTheme;
  seamless?: boolean;
  onToggleEditorialStyle?: () => void;
  isExploreMode?: boolean;
  onToggleExploreMode?: () => void;
  showFixedDock?: boolean;
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
  sunDirLocal: THREE.Vector3,
  isEditorialLight: boolean,
  initialCartographyMix: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDayMap: { value: dayTex },
      uNightMap: { value: nightTex },
      uTopoMap: { value: topoTex },
      uSunDirLocal: { value: sunDirLocal.clone().normalize() },
      uSolarMode: { value: 1.0 },
      uLightEditorial: { value: isEditorialLight ? 1.0 : 0.0 },
      uCartographyMix: { value: initialCartographyMix },
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
      uniform float uLightEditorial;
      uniform float uCartographyMix;

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

        // Lampu kota NASA Black Marble (core + soft bloom halo)
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

        // Real-time Solar Day/Night Terminator & Studio Spherical Shading
        float sunDot = dot(normalize(vLocalNormal), normalize(uSunDirLocal));
        float realDayMix = smoothstep(-0.20, 0.24, sunDot);
        float dayMix = mix(0.84, realDayMix, uSolarMode);
        float ndotv = clamp(dot(normalize(vViewNormal), normalize(vViewDir)), 0.0, 1.0);
        float frontRim = pow(1.0 - ndotv, 3.6);
        float dayLum = dot(rawDay, vec3(0.299, 0.587, 0.114));

        // === PATH 0: DARK ORBITAL EARTH (MODE TERMINAL) ===
        vec3 oceanDayDark = mix(vec3(0.032, 0.078, 0.145), vec3(0.068, 0.155, 0.255), clamp(dayLum * 2.1, 0.0, 1.0));
        vec3 landBaseDark = mix(vec3(0.115, 0.185, 0.255), vec3(0.235, 0.355, 0.435), clamp(dayLum * 1.45 + topoC * 0.45, 0.0, 1.0));
        vec3 landDayDark = mix(landBaseDark, rawDay * vec3(0.55, 0.72, 0.82), 0.24) * reliefShade;
        vec3 gradedDayDark = mix(landDayDark, oceanDayDark, oceanMask);

        vec3 oceanNightDark = vec3(0.014, 0.028, 0.058);
        vec3 landNightDark = vec3(0.036, 0.058, 0.095) * (0.85 + topoC * 0.35);
        vec3 goldLightsDark = vec3(1.0, 0.87, 0.48) * cityCore * 2.05 + vec3(0.96, 0.56, 0.14) * cityHalo * 0.92;
        vec3 gradedNightDark = mix(landNightDark, oceanNightDark, oceanMask) + goldLightsDark;

        float diffuseLiftDark = mix(0.86, 1.16, smoothstep(-0.1, 0.9, sunDot));
        vec3 darkSurface = mix(gradedNightDark, gradedDayDark * diffuseLiftDark, dayMix);

        float sunsetBand = exp(-pow((sunDot + 0.05) * 6.4, 2.0)) * uSolarMode;
        float dawnScatter = exp(-pow((sunDot - 0.085) * 5.0, 2.0)) * uSolarMode;
        darkSurface += vec3(0.98, 0.50, 0.15) * sunsetBand * (0.34 + 0.16 * landMask);
        darkSurface += vec3(0.14, 0.74, 0.92) * dawnScatter * 0.24;
        vec3 rimColorDark = mix(vec3(0.11, 0.68, 0.72), vec3(0.24, 0.72, 0.96), dayMix * 0.55);
        darkSurface += rimColorDark * frontRim * (0.34 + 0.28 * dayMix);

        // === PATH 1: EDITORIAL DAYLIGHT SATELIT ATLAS (KERTAS TERANG FT) ===
        float studioKey = clamp(dot(normalize(vViewNormal), normalize(vec3(-0.35, 0.45, 0.82))), 0.0, 1.0);
        float studioShade = mix(0.76, 1.08, studioKey);

        vec3 oceanAtlasDay = mix(vec3(0.115, 0.265, 0.355), vec3(0.205, 0.425, 0.525), clamp(dayLum * 1.9 + studioKey * 0.22, 0.0, 1.0));
        vec3 warmSageLand = mix(vec3(0.45, 0.54, 0.48), vec3(0.84, 0.80, 0.72), clamp(dayLum * 1.15 + topoC * 0.38, 0.0, 1.0));
        vec3 landAtlasDay = mix(rawDay * vec3(1.02, 1.02, 0.96), warmSageLand, 0.30) * clamp(reliefShade, 0.80, 1.24);
        vec3 atlasDay = mix(landAtlasDay, oceanAtlasDay, oceanMask) * studioShade;

        // Sisi malam lembut bergaya twilight indigo (tidak hitam legam di atas kertas terang)
        vec3 oceanAtlasNight = vec3(0.085, 0.155, 0.235);
        vec3 landAtlasNight = vec3(0.155, 0.225, 0.295) * (0.88 + topoC * 0.28);
        vec3 goldLightsAtlas = vec3(1.0, 0.87, 0.52) * cityCore * 1.45 + vec3(0.95, 0.60, 0.22) * cityHalo * 0.55;
        vec3 atlasNight = mix(landAtlasNight, oceanAtlasNight, oceanMask) + goldLightsAtlas;

        float atlasDayMix = mix(0.92, smoothstep(-0.28, 0.24, sunDot), uSolarMode);
        vec3 atlasSurface = mix(atlasNight, atlasDay, atlasDayMix);
        atlasSurface += vec3(0.96, 0.62, 0.28) * sunsetBand * 0.20;
        atlasSurface = mix(atlasSurface, vec3(0.74, 0.88, 0.92), frontRim * 0.38);

        // === PATH 2: FT CARTOGRAPHIC INK GLOBE (INFOGRAFIS KORAN FT 3D) ===
        float cartoVolume = mix(0.84, 1.05, studioKey);
        vec3 oceanCarto = mix(vec3(0.79, 0.855, 0.89), vec3(0.885, 0.92, 0.94), clamp(studioKey * 0.72 + dayLum * 0.25, 0.0, 1.0));
        vec3 landCarto = mix(vec3(0.975, 0.965, 0.945), vec3(0.915, 0.895, 0.855), clamp(topoC * 0.68, 0.0, 1.0)) * clamp(reliefShade, 0.86, 1.12);
        vec3 cartoBase = mix(landCarto, oceanCarto, oceanMask) * cartoVolume;
        // Terminator sangat halus di mode Kartografi agar tetap jernih seperti infografis cetak FT
        float cartoShadow = mix(1.0, mix(0.86, 1.0, smoothstep(-0.24, 0.22, sunDot)), uSolarMode * 0.65);
        vec3 cartoSurface = cartoBase * cartoShadow;
        cartoSurface = mix(cartoSurface, vec3(0.11, 0.44, 0.48), frontRim * 0.24);

        vec3 editorialSurface = mix(atlasSurface, cartoSurface, uCartographyMix);
        vec3 finalSurface = mix(darkSurface, editorialSurface, uLightEditorial);

        gl_FragColor = vec4(finalSurface, 1.0);
      }
    `,
  });
}

/**
 * Ultra-thin realistic outer atmosphere halo (adaptif Dark Orbital vs FT Light Editorial).
 */
function createThinAtmosphereMaterial(isEditorialLight: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColorInner: { value: new THREE.Color(isEditorialLight ? "#0D7680" : "#2DD4BF") },
      uColorOuter: { value: new THREE.Color(isEditorialLight ? "#7EBAC6" : "#38BDF8") },
      uStrength: { value: isEditorialLight ? 0.28 : 0.85 },
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
      uniform float uStrength;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float rim = clamp(0.56 - dot(vNormal, vViewDir), 0.0, 1.0);
        float intensity = pow(rim, 3.6) * uStrength;
        vec3 col = mix(uColorOuter, uColorInner, clamp(rim * 1.8, 0.0, 1.0));
        gl_FragColor = vec4(col, intensity);
      }
    `,
    side: THREE.BackSide,
    blending: isEditorialLight ? THREE.NormalBlending : THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Soft editorial paper drop shadow disc sitting directly behind/under the 3D sphere
 * so it tracks camera.setViewOffset() automatically with zero CSS desync.
 */
function createPaperShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.14, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, "rgba(29, 31, 35, 0.20)");
  grad.addColorStop(0.52, "rgba(29, 31, 35, 0.08)");
  grad.addColorStop(1, "rgba(29, 31, 35, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Custom GLSL Animated Comet Trail Material untuk 3D Tube Arcs menuju Jakarta.
 */
function createCometArcMaterial(
  colorHex: number,
  isSelected: boolean,
  phaseOffset: number,
  isEditorialLight: boolean
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uSparkColor: { value: new THREE.Color(isEditorialLight ? "#FFFFFF" : "#E0FFFA") },
      uTime: { value: 0 },
      uPhase: { value: phaseOffset },
      uBaseOpacity: { value: isEditorialLight ? (isSelected ? 0.56 : 0.26) : isSelected ? 0.42 : 0.16 },
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
      uniform vec3 uSparkColor;
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
        vec3 finalCol = mix(uColor, uSparkColor, clamp(headSpark * 0.85, 0.0, 1.0));
        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
    transparent: true,
    blending: isEditorialLight ? THREE.NormalBlending : THREE.AdditiveBlending,
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
const emptyClientSubscribe = () => () => {};

export const WorldGlobe3D: React.FC<WorldGlobe3DProps> = ({
  hubs = [],
  selectedHubId = "ID",
  onSelectHub,
  newsPins,
  selectedNewsPinId = "US",
  onSelectNewsPin,
  cameraZoomBias = 0,
  scrollBehavior = "pullback",
  scrollProgressRef,
  viewOffsetXRatioRef,
  visualTheme = "dark-orbital",
  seamless = false,
  onToggleEditorialStyle,
  isExploreMode = false,
  onToggleExploreMode,
  showFixedDock = true,
  reducedMotion = false,
}) => {
  const isClient = useSyncExternalStore(
    emptyClientSubscribe,
    () => true,
    () => false
  );
  const isNewsMode = Boolean(newsPins && newsPins.length > 0);
  const isEditorialLight = visualTheme !== "dark-orbital";
  const isCartography = visualTheme === "editorial-cartography";
  const activeMarkerId: string = isNewsMode ? selectedNewsPinId : selectedHubId;

  const displayMarkers = useMemo<GlobeDisplayMarker[]>(() => {
    if (newsPins && newsPins.length > 0) {
      return newsPins.map((pin) => {
        const isSelected = pin.id === selectedNewsPinId;
        const accentHexNum = isEditorialLight
          ? isSelected
            ? 0x0d7680
            : pin.sentiment === "BULLISH"
            ? 0x0d6343
            : pin.sentiment === "BEARISH"
            ? 0x990f3d
            : 0x0f5499
          : isSelected
          ? 0x2dd4bf
          : pin.sentiment === "BULLISH"
          ? 0x22c55e
          : pin.sentiment === "BEARISH"
          ? 0xef4444
          : 0x38bdf8;
        const dotClass = isEditorialLight
          ? pin.sentiment === "BULLISH"
            ? "bg-[#0D6343]"
            : pin.sentiment === "BEARISH"
            ? "bg-[#990F3D]"
            : "bg-[#0F5499]"
          : pin.sentiment === "BULLISH"
          ? "bg-[#22C55E]"
          : pin.sentiment === "BEARISH"
          ? "bg-[#EF4444]"
          : "bg-[#38BDF8]";
        const secondaryClass = isEditorialLight
          ? pin.sentiment === "BULLISH"
            ? "text-[#0D6343]"
            : pin.sentiment === "BEARISH"
            ? "text-[#990F3D]"
            : "text-[#0F5499]"
          : pin.sentiment === "BULLISH"
          ? "text-[#4ADE80]"
          : pin.sentiment === "BEARISH"
          ? "text-[#F87171]"
          : "text-sky-300";
        const spikeHeight = isSelected
          ? 0.145 + Math.min(0.075, pin.newsCount * 0.014)
          : 0.055 + Math.min(0.08, pin.newsCount * 0.013);
        return {
          id: pin.id,
          label: pin.id,
          secondaryText: `${pin.newsCount} berita`,
          tooltip: `${pin.city} (${pin.label}) • ${pin.newsCount} berita kawasan`,
          lat: pin.lat,
          lon: pin.lon,
          isoNumeric: pin.isoNumeric,
          isSelected,
          isPulsing: isSelected || pin.newsCount > 0,
          accentHexNum,
          dotClass,
          secondaryClass,
          spikeHeight,
          isJakartaOrigin: pin.id === "ID",
        };
      });
    }

    return hubs.map((hub) => {
      const isSelected = hub.id === selectedHubId;
      const isUp = hub.primaryIndex.changePercent >= 0;
      const accentHexNum = isSelected ? 0x2dd4bf : isUp ? 0x22c55e : 0xef4444;
      return {
        id: hub.id,
        label: hub.id,
        secondaryText: formatPersen(hub.primaryIndex.changePercent, 1, true),
        tooltip: `${hub.countryName} (${hub.exchange}) • ${hub.primaryIndex.name} ${formatPersen(
          hub.primaryIndex.changePercent,
          2,
          true
        )}`,
        lat: hub.lat,
        lon: hub.lon,
        isoNumeric: hub.isoNumeric,
        isSelected,
        isPulsing: hub.session.isOpen || isSelected,
        accentHexNum,
        dotClass: hub.session.isOpen
          ? isUp
            ? "bg-[#22C55E]"
            : "bg-[#EF4444]"
          : "bg-slate-500",
        secondaryClass: isUp ? "text-[#22C55E]" : "text-[#EF4444]",
        spikeHeight: computeMarketSpikeHeight(hub.primaryIndex.changePercent, isSelected),
        isJakartaOrigin: hub.id === "ID",
      };
    });
  }, [hubs, selectedHubId, newsPins, selectedNewsPinId, isEditorialLight]);

  const containerRef = useRef<HTMLDivElement>(null);
  const labelElsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const markersRef = useRef<GlobeDisplayMarker[]>(displayMarkers);
  const activeMarkerIdRef = useRef<string>(activeMarkerId);
  const reducedMotionRef = useRef(reducedMotion);
  const cameraZoomBiasRef = useRef(cameraZoomBias);
  const scrollBehaviorRef = useRef(scrollBehavior);
  const visualThemeRef = useRef<GlobeVisualTheme>(visualTheme);
  const isEditorialLightRef = useRef<boolean>(isEditorialLight);

  const handleSelectMarker = useCallback(
    (id: string) => {
      if (newsPins && newsPins.length > 0) {
        const pin = newsPins.find((p) => p.id === id);
        if (pin) onSelectNewsPin?.(pin);
        return;
      }
      onSelectHub?.(id as GlobalMarketId);
    },
    [newsPins, onSelectNewsPin, onSelectHub]
  );
  const handleSelectMarkerRef = useRef(handleSelectMarker);

  const [webglFailed, setWebglFailed] = useState(false);
  const [solarMode, setSolarMode] = useState(true);
  const [showClouds, setShowClouds] = useState(true);
  const [showDots, setShowDots] = useState(true);

  const solarModeRef = useRef(solarMode);
  const showCloudsRef = useRef(showClouds);
  const showDotsRef = useRef(showDots);

  useEffect(() => {
    handleSelectMarkerRef.current = handleSelectMarker;
  }, [handleSelectMarker]);

  useEffect(() => {
    markersRef.current = displayMarkers;
  }, [displayMarkers]);

  useEffect(() => {
    activeMarkerIdRef.current = activeMarkerId;
  }, [activeMarkerId]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    cameraZoomBiasRef.current = cameraZoomBias;
  }, [cameraZoomBias]);

  useEffect(() => {
    scrollBehaviorRef.current = scrollBehavior;
  }, [scrollBehavior]);

  useEffect(() => {
    visualThemeRef.current = visualTheme;
    isEditorialLightRef.current = visualTheme !== "dark-orbital";
  }, [visualTheme]);

  useEffect(() => {
    solarModeRef.current = solarMode;
  }, [solarMode]);

  useEffect(() => {
    showCloudsRef.current = showClouds;
  }, [showClouds]);

  useEffect(() => {
    showDotsRef.current = showDots;
  }, [showDots]);

  const initialMarker = displayMarkers.find((m) => m.id === activeMarkerId) ?? displayMarkers[0];
  const targetRotRef = useRef<{ rotX: number; rotY: number }>(
    initialMarker
      ? getTargetRotationForLatLon(initialMarker.lat, initialMarker.lon)
      : getTargetRotationForLatLon(-6.2088, 106.8456)
  );
  const targetZoomRef = useRef<number>(
    Math.max(MIN_CAMERA_Z, Math.min(MAX_CAMERA_Z, BASE_CAMERA_Z + cameraZoomBias))
  );
  const userInteractedAtRef = useRef<number>(0);

  useEffect(() => {
    const active = displayMarkers.find((m) => m.id === activeMarkerId);
    if (!active) return;
    targetRotRef.current = getTargetRotationForLatLon(active.lat, active.lon);
    userInteractedAtRef.current = Date.now();
  }, [activeMarkerId, displayMarkers]);

  const handleZoomIn = useCallback(() => {
    targetZoomRef.current = Math.max(MIN_CAMERA_Z, targetZoomRef.current - 0.3);
  }, []);

  const handleZoomOut = useCallback(() => {
    targetZoomRef.current = Math.min(MAX_CAMERA_Z, targetZoomRef.current + 0.3);
  }, []);

  const handleResetView = useCallback(() => {
    const w = containerRef.current?.clientWidth ?? 640;
    const baseZ = (w < 460 ? MOBILE_CAMERA_Z : BASE_CAMERA_Z) + cameraZoomBiasRef.current;
    targetZoomRef.current = Math.max(MIN_CAMERA_Z, Math.min(MAX_CAMERA_Z, baseZ));
    const active = markersRef.current.find((m) => m.id === activeMarkerIdRef.current);
    targetRotRef.current = active
      ? getTargetRotationForLatLon(active.lat, active.lon)
      : getTargetRotationForLatLon(-6.2088, 106.8456);
  }, []);

  const countryFeatures = useMemo(() => extractCountryFeatures(), []);
  const selectedMarker = useMemo(
    () => displayMarkers.find((m) => m.id === activeMarkerId) ?? displayMarkers[0],
    [displayMarkers, activeMarkerId]
  );
  const selectedNewsPin = useMemo(
    () => (newsPins && newsPins.length > 0 ? newsPins.find((p) => p.id === selectedNewsPinId) ?? newsPins[0] : null),
    [newsPins, selectedNewsPinId]
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
    ((nextMarkers: GlobeDisplayMarker[], nextSelectedId: string) => void) | null
  >(null);

  useEffect(() => {
    const active = displayMarkers.find((m) => m.id === activeMarkerId);
    if (active && highlightUpdaterRef.current) {
      highlightUpdaterRef.current(active.isoNumeric);
    }
    if (dynamicDataUpdaterRef.current) {
      dynamicDataUpdaterRef.current(displayMarkers, activeMarkerId);
    }
  }, [displayMarkers, activeMarkerId]);

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
    const initCameraZ = Math.max(
      MIN_CAMERA_Z,
      Math.min(MAX_CAMERA_Z, (initWidth < 460 ? MOBILE_CAMERA_Z : BASE_CAMERA_Z) + cameraZoomBiasRef.current)
    );
    targetZoomRef.current = initCameraZ;
    const camera = new THREE.PerspectiveCamera(40, initWidth / initHeight, 0.1, 30);
    camera.position.set(0, 0, initCameraZ);

    const initialEditorialLight = isEditorialLightRef.current;
    const initialCartographyMix = visualThemeRef.current === "editorial-cartography" ? 1.0 : 0.0;

    // Starfield depth parallax layer (hanya untuk Dark Orbital Mode di Terminal)
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
    starField.visible = !initialEditorialLight;
    scene.add(starField);

    // Soft editorial paper drop shadow disc (khusus mode FT Light Editorial, ikut bergeser bersama setViewOffset)
    const shadowTex = createPaperShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(2.58, 2.58);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: initialEditorialLight ? 0.95 : 0.0,
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.set(0.06, -0.14, -0.45);
    shadowMesh.visible = initialEditorialLight;
    scene.add(shadowMesh);

    // Root Globe Group
    const globeGroup = new THREE.Group();
    globeGroup.rotation.order = "XYZ";
    globeGroup.rotation.x = targetRotRef.current.rotX;
    globeGroup.rotation.y = targetRotRef.current.rotY;
    scene.add(globeGroup);

    // 1. Orbital / Editorial Earth with Custom GLSL Shader
    const fallbacks = createFallbackTextures(countryFeatures);
    const sunInit = computeSunDirectionLocal();
    const sunVec = new THREE.Vector3(sunInit.x, sunInit.y, sunInit.z).normalize();

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 80, 80);
    const earthMat = createOrbitalEarthMaterial(
      fallbacks.dayTex,
      fallbacks.nightTex,
      fallbacks.topoTex,
      sunVec,
      initialEditorialLight,
      initialCartographyMix
    );
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // 2. Drifting Satellite Cloud Layer (r = 1.012)
    const cloudsGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 64, 64);
    const cloudsMat = new THREE.MeshBasicMaterial({
      color: initialEditorialLight ? 0xffffff : 0xd8f3ff,
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
    const dotMatRef = dotMatrixMesh.material as THREE.MeshBasicMaterial;
    if (initialEditorialLight) {
      dotMatRef.blending = THREE.NormalBlending;
      dotMatRef.color.setHex(initialCartographyMix > 0.5 ? 0x1e5c64 : 0xeaf6f7);
      dotMatRef.opacity = initialCartographyMix > 0.5 ? 0.28 : 0.24;
    }
    globeGroup.add(dotMatrixMesh);

    // 4. Crisp Country Borders + Glowing Active Country Highlight
    const allBordersGeo = buildCountryBorderGeometry(countryFeatures, EARTH_RADIUS * 1.0025);
    const allBordersMat = new THREE.LineBasicMaterial({
      color: initialEditorialLight ? (initialCartographyMix > 0.5 ? 0x262a33 : 0xfbfbfa) : 0x38bdf8,
      transparent: true,
      opacity: initialEditorialLight ? (initialCartographyMix > 0.5 ? 0.42 : 0.22) : 0.11,
    });
    const allBordersLines = new THREE.LineSegments(allBordersGeo, allBordersMat);
    globeGroup.add(allBordersLines);

    let highlightLines: THREE.LineSegments | null = null;
    const highlightMat = new THREE.LineBasicMaterial({
      color: initialEditorialLight ? 0x0d7680 : 0x5eead4,
      transparent: true,
      opacity: 0.96,
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
    const atmosMat = createThinAtmosphereMaterial(initialEditorialLight);
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // Subtle Orbital / Architectural Meridian Ring
    const ringGeo = new THREE.RingGeometry(EARTH_RADIUS * 1.19, EARTH_RADIUS * 1.193, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: initialEditorialLight ? 0x1d1f23 : 0x2dd4bf,
      transparent: true,
      opacity: initialEditorialLight ? 0.11 : 0.09,
      side: THREE.DoubleSide,
    });
    const orbitalRing = new THREE.Mesh(ringGeo, ringMat);
    orbitalRing.rotation.x = Math.PI / 2 - 0.2;
    orbitalRing.rotation.y = 0.24;
    scene.add(orbitalRing);

    // 6. 3D Vertical Spikes, Radar Ripples & Glowing Tube Arcs
    interface MarkerEntry {
      id: string;
      tipPos: THREE.Vector3;
      basePos: THREE.Vector3;
      ringMeshA: THREE.Mesh;
      ringMeshB: THREE.Mesh;
      isPulsing: boolean;
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

    const clearDynamicVisuals = () => {
      while (markersGroup.children.length > 0) markersGroup.remove(markersGroup.children[0]);
      while (arcsGroup.children.length > 0) arcsGroup.remove(arcsGroup.children[0]);
      for (const d of dynamicDisposables) d.dispose();
      dynamicDisposables.length = 0;
      markerEntries.length = 0;
      cometMaterials.length = 0;
      hitMeshes.length = 0;
    };

    const rebuildVisuals = (
      currentMarkers: GlobeDisplayMarker[],
      activeId: string
    ) => {
      clearDynamicVisuals();

      const jakartaMarker = currentMarkers.find((m) => m.isJakartaOrigin);
      const jktLat = jakartaMarker?.lat ?? -6.2088;
      const jktLon = jakartaMarker?.lon ?? 106.8456;

      currentMarkers.forEach((marker, index) => {
        const basePos = latLonToVector3(marker.lat, marker.lon, EARTH_RADIUS * 1.006);
        const normal = basePos.clone().normalize();
        const isSelected = marker.id === activeId;
        const accentHex = marker.accentHexNum;

        // 3D Vertical Spike rising radially from the country/hotspot
        const spikeHeight = marker.spikeHeight;
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
          color: isSelected
            ? isEditorialLightRef.current
              ? 0x0d7680
              : 0x99f6e4
            : accentHex,
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
          opacity: isSelected ? 0.8 : marker.isPulsing ? 0.6 : 0.2,
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
        hitMesh.userData = { markerId: marker.id };
        markersGroup.add(hitMesh);
        hitMeshes.push(hitMesh);

        markerEntries.push({
          id: marker.id,
          tipPos,
          basePos,
          ringMeshA,
          ringMeshB,
          isPulsing: marker.isPulsing,
        });

        // Glowing 3D Tube Arc menuju Jakarta dengan Animated Comet Trail
        if (!marker.isJakartaOrigin) {
          const curve = createGreatCircleArcCurve(marker.lat, marker.lon, jktLat, jktLon);
          const tubeRadius = isSelected ? 0.0052 : 0.003;
          const tubeGeo = new THREE.TubeGeometry(curve, 52, tubeRadius, 7, false);
          const cometMat = createCometArcMaterial(
            accentHex,
            isSelected,
            (index * 0.13) % 1,
            isEditorialLightRef.current
          );
          dynamicDisposables.push(tubeGeo, cometMat);
          cometMaterials.push(cometMat);

          const tubeMesh = new THREE.Mesh(tubeGeo, cometMat);
          arcsGroup.add(tubeMesh);
        }
      });
    };

    dynamicDataUpdaterRef.current = rebuildVisuals;
    rebuildVisuals(markersRef.current, activeMarkerIdRef.current);
    const initialActive = markersRef.current.find((m) => m.id === activeMarkerIdRef.current);
    if (initialActive) {
      updateHighlightCountry(initialActive.isoNumeric);
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
          const markerId = hits[0].object.userData?.markerId as string | undefined;
          if (markerId) handleSelectMarkerRef.current(markerId);
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
    let currentOffsetRatio = 0;
    let currentCartoMix = initialCartographyMix;

    const worldPosScratch = new THREE.Vector3();
    const camDirScratch = new THREE.Vector3();
    const projScratch = new THREE.Vector3();
    const atlasBorderCol = new THREE.Color(0xfbfbfa);
    const cartoBorderCol = new THREE.Color(0x262a33);
    const atlasDotCol = new THREE.Color(0xeaf6f7);
    const cartoDotCol = new THREE.Color(0x1e5c64);

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

      // Smooth morphing antara Daylight Satelit Atlas (0) ↔ FT Cartographic Ink (1)
      if (isEditorialLightRef.current) {
        const targetCarto = visualThemeRef.current === "editorial-cartography" ? 1.0 : 0.0;
        currentCartoMix += (targetCarto - currentCartoMix) * Math.min(1, dt * 5.2);
        earthMat.uniforms.uCartographyMix.value = currentCartoMix;
        allBordersMat.color.copy(atlasBorderCol).lerp(cartoBorderCol, currentCartoMix);
        allBordersMat.opacity = 0.22 + currentCartoMix * 0.22;
        dotMatRef.color.copy(atlasDotCol).lerp(cartoDotCol, currentCartoMix);
        dotMatRef.opacity = 0.22 + currentCartoMix * 0.08;
        atmosMat.uniforms.uStrength.value = 0.28 - currentCartoMix * 0.14;
      }

      // Toggle layers cleanly without recreating geometry (awan otomatis meredup di mode Kartografi)
      cloudsMesh.visible = showCloudsRef.current && (!isEditorialLightRef.current || currentCartoMix < 0.88);
      if (isEditorialLightRef.current && cloudsMat.map) {
        cloudsMat.opacity = 0.16 * (1 - currentCartoMix);
      }
      dotMatrixMesh.visible = showDotsRef.current;

      // Drifting satellite clouds
      if (!isReduced && cloudsMesh.visible) {
        cloudsMesh.rotation.y += dt * 0.009;
      }

      // Scroll-coupled inertial camera choreography
      const scrollP = isReduced ? 0 : Math.max(0, Math.min(1, scrollProgressRef?.current ?? 0));

      const idleMs = Date.now() - userInteractedAtRef.current;
      if (!isDragging && !isReduced && idleMs > 6500 && scrollBehaviorRef.current !== "scrollytelling") {
        targetRotRef.current.rotY += dt * 0.055;
      }

      const isScrolly = scrollBehaviorRef.current === "scrollytelling";
      const desiredRotX = isScrolly
        ? targetRotRef.current.rotX + (scrollP - 0.5) * 0.14
        : targetRotRef.current.rotX + scrollP * 0.22;
      const desiredRotY = isScrolly
        ? targetRotRef.current.rotY + (scrollP - 0.5) * 0.12
        : targetRotRef.current.rotY + scrollP * 0.18;

      const rotDamping = isScrolly ? 4.8 : 6.5;
      globeGroup.rotation.x += (desiredRotX - globeGroup.rotation.x) * Math.min(1, dt * rotDamping);
      globeGroup.rotation.y +=
        shortestAngleDiff(globeGroup.rotation.y, desiredRotY) * Math.min(1, dt * rotDamping);

      // Pointer parallax on camera & starfield
      pointerParallax.curX += (pointerParallax.targetX - pointerParallax.curX) * Math.min(1, dt * 5);
      pointerParallax.curY += (pointerParallax.targetY - pointerParallax.curY) * Math.min(1, dt * 5);

      const desiredZ = isScrolly
        ? targetZoomRef.current - Math.sin(scrollP * Math.PI) * 0.12
        : targetZoomRef.current + scrollP * 0.34;
      camera.position.z += (desiredZ - camera.position.z) * Math.min(1, dt * 5.5);
      camera.position.x = isReduced ? 0 : pointerParallax.curX;
      camera.position.y = isReduced ? 0 : pointerParallax.curY;
      camera.lookAt(0, 0, 0);

      // Optical off-center framing via camera.setViewOffset() (Style A: tengah di Hero → kiri di Bab 01-05)
      const canvasW = renderer.domElement.clientWidth;
      const canvasH = renderer.domElement.clientHeight;
      const rawTargetOffset = canvasW >= 1024 ? (viewOffsetXRatioRef?.current ?? 0) : 0;
      currentOffsetRatio += (rawTargetOffset - currentOffsetRatio) * Math.min(1, dt * 4.8);
      if (canvasW > 0 && canvasH > 0) {
        if (Math.abs(currentOffsetRatio) > 0.0006) {
          camera.setViewOffset(
            canvasW,
            canvasH,
            currentOffsetRatio * canvasW,
            0,
            canvasW,
            canvasH
          );
        } else if (camera.view) {
          camera.clearViewOffset();
        }
      }

      if (starField.visible) {
        starField.rotation.y = elapsed * (isReduced ? 0 : 0.007) - pointerParallax.curX * 0.35;
        starField.rotation.x = pointerParallax.curY * 0.35;
      }
      orbitalRing.rotation.z = elapsed * (isReduced ? 0 : 0.035);

      // Animate comet trails along all 3D tube arcs
      const shaderTime = isReduced ? 0.5 : elapsed;
      for (const cm of cometMaterials) {
        cm.uniforms.uTime.value = shaderTime;
      }

      // Animate dual concentric radar ripples on surface
      for (const m of markerEntries) {
        const isSel = m.id === activeMarkerIdRef.current;
        if (!isReduced && (m.isPulsing || isSel)) {
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
      globeGroup.updateMatrixWorld();

      interface ProjectedLabel {
        id: string;
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
            priority: m.id === activeMarkerIdRef.current ? 10 : facing,
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
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTex.dispose();
      capGeo.dispose();
      hitGeo.dispose();
      pulseRingGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [countryFeatures, scrollProgressRef, viewOffsetXRatioRef]);

  if (webglFailed) {
    return (
      <div
        className={`w-full h-full min-h-[340px] flex flex-col items-center justify-center p-5 text-center space-y-3 ${
          isEditorialLight
            ? "bg-[#F6F4EE] text-[#1D1F23] border border-[#E5E5DC]"
            : "bg-[#080B12] rounded-lg border border-white/[0.06] text-slate-300"
        }`}
      >
        <Compass className={`w-7 h-7 ${isEditorialLight ? "text-[#0D7680]" : "text-[#2DD4BF]"}`} />
        <p className="text-xs font-medium">
          WebGL tidak tersedia di perangkat ini — pilih kawasan langsung:
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
          {displayMarkers.map((marker) => (
            <button
              key={marker.id}
              type="button"
              onClick={() => handleSelectMarker(marker.id)}
              className={`px-2.5 py-1.5 rounded-md border text-[11px] font-mono transition ${
                marker.isSelected
                  ? isEditorialLight
                    ? "bg-[#0D7680] border-[#0D7680] text-white font-semibold"
                    : "bg-[#1E7B85] border-[#2DD4BF] text-white font-semibold"
                  : isEditorialLight
                  ? "bg-[#FBFBFA] border-[#D5D7DC] text-[#1D1F23] hover:border-[#0D7680]"
                  : "bg-[#0F131C] border-white/[0.08] text-slate-300 hover:border-white/[0.2]"
              }`}
            >
              {marker.label} {marker.secondaryText}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const wrapperClass = seamless
    ? "relative w-full h-full min-h-[340px] select-none overflow-hidden bg-transparent"
    : isEditorialLight
    ? "relative w-full h-full min-h-[340px] sm:min-h-[405px] select-none overflow-hidden rounded-lg bg-[#F6F4EE]"
    : "relative w-full h-full min-h-[340px] sm:min-h-[405px] select-none overflow-hidden rounded-lg bg-[radial-gradient(circle_at_50%_48%,rgba(14,42,66,0.34),rgba(7,10,16,0.98)_72%)]";

  const hudSurfaceClass = isEditorialLight
    ? "bg-[#FBFBFA]/88 backdrop-blur-md border border-[#DCD7CC] text-[#1D1F23] shadow-sm"
    : "bg-[#0B0E15]/82 backdrop-blur-md border border-white/[0.08] text-slate-300";

  const hudActiveBtnClass = isEditorialLight
    ? "bg-[#0D7680]/14 text-[#0D7680] border border-[#0D7680]/35 font-medium"
    : "bg-[#1E7B85]/35 text-[#5EEAD4] border border-[#2DD4BF]/40";

  const hudIdleBtnClass = isEditorialLight
    ? "text-[#5A6068] hover:text-[#1D1F23] border border-transparent"
    : "text-slate-400 hover:text-slate-200 border border-transparent";

  return (
    <div className={wrapperClass}>
      {/* Kanvas WebGL Three.js */}
      <div
        ref={containerRef}
        data-cursor-hint="Drag · Putar"
        aria-label={
          isNewsMode
            ? "Peta Bola Dunia 3D Berita Global Interaktif"
            : "Peta Bola Dunia 3D Pasar Saham Global Interaktif"
        }
        className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing"
      />

      {/* HUD Kiri Atas & Kanan Atas (hanya mode Non-Seamless / Terminal — di Seamless Berita dipindah ke 2A Unified Bottom-Left Dock agar 100% bebas ketutup kartu kanan!) */}
      {!seamless && (
        <>
          <div
            className={`pointer-events-none absolute top-2.5 left-2.5 z-20 flex items-center gap-2 px-2.5 py-1 rounded-md text-[10px] font-mono tnum ${hudSurfaceClass}`}
          >
            {selectedMarker && (
              <>
                <span className={isEditorialLight ? "text-[#0D7680] font-semibold" : "text-[#2DD4BF] font-semibold"}>
                  {selectedNewsPin ? `${selectedNewsPin.id} • ${selectedNewsPin.city}` : selectedMarker.label}
                </span>
                <span>{formatGeoCoordinates(selectedMarker.lat, selectedMarker.lon)}</span>
              </>
            )}
            <span className="hidden sm:inline opacity-40">&bull;</span>
            <span className="hidden sm:inline opacity-75">{solarUtcLabel}</span>
          </div>

          <div
            className={`absolute top-2.5 right-2.5 z-20 flex items-center gap-1 p-1 rounded-md text-[10px] font-sans ${hudSurfaceClass}`}
          >
            <button
              type="button"
              onClick={() => setSolarMode((v) => !v)}
              aria-pressed={solarMode}
              title="Toggle pencahayaan Siang/Malam UTC real-time"
              className={`inline-flex items-center gap-1 px-1.5 py-1 rounded transition ${
                solarMode ? hudActiveBtnClass : hudIdleBtnClass
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
                showClouds ? hudActiveBtnClass : hudIdleBtnClass
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
                showDots ? hudActiveBtnClass : hudIdleBtnClass
              }`}
            >
              <Grid3X3 className="w-3 h-3" aria-hidden="true" />
              <span className="hidden md:inline">Titik</span>
            </button>
          </div>
        </>
      )}

      {/* Screen-Projected Interactive Hub / News Hotspot Badges */}
      <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
        {displayMarkers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            data-cursor-hint="Klik Hotspot"
            ref={(el) => {
              if (el) labelElsRef.current.set(marker.id, el);
              else labelElsRef.current.delete(marker.id);
            }}
            onClick={() => handleSelectMarker(marker.id)}
            style={{ opacity: 0 }}
            title={marker.tooltip}
            className={`absolute top-0 left-0 px-2 py-0.5 rounded border backdrop-blur-md transition-colors text-[10px] font-mono tnum flex items-center gap-1.5 ${
              isEditorialLight
                ? marker.isSelected
                  ? "z-20 bg-[#1D1F23] border-[#1D1F23] text-[#FBFBFA] shadow-md"
                  : "z-10 bg-[#FBFBFA]/92 border-[#D5D1C8] text-[#1D1F23] hover:border-[#0D7680] hover:bg-white shadow-sm"
                : marker.isSelected
                ? "z-20 bg-[#0F131C]/95 border-[#2DD4BF] text-white shadow-lg shadow-[#2DD4BF]/25"
                : "z-10 bg-[#0B0E15]/82 border-white/[0.12] text-slate-200 hover:border-[#2DD4BF]/70 hover:bg-[#161C29]/95 shadow-lg"
            }`}
          >
            <span
              aria-hidden="true"
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${marker.dotClass}`}
            />
            <span className="font-bold">{marker.label}</span>
            <span
              className={
                isEditorialLight && marker.isSelected ? "text-[#5EEAD4]" : marker.secondaryClass
              }
            >
              {marker.secondaryText}
            </span>
          </button>
        ))}
      </div>

      {/* HUD BAWAH: 2A Unified Instrument Dock di Kiri-Bawah (portal ke document.body agar bebas jebakan stacking-context sticky di Mobile & Desktop!) */}
      {seamless ? (
        isClient
          ? createPortal(
              <div
                aria-label="Panel Kontrol 3D Globe"
                className={`fixed bottom-3.5 left-3 sm:left-5 z-30 max-w-[calc(100vw-1.5rem)] flex flex-wrap items-center gap-1 px-2 py-1.5 text-[10.5px] font-sans transition-all duration-200 ${hudSurfaceClass} ${
                  showFixedDock
                    ? "opacity-100 translate-y-0 pointer-events-auto"
                    : "opacity-0 translate-y-4 pointer-events-none"
                }`}
              >
          {/* Segmen 1: Telemetri Aktif */}
          {selectedMarker && (
            <div className="hidden sm:flex items-center gap-1.5 pr-2 mr-0.5 border-r border-[#DCD7CC] font-mono text-[10px]">
              <span className="font-bold text-[#0D7680]">
                {selectedNewsPin ? `${selectedNewsPin.id} · ${selectedNewsPin.city}` : selectedMarker.label}
              </span>
              <span className="hidden xl:inline text-[#676E7E]">
                {formatGeoCoordinates(selectedMarker.lat, selectedMarker.lon)}
              </span>
            </div>
          )}

          {/* Segmen 2: Toggle Gaya Globe (Satelit Atlas ↔ Kartografi FT) & Layer */}
          {isEditorialLight && onToggleEditorialStyle && (
            <button
              type="button"
              onClick={onToggleEditorialStyle}
              aria-pressed={isCartography}
              data-cursor-hint="Ganti Gaya"
              title="Ganti gaya Globe 3D: Satelit Atlas ↔ Kartografi FT"
              className={`inline-flex items-center gap-1 px-2 py-1 transition font-semibold ${
                isCartography
                  ? "bg-[#990F3D]/12 text-[#990F3D] border border-[#990F3D]/35"
                  : "bg-[#0D7680]/14 text-[#0D7680] border border-[#0D7680]/35"
              }`}
            >
              <Layers className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{isCartography ? "Kartografi FT" : "Satelit Atlas"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSolarMode((v) => !v)}
            aria-pressed={solarMode}
            data-cursor-hint="Siang/Malam"
            title="Toggle pencahayaan Siang/Malam UTC real-time"
            className={`inline-flex items-center gap-1 px-1.5 py-1 transition ${
              solarMode ? hudActiveBtnClass : hudIdleBtnClass
            }`}
          >
            <SunMoon className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">Siang/Malam</span>
          </button>

          {!isCartography && (
            <button
              type="button"
              onClick={() => setShowClouds((v) => !v)}
              aria-pressed={showClouds}
              data-cursor-hint="Lapisan Awan"
              title="Tampilkan / sembunyikan lapisan awan"
              className={`inline-flex items-center gap-1 px-1.5 py-1 transition ${
                showClouds ? hudActiveBtnClass : hudIdleBtnClass
              }`}
            >
              <Cloud className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="hidden xl:inline">Awan</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDots((v) => !v)}
            aria-pressed={showDots}
            data-cursor-hint="Dot Matrix"
            title="Tampilkan / sembunyikan dot-matrix benua"
            className={`inline-flex items-center gap-1 px-1.5 py-1 transition ${
              showDots ? hudActiveBtnClass : hudIdleBtnClass
            }`}
          >
            <Grid3X3 className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="hidden xl:inline">Titik</span>
          </button>

          {/* Segmen 3: Kontrol Zoom (+ / - / Reset) */}
          <div className="flex items-center gap-0.5 pl-1.5 ml-0.5 border-l border-[#DCD7CC]">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Perbesar globe"
              title="Perbesar globe"
              className="w-6 h-6 flex items-center justify-center text-[#4E5563] hover:text-[#1D1F23] hover:bg-black/[0.06] transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Perkecil globe"
              title="Perkecil globe"
              className="w-6 h-6 flex items-center justify-center text-[#4E5563] hover:text-[#1D1F23] hover:bg-black/[0.06] transition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetView}
              aria-label="Reset sudut pandang globe"
              title="Reset sudut pandang"
              className="w-6 h-6 flex items-center justify-center text-[#4E5563] hover:text-[#0D7680] hover:bg-black/[0.06] transition"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Segmen 4: Explore Mode Toggle (H) */}
          {onToggleExploreMode && (
            <div className="pl-1.5 ml-0.5 border-l border-[#DCD7CC]">
              <button
                type="button"
                onClick={onToggleExploreMode}
                aria-pressed={isExploreMode}
                data-cursor-hint={isExploreMode ? "Tampilkan Berita" : "Explore Bebas"}
                title="Sembunyikan / tampilkan kartu berita untuk jelajah Bumi bebas (shortcut H)"
                className={`inline-flex items-center gap-1 px-2 py-1 font-medium transition ${
                  isExploreMode
                    ? "bg-[#1D1F23] text-[#FBFBFA] border border-[#1D1F23]"
                    : "text-[#4E5563] hover:text-[#1D1F23] hover:bg-black/[0.05] border border-transparent"
                }`}
              >
                {isExploreMode ? (
                  <>
                    <Eye className="w-3 h-3 text-[#5EEAD4]" aria-hidden="true" />
                    <span>Berita (H)</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3" aria-hidden="true" />
                    <span className="hidden sm:inline">Explore (H)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>,
              document.body
            )
          : null
      ) : (
        <>
          {/* HUD Kiri Bawah (Mode Terminal) */}
          <div
            className={`pointer-events-none absolute bottom-2.5 left-2.5 z-20 flex items-center gap-2 px-2.5 py-1 rounded-md text-[10px] font-sans ${hudSurfaceClass}`}
          >
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
            <span className="hidden sm:inline text-slate-300">
              Drag putar &bull; Klik pin negara
            </span>
          </div>

          {/* HUD Kanan Bawah (Mode Terminal) */}
          <div
            className={`absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 p-1 rounded-md ${hudSurfaceClass}`}
          >
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
        </>
      )}
    </div>
  );
};
