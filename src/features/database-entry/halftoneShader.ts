import { POINTER_TRAIL_CAPACITY } from "./pointerTrail";

const VERTEX_SHADER = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

// Every cell of the offset-row (hex-like) grid holds a dot; only its size changes. The size follows
// domain-warped 3D gradient noise: a second noise field pushes the sample position around, so the
// pattern flows and curls instead of pulsing in place, and the third axis is time. Small dots are
// dimmer than large ones, so quiet areas read as a faint texture rather than empty black. A dot's
// height also picks its colour (shadow → accent → highlight), and an optional grayscale haze of
// slower, broader noise sits underneath.
const FRAGMENT_SHADER = `
precision highp float;
uniform float time;
uniform float cell;
uniform float frequency;
uniform float warpStrength;
uniform float maxRadius;
uniform float minRadius;
uniform vec2 range;
uniform float minOpacity;
uniform vec3 color;
uniform vec3 shadowColor;
uniform vec3 highlightColor;
uniform float heatAmount;
uniform float heatCurve;
uniform float hazeOpacity;
uniform float hazeFrequency;
uniform float hazeSpeed;
uniform float hazeContrast;
uniform float layerOpacity;
uniform vec4 trail[${POINTER_TRAIL_CAPACITY}];
uniform float trailCount;
uniform float pointerRadius;
uniform float pointerStrength;
uniform float pointerGrowth;
uniform vec2 waveDirection;
uniform float waveNumber;
uniform float wavePhase;
uniform float waveAmount;
uniform float waveBend;

vec3 gradient(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gradientNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(mix(dot(gradient(i), f),
            dot(gradient(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
        mix(dot(gradient(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)),
            dot(gradient(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
    mix(mix(dot(gradient(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)),
            dot(gradient(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
        mix(dot(gradient(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)),
            dot(gradient(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y),
    u.z);
}

float flowField(vec2 position) {
  vec2 p = position * frequency;
  vec2 warp = vec2(gradientNoise(vec3(p, time)),
                   gradientNoise(vec3(p + vec2(5.2, 1.3), time + 11.0)));
  float n = gradientNoise(vec3(p + warpStrength * warp, 0.7 * time + 3.0));
  float noise = clamp(0.5 + 0.9 * n, 0.0, 1.0);
  // Travelling waves along waveDirection; the flow noise bends their fronts into organic swells.
  float phase = dot(position, waveDirection) * waveNumber - wavePhase + waveBend * 6.2831853 * n;
  float wave = 0.5 + 0.5 * sin(phase);
  return mix(noise, wave, waveAmount);
}

// The strongest nearby trail point wins (rather than a sum), so dense trail samples do not stack.
float pointerInfluence(vec2 position) {
  float influence = 0.0;
  float falloff = 2.0 / (pointerRadius * pointerRadius);
  for (int i = 0; i < ${POINTER_TRAIL_CAPACITY}; i++) {
    if (float(i) >= trailCount) break;
    vec2 offset = position - trail[i].xy;
    influence = max(influence, trail[i].z * exp(-dot(offset, offset) * falloff));
  }
  return influence;
}

vec3 heatColor(float height) {
  float h = pow(height, heatCurve);
  vec3 ramp = h < 0.5 ? mix(shadowColor, color, h * 2.0) : mix(color, highlightColor, h * 2.0 - 1.0);
  return mix(color, ramp, heatAmount);
}

float haze(vec2 pixel) {
  if (hazeOpacity <= 0.0) return 0.0;
  vec2 p = pixel * hazeFrequency;
  float t = time * hazeSpeed;
  float n = 0.65 * gradientNoise(vec3(p, t + 40.0)) + 0.35 * gradientNoise(vec3(p * 2.1, 1.3 * t + 70.0));
  return clamp(0.5 + hazeContrast * n, 0.0, 1.0) * hazeOpacity;
}

void main() {
  vec2 pixel = gl_FragCoord.xy;
  float row = floor(pixel.y / cell);
  float offset = mod(row, 2.0) * 0.5;
  vec2 center = vec2((floor(pixel.x / cell - offset) + offset + 0.5) * cell, (row + 0.5) * cell);

  float influence = pointerInfluence(center);
  float field = clamp(flowField(center) + pointerStrength * influence, 0.0, 1.0);
  float size = smoothstep(range.x, range.y, field);
  float radius = min(mix(minRadius, maxRadius, size) * (1.0 + pointerGrowth * influence), 0.5 * cell);
  float disc = 1.0 - smoothstep(radius - 0.6, radius + 0.6, length(pixel - center));
  float alpha = disc * mix(minOpacity, 1.0, size) * step(0.05, radius);

  // Premultiplied "over": dots composite on top of the gray haze.
  float gray = haze(pixel);
  vec3 rgb = heatColor(size) * alpha + vec3(gray) * (1.0 - alpha);
  gl_FragColor = vec4(rgb, alpha + gray * (1.0 - alpha)) * layerOpacity;
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

export function createHalftoneProgram(gl: WebGLRenderingContext) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}
