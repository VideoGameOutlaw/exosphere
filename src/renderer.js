import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders.js';
import { seedOffset } from './settings.js';

const UNIFORMS = [
  'uRes', 'uCenter', 'uDist', 'uBody', 'uSeed', 'uSpin', 'uDrift', 'uSea', 'uRelief', 'uClouds', 'uAtmo',
  'uIce', 'uRings', 'uLight', 'uEmissive', 'uGas', 'uOcean', 'uLow', 'uHigh', 'uAir',
];

function hexToRgb(hex) {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
}

const toLinear = (rgb) => rgb.map((channel) => channel ** 2.2);

export class PlanetRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('This browser or device does not support WebGL2.');
    this.gl = gl;
    this.maxPixelRatio = 1.75;
    this.yaw = 0.5;
    this.pitch = 0.34;
    this.distance = 4.3;
    this.center = [0, 0];
    this.frames = 0;

    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX_SHADER], [gl.FRAGMENT_SHADER, FRAGMENT_SHADER]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`Shader failed to compile: ${gl.getShaderInfoLog(shader)}`);
      }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Shader program failed to link: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    this.vertexArray = gl.createVertexArray();
    this.locations = Object.fromEntries(UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]));
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width === width && this.canvas.height === height) return false;
    this.canvas.width = width;
    this.canvas.height = height;
    return true;
  }

  orbit(deltaYaw, deltaPitch) {
    this.yaw += deltaYaw;
    this.pitch = Math.min(1.35, Math.max(-1.35, this.pitch + deltaPitch));
  }

  zoom(factor) {
    this.distance = Math.min(9, Math.max(2.7, this.distance * factor));
  }

  resetView() {
    this.yaw = 0.5;
    this.pitch = 0.34;
    this.distance = 4.3;
  }

  render(settings, elapsed) {
    const { gl, locations } = this;
    this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);

    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    gl.uniformMatrix3fv(locations.uBody, false, [cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]);
    gl.uniform2f(locations.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(locations.uCenter, this.center[0], this.center[1]);
    gl.uniform1f(locations.uDist, this.distance);
    gl.uniform3fv(locations.uSeed, seedOffset(settings.seed));
    gl.uniform1f(locations.uSpin, elapsed * settings.spin * 0.12);
    gl.uniform1f(locations.uDrift, elapsed * (0.012 + settings.spin * 0.15));
    gl.uniform1f(locations.uSea, settings.sea);
    gl.uniform1f(locations.uRelief, settings.relief);
    gl.uniform1f(locations.uClouds, settings.clouds);
    gl.uniform1f(locations.uAtmo, settings.atmosphere);
    gl.uniform1f(locations.uIce, settings.ice);
    gl.uniform1f(locations.uRings, settings.rings);
    gl.uniform1f(locations.uLight, settings.light);
    gl.uniform1f(locations.uEmissive, settings.emissive);
    gl.uniform1f(locations.uGas, settings.type === 'gas' ? 1 : 0);
    gl.uniform3fv(locations.uOcean, toLinear(hexToRgb(settings.colors.ocean)));
    gl.uniform3fv(locations.uLow, toLinear(hexToRgb(settings.colors.low)));
    gl.uniform3fv(locations.uHigh, toLinear(hexToRgb(settings.colors.high)));
    gl.uniform3fv(locations.uAir, hexToRgb(settings.colors.air));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.frames += 1;
  }

  samplePixel(x, y) {
    const { gl } = this;
    const pixel = new Uint8Array(4);
    gl.readPixels(Math.round(x * this.canvas.width), Math.round(y * this.canvas.height), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return Array.from(pixel);
  }
}
