export const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

out vec4 outColor;

uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uDist;
uniform mat3 uBody;
uniform vec3 uSeed;
uniform float uSpin;
uniform float uDrift;
uniform float uSea;
uniform float uRelief;
uniform float uClouds;
uniform float uAtmo;
uniform float uIce;
uniform float uRings;
uniform float uLight;
uniform float uEmissive;
uniform float uGas;
uniform vec3 uOcean;
uniform vec3 uLow;
uniform vec3 uHigh;
uniform vec3 uAir;

const float RING_IN = 1.38;
const float RING_OUT = 2.35;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p, int octaves) {
  float amplitude = 0.5;
  float sum = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amplitude * noise(p);
    p = p * 2.03 + vec3(11.3, 7.1, 3.7);
    amplitude *= 0.5;
  }
  return sum;
}

vec3 spin(vec3 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

float terrain(vec3 p) {
  vec3 q = p * 1.55 + uSeed;
  vec3 warp = vec3(fbm(q + 1.7, 2), fbm(q + 9.2, 2), fbm(q + 5.1, 2)) - 0.375;
  float base = fbm(q + warp * 1.5, 6);
  float ridge = 1.0 - abs(2.0 * noise(q * 3.1 + warp * 2.0 + 4.0) - 1.0);
  float detail = fbm(q * 7.0 + 2.3, 4) - 0.47;
  return base + (ridge * ridge - 0.35) * 0.09 * uRelief + detail * (0.035 + 0.05 * uRelief);
}

float seaLevel() {
  return mix(0.33, 0.66, uSea);
}

float cloudField(vec3 p) {
  if (uClouds < 0.01) return 0.0;
  vec3 q = spin(p, uDrift) * 2.6 + uSeed.zxy;
  q.y *= 1.5;
  vec3 swirl = vec3(fbm(q * 0.8 + 3.0, 2), fbm(q * 0.8 + 7.0, 2), fbm(q * 0.8 + 13.0, 2)) - 0.375;
  float c = fbm(q + swirl * 2.2, 5) + (fbm(q * 6.0 + swirl * 4.0, 3) - 0.44) * 0.16;
  float threshold = mix(0.74, 0.38, uClouds);
  return smoothstep(threshold, threshold + 0.13, c);
}

float ringDensity(float r) {
  if (uRings < 0.01) return 0.0;
  float edge = smoothstep(RING_IN, RING_IN + 0.05, r) * (1.0 - smoothstep(RING_OUT - 0.08, RING_OUT, r));
  float bands = noise(vec3(r * 21.0, uSeed.x, 0.5)) * 0.6 + noise(vec3(r * 67.0, uSeed.y, 1.5)) * 0.4;
  float gap = smoothstep(0.02, 0.07, abs(r - mix(1.75, 2.0, fract(uSeed.z))));
  return edge * gap * (0.25 + 0.75 * smoothstep(0.25, 0.75, bands)) * uRings;
}

vec3 stars(vec3 d) {
  vec3 color = vec3(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float scale = layer == 0 ? 70.0 : 150.0;
    vec3 g = d * scale;
    vec3 id = floor(g);
    vec3 f = fract(g) - 0.5;
    float h = hash(id + float(layer) * 13.0);
    vec3 offset = (vec3(hash(id + 1.0), hash(id + 2.0), hash(id + 3.0)) - 0.5) * 0.6;
    float spark = smoothstep(layer == 0 ? 0.11 : 0.16, 0.0, length(f - offset));
    vec3 tint = mix(vec3(0.7, 0.82, 1.0), vec3(1.0, 0.88, 0.72), hash(id + 7.0));
    color += step(0.962, h) * spark * spark * (0.3 + 1.4 * pow(hash(id + 5.0), 3.0)) * tint;
  }
  float dust = fbm(d * 1.6 + uSeed * 0.1, 4);
  color += pow(dust * 1.35, 7.0) * 0.028 * mix(uAir, vec3(0.35, 0.4, 0.7), 0.6);
  return color;
}

vec3 rockSurface(vec3 p, vec3 light, vec3 view, out float lit) {
  vec3 s = spin(p, uSpin);
  float level = seaLevel();
  float h = terrain(s);
  float e = h - level;
  vec3 normal = p;
  vec3 color;
  float specular = 0.0;
  float glow = 0.0;
  float latitude = abs(p.y);
  float grain = fbm(s * 9.0 + uSeed, 3);
  float iceLine = 1.02 - uIce * 0.62;

  if (e < 0.0) {
    float depth = clamp(-e / 0.16, 0.0, 1.0);
    color = mix(uOcean * 1.9 + 0.02, uOcean * 0.5, sqrt(depth));
    specular = 1.0 - uEmissive;
    float crust = smoothstep(0.38, 0.62, fbm(s * 5.0 + uSeed.yzx, 4));
    glow = uEmissive * (0.12 + 1.9 * pow(1.0 - depth, 4.0) + 1.5 * crust * crust);
    float frozen = smoothstep(iceLine + 0.02, iceLine + 0.1, latitude + (grain - 0.4) * 0.22) * step(0.001, uIce) * (1.0 - uEmissive);
    color = mix(color, vec3(0.82, 0.9, 0.96), frozen);
    specular *= 1.0 - frozen * 0.7;
  } else {
    float eps = 0.006;
    vec3 tangent = normalize(cross(p, vec3(0.31, 0.83, 0.46)));
    vec3 bitangent = cross(p, tangent);
    float hx = terrain(spin(normalize(p + tangent * eps), uSpin));
    float hy = terrain(spin(normalize(p + bitangent * eps), uSpin));
    vec3 gradient = (tangent * (hx - h) + bitangent * (hy - h)) / eps;
    normal = normalize(p - gradient * (0.25 + 0.55 * uRelief));
    float t = clamp(e / 0.22, 0.0, 1.0);
    color = mix(uLow, uHigh, smoothstep(0.08, 0.62, t + (grain - 0.4) * 0.3));
    color = mix(color, mix(uLow, vec3(0.76, 0.7, 0.55), 0.45), (1.0 - smoothstep(0.0, 0.035, t)) * (1.0 - uEmissive));
    color *= 0.78 + 0.5 * grain;
    float snow = smoothstep(iceLine - 0.06, iceLine + 0.05, latitude + t * 0.3 + (grain - 0.4) * 0.22) * step(0.001, uIce);
    color = mix(color, vec3(0.9, 0.94, 1.0), snow);
    glow = uEmissive * pow(1.0 - smoothstep(0.0, 0.05, t), 2.0) * 0.6;
  }

  float diffuse = max(dot(normal, light), 0.0);
  float wrap = smoothstep(-0.12, 0.3, dot(p, light));
  lit = wrap;
  vec3 shaded = color * diffuse * wrap;
  vec3 halfway = normalize(light + view);
  shaded += specular * pow(max(dot(p, halfway), 0.0), 320.0) * 0.6 * wrap * vec3(1.0, 0.95, 0.86);
  shaded += specular * pow(max(dot(p, halfway), 0.0), 24.0) * 0.05 * wrap * (uOcean + 0.25);
  shaded += uOcean * glow * 1.35;
  shaded += color * 0.012;
  return shaded;
}

vec3 gasSurface(vec3 p, vec3 light, out float lit) {
  vec3 s = spin(p, uSpin);
  float turbulence = 0.25 + uRelief;
  float curl = fbm(s * vec3(2.4, 5.0, 2.4) + uSeed, 4) - 0.47;
  float y = p.y * (4.5 + 5.0 * uRelief) + curl * turbulence * 1.5;
  float bandA = noise(vec3(uSeed.x, y, uSeed.z));
  float bandB = noise(vec3(uSeed.y, y * 2.7 + 9.0, uSeed.x));
  float fine = fbm(vec3(s.x * 3.0, p.y * 26.0 + curl * 3.0, s.z * 3.0) + uSeed, 4);
  vec3 color = mix(uOcean, uLow, smoothstep(0.3, 0.7, bandA));
  color = mix(color, uHigh, smoothstep(0.55, 0.85, bandB) * 0.75);
  color *= 0.72 + 0.6 * fine;
  vec3 stormCenter = normalize(vec3(sin(uSeed.x), -0.38, cos(uSeed.x)));
  vec3 delta = s - stormCenter;
  float storm = 1.0 - smoothstep(0.0, 1.0, length(delta * vec3(4.2, 8.5, 4.2)));
  color = mix(color, uHigh * 1.25 + 0.05, storm * 0.8);
  float diffuse = max(dot(p, light), 0.0);
  lit = smoothstep(-0.1, 0.3, dot(p, light));
  return color * pow(diffuse, 0.85) * lit + color * 0.008;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y) - uCenter;
  vec3 viewRay = normalize(vec3(uv, -2.6));
  vec3 ro = vec3(0.0, 0.0, uDist) * uBody;
  vec3 rd = viewRay * uBody;
  float angle = radians(uLight);
  vec3 light = normalize(vec3(sin(angle), 0.28, cos(angle))) * uBody;

  vec3 color = stars(viewRay);

  float b = dot(ro, rd);
  float c = dot(ro, ro) - 1.0;
  float disc = b * b - c;
  bool hit = disc > 0.0 && b < 0.0;
  float tPlanet = hit ? -b - sqrt(disc) : 1e9;

  vec3 air = pow(uAir, vec3(2.2));
  vec3 closest = ro + rd * max(-b, 0.0);
  float miss = length(closest);

  if (hit) {
    vec3 p = ro + rd * tPlanet;
    vec3 view = -rd;
    float lit;
    vec3 surface = uGas > 0.5 ? gasSurface(p, light, lit) : rockSurface(p, light, view, lit);

    if (uGas < 0.5) {
      float shadow = cloudField(normalize(p + light * 0.035));
      surface *= 1.0 - 0.5 * shadow;
      float cover = cloudField(p);
      float cloudLight = max(dot(p, light), 0.0) * lit;
      vec3 cloudColor = mix(vec3(0.95), air * 1.2 + 0.2, 0.18 * (1.0 - cloudLight)) * (cloudLight + 0.012);
      surface = mix(surface, cloudColor, cover * 0.93);
    }

    if (uRings > 0.01 && abs(light.y) > 0.001) {
      float tr = -p.y / light.y;
      if (tr > 0.0) {
        vec3 q = p + light * tr;
        surface *= 1.0 - 0.72 * ringDensity(length(q.xz));
      }
    }

    float rim = pow(1.0 - max(dot(p, view), 0.0), 2.6);
    surface = mix(surface, air * (0.25 + 1.3 * lit), clamp(rim * uAtmo * 1.15, 0.0, 0.92) * (0.25 + 0.75 * lit));
    surface += air * uAtmo * 0.16 * lit * (1.0 - rim);
    color = surface;
  } else {
    float scale = 0.014 + 0.05 * uAtmo;
    float halo = exp(-(miss - 1.0) / scale) * uAtmo;
    float haloLit = smoothstep(-0.45, 0.55, dot(normalize(closest), light));
    color += air * halo * (0.06 + 1.5 * haloLit);
  }

  if (uRings > 0.01 && abs(rd.y) > 0.0001) {
    float tRing = -ro.y / rd.y;
    if (tRing > 0.0 && tRing < tPlanet) {
      vec3 q = ro + rd * tRing;
      float r = length(q.xz);
      float density = ringDensity(r);
      if (density > 0.0) {
        float sb = dot(q, light);
        float sd = sb * sb - (dot(q, q) - 1.0);
        float shade = (sd > 0.0 && sb < 0.0) ? 1.0 - smoothstep(0.0, 0.05, sd) : 1.0;
        vec3 ringBase = mix(uHigh, uLow, noise(vec3(r * 9.0, uSeed.y, 2.5))) * 0.9 + 0.08;
        float forward = pow(max(dot(rd, light), 0.0), 6.0);
        vec3 ringColor = ringBase * (0.03 + (0.75 + 0.9 * forward) * shade * (0.35 + 0.65 * abs(light.y) * 3.0));
        color = mix(color, ringColor, clamp(density * 0.95, 0.0, 1.0));
      }
    }
  }

  color = 1.0 - exp(-color * 1.7);
  color = pow(color, vec3(1.0 / 2.2));
  float vignette = 1.0 - 0.22 * dot(uv + uCenter, uv + uCenter) * 0.35;
  color *= vignette;
  color += (hash(vec3(gl_FragCoord.xy, 1.0)) - 0.5) / 255.0;
  outColor = vec4(color, 1.0);
}`;
