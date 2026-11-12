/* Fundo animado do /next-step: o mesmo da homepage (PrismFilm do shadcnspace, WebGL2),
   com os mesmos parametros de prism-background.tsx. Shaders copiados sem alteracao. */
(function () {
'use strict';
var MAX_DPR = 2;
var LAYERS = 80;
var NEAR_SPLIT = 14;
var SMEAR = 0.012;
var TILT_RATE = 4;

var VERT_SRC = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`;

var FIELD_SRC = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec3 uC1; uniform vec3 uC2; uniform float uSize; uniform float uAngle;
out vec4 o;
const float TAU = 6.28318530718;
const float LAYERS = ${LAYERS.toFixed(1)};
const float GAIN = 0.5;
const vec2 CENTRE = vec2(0.36, 0.52);
const float TILT = 2.4; const float ZOOM = 1.05; const float THETA = 2.12; const float SHEAR = 0.958; const float SHRINK = 0.95;
const vec2 WARP_FREQ = vec2(0.5, 2.7); const vec2 WARP_AMP = vec2(0.14, 0.03); const vec2 ASPECT = vec2(1.8, 0.2);
const float OFFSET = 0.33; const float GLOW = 0.0021; const float SOFT = 0.0019; const float FALLOFF = 0.37;
const float PHASE = 40.0; const float CYCLE = 0.16; const float HUE_TRAVEL = 2.0;
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
void main() {
  vec2 R = uRes;
  vec2 pos = (gl_FragCoord.xy - 0.5 * R) / R.y;
  pos = rot(uAngle) * pos / uSize;
  float t = uTime * 0.49 + PHASE;
  float breath = (-sin(uTime * 0.735) + sin(uTime * 0.49 + 1.0)) * 0.25 + 0.5;
  vec2 u = rot(TILT) * ((pos - CENTRE) * (ZOOM - breath * 0.085));
  mat2 fold = mat2(cos(THETA), sin(THETA), -SHEAR, cos(THETA));
  vec3 col = vec3(0.0);
  for (float i = 1.0; i <= LAYERS; i += 1.0) {
    u.x -= sin(u.y * WARP_FREQ.x + t + i * 0.007) * WARP_AMP.x;
    u.y -= sin(u.x * WARP_FREQ.y - t + i * 0.02) * WARP_AMP.y;
    u = fold * u * SHRINK;
    vec2 q = (u - vec2(OFFSET + breath * 0.1, 0.0)) * ASPECT;
    float g = GLOW / (dot(q, q) + SOFT) * (0.25 + breath * 0.4);
    float r = length(u);
    float k = sin(i * CYCLE + t * 1.2 + r * HUE_TRAVEL) * 0.5 + 0.5;
    col += g * mix(uC1, uC2, k) * (0.62 + 0.5 * k) * exp2(-r * FALLOFF);
  }
  vec3 x = max(col * GAIN, 0.0);
  col = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.85, 0.92, 0.98));
  col *= 1.0 - smoothstep(0.5, 1.6, length(pos)) * 0.07;
  o = vec4(col, 1.0);
}
`;

var FINISH_SRC = `#version 300 es
precision highp float;
uniform sampler2D uField; uniform vec2 uRes; uniform float uTime; uniform vec3 uBg; uniform float uPaper; uniform float uPR;
uniform vec2 uMouse; uniform float uOn; uniform float uReach; uniform vec2 uVel; uniform vec2 uTilt; uniform float uSplit;
out vec4 o;
const float NEAR_SPLIT = ${NEAR_SPLIT.toFixed(3)};
const float SMEAR = ${SMEAR.toFixed(4)};
float ign(vec2 p, float f) { p += 5.588238 * mod(f, 64.0); return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y)); }
vec3 scene(vec2 uv) { return texture(uField, clamp(uv, 0.0, 1.0)).rgb; }
float near(vec2 p) { vec2 d = (p - uMouse) / (uPR * uReach); return uOn * exp(-dot(d, d)); }
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 prism(vec2 frag, vec2 uv) {
  float time = uTime * 0.22;
  float w = near(frag);
  float ang = time * 0.7 + uv.y * 1.6;
  vec2 dir = vec2(cos(ang), sin(ang)) * (1.0 - 0.5 * min(length(uTilt), 1.0)) + uTilt * 1.6;
  vec2 px = dir * uSplit;
  if (w > 1e-4) px += dir * NEAR_SPLIT * w + uVel * SMEAR * w;
  vec2 split = px * uPR / uRes;
  vec3 base = scene(uv);
  vec3 refr = vec3(scene(uv + split).r, base.g, scene(uv - split).b);
  float inten = length(base) * 0.57735;
  float presence = smoothstep(0.025, 0.2, inten);
  float phase = inten * 4.0 + dot(uv, vec2(1.6, -1.2)) + time + dot(uTilt, vec2(2.4, -1.6));
  float coat = smoothstep(0.04, 0.28, inten) * (1.0 - smoothstep(0.72, 1.0, inten));
  vec3 hsv = rgb2hsv(max(refr, 0.0));
  hsv.x += sin(phase) * (0.07 + 0.1 * w) * coat;
  hsv.y += (1.0 - hsv.y) * coat * 0.22 * smoothstep(0.04, 0.16, hsv.y);
  return mix(base, hsv2rgb(hsv), presence);
}
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec3 L = max(prism(frag, frag / uRes), 0.0);
  vec3 dark = uBg + L * (1.0 - uBg);
  float strength = clamp(max(L.r, max(L.g, L.b)), 0.0, 1.0);
  vec3 paper = uBg * (1.0 - strength) + L * 0.96;
  vec3 col = mix(dark, paper, uPaper);
  col += (ign(frag, floor(uTime * 24.0)) - 0.5) / 255.0;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
var P = { bg: [26/255, 115/255, 235/255], c1: [102/255, 184/255, 255/255], c2: [219/255, 238/255, 255/255], speed: 34/50, size: 1.4, angle: -28*Math.PI/180, split: 16, hover: 0.6, reach: 320, start: 18 };
var clampN = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
function prog(gl, frag) {
  var sh = function (t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
  var vs = sh(gl.VERTEX_SHADER, VERT_SRC), fs = sh(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}
function uni(gl, p, names) { var o = {}; names.forEach(function (n) { o[n] = gl.getUniformLocation(p, n); }); return o; }
function target(gl) {
  var fbo = gl.createFramebuffer(), tex = null, w = 0, h = 0, half = !!gl.getExtension('EXT_color_buffer_float');
  return {
    fbo: fbo, tex: function () { return tex; }, w: function () { return w; }, h: function () { return h; },
    resize: function (nw, nh) {
      if (nw === w && nh === h && tex) return;
      for (var a = 0; a < 2; a++) {
        if (tex) gl.deleteTexture(tex);
        tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, half ? gl.RGBA16F : gl.RGBA8, nw, nh, 0, gl.RGBA, half ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (ok || !half) break; half = false;
      }
      w = nw; h = nh;
    }
  };
}
var root = document.getElementById('prism');
if (!root) return;
var canvas = document.createElement('canvas');
canvas.setAttribute('aria-hidden', 'true');
canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
root.appendChild(canvas);
var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false });
var field = gl && prog(gl, FIELD_SRC), finish = gl && prog(gl, FINISH_SRC);
// shortcut: sem WebGL2 fica so a cor base #1a73eb da pagina, sem o efeito; melhorar se houver aparelho relevante sem WebGL2.
if (!field || !finish) { canvas.remove(); return; }
var uf = uni(gl, field, ['uRes', 'uTime', 'uC1', 'uC2', 'uSize', 'uAngle']);
var un = uni(gl, finish, ['uField', 'uRes', 'uTime', 'uBg', 'uPaper', 'uPR', 'uMouse', 'uOn', 'uReach', 'uVel', 'uTilt', 'uSplit']);
gl.bindVertexArray(gl.createVertexArray());
var tg = target(gl);
var ptr = { tx: 0, ty: 0, inside: false };
window.addEventListener('pointermove', function (e) { ptr.tx = e.clientX; ptr.ty = e.clientY; ptr.inside = e.clientX >= 0 && e.clientX <= innerWidth && e.clientY >= 0 && e.clientY <= innerHeight; }, { passive: true });
document.addEventListener('pointerout', function (e) { if (!e.relatedTarget) ptr.inside = false; });
var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
var mx = 0, my = 0, vx = 0, vy = 0, on = 0, tiltX = 0, tiltY = 0, last = -1, clock = P.start;
function render(now) {
  requestAnimationFrame(render);
  var dt = last < 0 ? 0 : clampN((now - last) / 1000, 0, 0.05); last = now;
  if (document.hidden) return;
  clock = (clock + dt * P.speed * (reduce ? 0 : 1)) % 3600;
  var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR), cw = canvas.clientWidth || 1200, ch = canvas.clientHeight || 800;
  var bw = Math.max(1, Math.round(cw * dpr)), bh = Math.max(1, Math.round(ch * dpr));
  if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  tg.resize(Math.max(1, Math.round(bw / 2)), Math.max(1, Math.round(bh / 2)));
  var present = ptr.inside ? 1 : 0;
  if (present && on < 0.02) { mx = ptr.tx; my = ptr.ty; }
  on += (present - on) * (1 - Math.exp(-dt * 5));
  var k = 1 - Math.exp(-dt * 16), nx = mx + (ptr.tx - mx) * k, ny = my + (ptr.ty - my) * k;
  if (dt > 0) { var kv = 1 - Math.exp(-dt * 8); vx += ((nx - mx) / dt - vx) * kv; vy += ((ny - my) / dt - vy) * kv; }
  mx = nx; my = ny;
  var vLen = Math.hypot(vx, vy) / ch, vCap = vLen > 3 ? 3 / vLen : 1, weight = on * P.hover, kt = 1 - Math.exp(-dt * TILT_RATE);
  tiltX += (clampN((mx / cw - 0.5) * 2, -1, 1) * weight - tiltX) * kt;
  tiltY += (clampN((0.5 - my / ch) * 2, -1, 1) * weight - tiltY) * kt;
  var bg = P.bg, bgLum = 0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2];
  gl.bindFramebuffer(gl.FRAMEBUFFER, tg.fbo); gl.viewport(0, 0, tg.w(), tg.h()); gl.useProgram(field);
  gl.uniform2f(uf.uRes, tg.w(), tg.h()); gl.uniform1f(uf.uTime, clock);
  gl.uniform3f(uf.uC1, P.c1[0], P.c1[1], P.c1[2]); gl.uniform3f(uf.uC2, P.c2[0], P.c2[1], P.c2[2]);
  gl.uniform1f(uf.uSize, P.size); gl.uniform1f(uf.uAngle, P.angle); gl.drawArrays(gl.TRIANGLES, 0, 3);
  var pr = bw / cw;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, bw, bh); gl.useProgram(finish);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tg.tex()); gl.uniform1i(un.uField, 0);
  gl.uniform2f(un.uRes, bw, bh); gl.uniform1f(un.uTime, clock); gl.uniform3f(un.uBg, bg[0], bg[1], bg[2]);
  gl.uniform1f(un.uPaper, clampN((bgLum - 0.35) / 0.3, 0, 1)); gl.uniform1f(un.uPR, pr);
  gl.uniform2f(un.uMouse, mx * pr, bh - my * (bh / ch)); gl.uniform1f(un.uOn, weight); gl.uniform1f(un.uReach, P.reach);
  gl.uniform2f(un.uVel, vx * vCap, -vy * vCap); gl.uniform2f(un.uTilt, tiltX, tiltY); gl.uniform1f(un.uSplit, P.split);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
requestAnimationFrame(render);
})();
