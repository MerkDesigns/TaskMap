import { useEffect, useRef } from "react";
import { clamp } from "../canvasMath";

type ExtensionDropEffectProps = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export function ExtensionDropEffect({
  originX,
  originY,
  width,
  height,
}: ExtensionDropEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      return;
    }

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;

      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision highp float;

      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform vec2 u_origin;
      uniform float u_progress;

      float gaussian(float x, float sigma) {
        return exp(-0.5 * (x * x) / (sigma * sigma));
      }

      float easeOutCubic(float x) {
        x = clamp(x, 0.0, 1.0);
        return 1.0 - pow(1.0 - x, 3.0);
      }

      float softDisk(float d, float radius, float blur) {
        return 1.0 - smoothstep(radius - blur, radius + blur, d);
      }

      void main() {
        float t = clamp(u_progress, 0.0, 1.0);
        if (t <= 0.0001 || t >= 0.9999) {
          gl_FragColor = vec4(0.0);
          return;
        }

        vec2 currentPx = v_uv * u_resolution;
        vec2 originPx = u_origin * u_resolution;
        float normalizer = max(u_resolution.x, u_resolution.y);
        float d = length(currentPx - originPx) / normalizer;

        float travel = easeOutCubic(t);
        float r = mix(0.025, 1.16, travel);
        float ring = gaussian(d - r, 0.110 + 0.026 * t);
        float circle = softDisk(d, r * 0.92 + 0.040, 0.245 + 0.075 * t);
        float appear = smoothstep(0.00, 0.050, t);
        float leave = 1.0 - smoothstep(0.34, 0.68, t);
        float active = appear * leave;
        float circleFade = 1.0 - smoothstep(0.16, 0.68, t);
        float gray = 0.50;
        gray += ring * 0.102;
        gray += circle * 0.094 * circleFade;
        gray = clamp(gray, 0.0, 1.0);

        float alpha = active * (
          ring * 0.28 +
          circle * 0.368 * circleFade
        );
        alpha *= 0.76;

        gl_FragColor = vec4(vec3(gray), alpha);
      }
    `;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) {
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertexShader || !fragmentShader) {
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const originLocation = gl.getUniformLocation(program, "u_origin");
    const progressLocation = gl.getUniformLocation(program, "u_progress");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const duration = 540;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let animationFrame = 0;
    let animationStart = 0;

    const resize = () => {
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const clear = () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };

    const draw = (progress: number) => {
      resize();
      clear();
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform2f(originLocation, clamp(originX / width, 0, 1), 1 - clamp(originY / height, 0, 1));
      gl.uniform1f(progressLocation, progress);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const frame = (now: number) => {
      const progress = Math.min((now - animationStart) / duration, 1);
      draw(progress);
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(frame);
      } else {
        clear();
      }
    };

    resize();
    clear();
    if (!reduceMotion.matches) {
      animationStart = performance.now();
      animationFrame = window.requestAnimationFrame(frame);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [height, originX, originY, width]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full mix-blend-overlay"
      aria-hidden="true"
    />
  );
}
