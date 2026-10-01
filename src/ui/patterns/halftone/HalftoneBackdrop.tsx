import { useEffect, useRef } from "react";
import { useReducedMotion } from "../../motion/reducedMotionPreference";
import {
  getHalftoneSettings,
  subscribeHalftoneSettings,
  type HalftoneSettings,
} from "./halftoneSettings";
import { createHalftoneProgram } from "./halftoneShader";
import { createPointerTrail } from "./pointerTrail";
import "./halftone.css";

function readAccent(element: Element): [number, number, number] {
  const probe = document.createElement("span");
  probe.style.color = "var(--taskmap-accent)";
  element.append(probe);
  const channels =
    getComputedStyle(probe)
      .color.match(/\d+(\.\d+)?/g)
      ?.map(Number) ?? [];
  probe.remove();
  const [red = 227, green = 107, blue = 85] = channels;
  return [red / 255, green / 255, blue / 255];
}

function parseHexColor(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  if (!Number.isFinite(value)) return [1, 1, 1];
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function boostColor(
  [red, green, blue]: readonly [number, number, number],
  { vibrance, brightness }: HalftoneSettings,
) {
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return [red, green, blue].map((channel) =>
    Math.min(1, Math.max(0, (luminance + (channel - luminance) * vibrance) * brightness)),
  );
}

/**
 * Animated halftone field behind the database entry panel: accent-coloured dots whose size follows
 * flowing noise. Draws nothing where WebGL is unavailable, and one still frame under reduced motion.
 */
export function HalftoneBackdrop({
  settings: fixedSettings,
}: {
  /** A fixed preset; without it the field follows the live (tunable) settings store. */
  readonly settings?: HalftoneSettings;
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();
  const fixedSettingsRef = useRef(fixedSettings);
  fixedSettingsRef.current = fixedSettings;

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { antialias: false, premultipliedAlpha: true });
    if (!canvas || !gl) return;
    const program = createHalftoneProgram(gl);
    if (!program) return;

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const readSettings = () => fixedSettingsRef.current ?? getHalftoneSettings();
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = {
      time: uniform("time"),
      cell: uniform("cell"),
      frequency: uniform("frequency"),
      warpStrength: uniform("warpStrength"),
      maxRadius: uniform("maxRadius"),
      minRadius: uniform("minRadius"),
      range: uniform("range"),
      minOpacity: uniform("minOpacity"),
      color: uniform("color"),
      shadowColor: uniform("shadowColor"),
      highlightColor: uniform("highlightColor"),
      heatAmount: uniform("heatAmount"),
      heatCurve: uniform("heatCurve"),
      hazeOpacity: uniform("hazeOpacity"),
      hazeFrequency: uniform("hazeFrequency"),
      hazeSpeed: uniform("hazeSpeed"),
      hazeContrast: uniform("hazeContrast"),
      layerOpacity: uniform("layerOpacity"),
      trail: uniform("trail"),
      trailCount: uniform("trailCount"),
      pointerRadius: uniform("pointerRadius"),
      pointerStrength: uniform("pointerStrength"),
      pointerGrowth: uniform("pointerGrowth"),
      waveDirection: uniform("waveDirection"),
      waveNumber: uniform("waveNumber"),
      wavePhase: uniform("wavePhase"),
      waveAmount: uniform("waveAmount"),
      waveBend: uniform("waveBend"),
    };
    const accent = readAccent(canvas);

    const applySettings = () => {
      const settings = readSettings();
      const scale = window.devicePixelRatio || 1;
      const cell = settings.cellSize * scale;
      gl.uniform1f(uniforms.cell, cell);
      gl.uniform1f(uniforms.frequency, settings.noiseScale / scale);
      gl.uniform1f(uniforms.warpStrength, settings.warp);
      gl.uniform1f(uniforms.maxRadius, settings.maxDotSize * cell);
      gl.uniform1f(uniforms.minRadius, settings.minDotSize * scale);
      gl.uniform2f(
        uniforms.range,
        settings.rangeLow,
        Math.max(settings.rangeHigh, settings.rangeLow + 0.01),
      );
      gl.uniform1f(uniforms.minOpacity, settings.minOpacity);
      gl.uniform3fv(uniforms.color, boostColor(accent, settings));
      // Picked colours are used as-is; only the accent is boosted.
      gl.uniform3fv(uniforms.shadowColor, parseHexColor(settings.shadowColor));
      gl.uniform3fv(uniforms.highlightColor, parseHexColor(settings.highlightColor));
      gl.uniform1f(uniforms.heatAmount, settings.heatAmount);
      gl.uniform1f(uniforms.heatCurve, settings.heatCurve);
      gl.uniform1f(uniforms.hazeOpacity, settings.hazeEnabled ? settings.hazeOpacity : 0);
      gl.uniform1f(uniforms.hazeFrequency, settings.hazeScale / scale);
      gl.uniform1f(uniforms.hazeSpeed, settings.hazeSpeed);
      gl.uniform1f(uniforms.hazeContrast, settings.hazeContrast);
      gl.uniform1f(uniforms.layerOpacity, settings.opacity);
      gl.uniform1f(uniforms.pointerRadius, settings.pointerRadius * scale);
      gl.uniform1f(uniforms.pointerStrength, settings.pointerStrength);
      gl.uniform1f(uniforms.pointerGrowth, settings.pointerGrowth);
      // gl_FragCoord grows upwards, so a positive angle travels up the screen as expected.
      const angle = (settings.waveAngle * Math.PI) / 180;
      gl.uniform2f(uniforms.waveDirection, Math.cos(angle), Math.sin(angle));
      gl.uniform1f(uniforms.waveNumber, (2 * Math.PI) / Math.max(1, settings.waveLength * scale));
      gl.uniform1f(uniforms.waveAmount, settings.waveAmount);
      gl.uniform1f(uniforms.waveBend, settings.waveBend);
    };
    // Measured on resize only, so pointer events never read layout.
    let canvasOrigin = { left: 0, top: 0 };
    const resize = () => {
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      const { left, top } = canvas.getBoundingClientRect();
      canvasOrigin = { left, top };
      gl.viewport(0, 0, canvas.width, canvas.height);
      applySettings();
    };

    // Trail positions are CSS pixels relative to the canvas; the shader wants device pixels with a
    // bottom-left origin, which is converted once per frame on upload.
    const trail = createPointerTrail();
    const onPointerMove = (event: PointerEvent) =>
      trail.move(event.clientX - canvasOrigin.left, event.clientY - canvasOrigin.top);
    const onPointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) trail.leave();
    };
    const uploadTrail = (now: number) => {
      const settings = readSettings();
      if (!settings.pointerEnabled) {
        gl.uniform1f(uniforms.trailCount, 0);
        return;
      }
      const { points, count } = trail.sample(now, {
        spacing: settings.pointerRadius * 0.3,
        duration: settings.trailDuration * 1000,
      });
      const scale = window.devicePixelRatio || 1;
      for (let index = 0; index < count; index += 1) {
        points[index * 4] = points[index * 4]! * scale;
        points[index * 4 + 1] = canvas.height - points[index * 4 + 1]! * scale;
      }
      gl.uniform4fv(uniforms.trail, points);
      gl.uniform1f(uniforms.trailCount, count);
    };

    // Time advances by the current speed each frame, so changing the speed never jumps the pattern.
    // A random start so each launch begins on a different pattern.
    let noiseTime = Math.random() * 100;
    let wavePhase = 0;
    let previous: number | null = null;
    const draw = (now: number) => {
      if (previous !== null) {
        const seconds = (now - previous) / 1000;
        const settings = readSettings();
        noiseTime += seconds * settings.speed;
        wavePhase = (wavePhase + seconds * settings.waveSpeed * 2 * Math.PI) % (2 * Math.PI);
      }
      previous = now;
      gl.uniform1f(uniforms.time, noiseTime);
      gl.uniform1f(uniforms.wavePhase, wavePhase);
      // A still frame (reduced motion) has no pointer response.
      if (reducedMotion) gl.uniform1f(uniforms.trailCount, 0);
      else uploadTrail(now);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    resize();
    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw(0);
    });
    observer.observe(canvas);
    const onSettings = () => {
      applySettings();
      if (reducedMotion) draw(0);
    };
    const unsubscribe = subscribeHalftoneSettings(onSettings);

    let frame = 0;
    if (reducedMotion) {
      draw(0);
    } else {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerout", onPointerOut, { passive: true });
      const tick = (now: number) => {
        draw(now);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      observer.disconnect();
      unsubscribe();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [reducedMotion]);

  return <canvas ref={canvasRef} className="taskmap-halftone" aria-hidden="true" />;
}
