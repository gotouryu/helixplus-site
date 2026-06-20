(() => {
  const root = document.querySelector(".hero-mark-3d");
  if (!root) return;

  const canvas = root.querySelector(".hero-mark-canvas");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false
  });
  if (!gl) return;

  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;
    uniform mat4 uMatrix;
    uniform mat3 uNormalMatrix;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying vec3 vWorld;
    void main() {
      vNormal = normalize(uNormalMatrix * aNormal);
      vColor = aColor;
      vWorld = aPosition;
      gl_Position = uMatrix * vec4(aPosition, 1.0);
    }
  `;

  const fragmentSource = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying vec3 vWorld;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 key = normalize(vec3(-0.42, 0.66, 0.62));
      vec3 fill = normalize(vec3(0.68, -0.22, 0.48));
      float k = max(dot(n, key), 0.0);
      float f = max(dot(n, fill), 0.0);
      float rim = pow(max(1.0 - abs(n.z), 0.0), 1.25);
      float band = 0.5 + 0.5 * sin(vWorld.y * 9.0 + vWorld.x * 5.0 + vWorld.z * 10.0);
      vec3 color = vColor * (0.22 + k * 0.68 + f * 0.18);
      color += rim * vec3(0.72, 0.55, 0.34);
      color += band * 0.035;
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const program = makeProgram(gl, vertexSource, fragmentSource);
  if (!program) return;

  const loc = {
    position: gl.getAttribLocation(program, "aPosition"),
    normal: gl.getAttribLocation(program, "aNormal"),
    color: gl.getAttribLocation(program, "aColor"),
    matrix: gl.getUniformLocation(program, "uMatrix"),
    normalMatrix: gl.getUniformLocation(program, "uNormalMatrix")
  };

  const mesh = buildMesh();
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.STATIC_DRAW);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.clearColor(0, 0, 0, 0);

  root.classList.add("is-ready");

  let reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
    reduce = event.matches;
  });

  const draw = (time) => {
    resize();
    const t = reduce ? 1.4 : time * 0.001;
    const turn = 0.48 + t * 0.52;
    const model = multiply(
      rotateX(-0.1 + Math.sin(t * 0.7) * 0.06),
      rotateY(turn),
      rotateZ(Math.sin(t * 0.35) * 0.025),
      scale(0.92, 0.92, 0.92)
    );
    const matrix = multiply(
      perspective(33 * Math.PI / 180, canvas.width / canvas.height, 0.1, 24),
      translate(0, -0.02, -4.7),
      model
    );

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc.position);
    gl.enableVertexAttribArray(loc.normal);
    gl.enableVertexAttribArray(loc.color);
    gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(loc.color, 3, gl.FLOAT, false, 36, 24);
    gl.uniformMatrix4fv(loc.matrix, false, matrix);
    gl.uniformMatrix3fv(loc.normalMatrix, false, normalFromModel(model));
    gl.drawArrays(gl.TRIANGLES, 0, mesh.length / 9);
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);

  function buildMesh() {
    const out = [];
    const black = [0.05, 0.05, 0.052];
    const steel = [0.68, 0.68, 0.65];
    const gold = [0.86, 0.56, 0.29];

    ribbon(out, 0, steel, gold);
    ribbon(out, Math.PI, gold, black);
    for (let i = 0; i < 9; i += 1) {
      const y = -1.02 + i * 0.255;
      rung(out, y, i % 2 ? gold : steel);
    }
    box(out, [0, -0.1, 0.42], [0.32, 0.1, 0.1], gold);
    box(out, [0, -0.1, 0.42], [0.1, 0.32, 0.1], gold);
    return out;
  }

  function ribbon(out, phase, colorA, colorB) {
    const turns = Math.PI * 2.35;
    const radius = 0.46;
    const width = 0.115;
    const thick = 0.08;
    const segs = 168;
    const rings = [];
    for (let i = 0; i <= segs; i += 1) {
      const v = i / segs;
      const y = -1.22 + v * 2.44;
      const a = phase + v * turns;
      const c = [Math.cos(a) * radius, y, Math.sin(a) * radius];
      const tangent = norm([-Math.sin(a) * radius * turns, 2.44, Math.cos(a) * radius * turns]);
      const radial = norm([Math.cos(a), 0, Math.sin(a)]);
      const side = norm(cross(tangent, radial));
      rings.push([
        add(c, add(mul(radial, -width), mul(side, -thick))),
        add(c, add(mul(radial, width), mul(side, -thick))),
        add(c, add(mul(radial, width), mul(side, thick))),
        add(c, add(mul(radial, -width), mul(side, thick))),
        mix(colorA, colorB, 0.5 + 0.5 * Math.sin(a))
      ]);
    }
    for (let i = 0; i < segs; i += 1) {
      const a = rings[i];
      const b = rings[i + 1];
      quad(out, a[0], b[0], b[1], a[1], a[4]);
      quad(out, a[1], b[1], b[2], a[2], a[4]);
      quad(out, a[2], b[2], b[3], a[3], a[4]);
      quad(out, a[3], b[3], b[0], a[0], a[4]);
    }
  }

  function rung(out, y, color) {
    const turns = Math.PI * 2.35;
    const v = (y + 1.22) / 2.44;
    const a = v * turns;
    const radius = 0.32;
    const p1 = [Math.cos(a) * radius, y, Math.sin(a) * radius];
    const p2 = [Math.cos(a + Math.PI) * radius, y, Math.sin(a + Math.PI) * radius];
    beam(out, p1, p2, 0.045, color);
  }

  function beam(out, a, b, size, color) {
    const dir = norm(sub(b, a));
    const up = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const s = norm(cross(dir, up));
    const t = norm(cross(s, dir));
    const ptsA = [
      add(a, add(mul(s, -size), mul(t, -size))),
      add(a, add(mul(s, size), mul(t, -size))),
      add(a, add(mul(s, size), mul(t, size))),
      add(a, add(mul(s, -size), mul(t, size)))
    ];
    const ptsB = [
      add(b, add(mul(s, -size), mul(t, -size))),
      add(b, add(mul(s, size), mul(t, -size))),
      add(b, add(mul(s, size), mul(t, size))),
      add(b, add(mul(s, -size), mul(t, size)))
    ];
    for (let i = 0; i < 4; i += 1) {
      quad(out, ptsA[i], ptsB[i], ptsB[(i + 1) % 4], ptsA[(i + 1) % 4], color);
    }
    quad(out, ptsA[3], ptsA[2], ptsA[1], ptsA[0], color);
    quad(out, ptsB[0], ptsB[1], ptsB[2], ptsB[3], color);
  }

  function box(out, center, size, color) {
    const [x, y, z] = center;
    const [w, h, d] = size;
    const p = [
      [x - w / 2, y - h / 2, z - d / 2], [x + w / 2, y - h / 2, z - d / 2],
      [x + w / 2, y + h / 2, z - d / 2], [x - w / 2, y + h / 2, z - d / 2],
      [x - w / 2, y - h / 2, z + d / 2], [x + w / 2, y - h / 2, z + d / 2],
      [x + w / 2, y + h / 2, z + d / 2], [x - w / 2, y + h / 2, z + d / 2]
    ];
    quad(out, p[4], p[5], p[6], p[7], color);
    quad(out, p[1], p[0], p[3], p[2], color);
    quad(out, p[0], p[4], p[7], p[3], color);
    quad(out, p[5], p[1], p[2], p[6], color);
    quad(out, p[3], p[7], p[6], p[2], color);
    quad(out, p[0], p[1], p[5], p[4], color);
  }

  function quad(out, a, b, c, d, color) {
    const n = norm(cross(sub(b, a), sub(c, a)));
    vert(out, a, n, color); vert(out, b, n, color); vert(out, c, n, color);
    vert(out, a, n, color); vert(out, c, n, color); vert(out, d, n, color);
  }

  function vert(out, p, n, c) {
    out.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2]);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function makeProgram(gl, vsSource, fsSource) {
    const vs = shader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = shader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  }

  function shader(gl, type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }

  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, (2 * far * near) * nf, 0
    ]);
  }

  function multiply(...matrices) {
    return matrices.reduce((a, b) => {
      const out = new Float32Array(16);
      for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 4; c += 1) {
          out[c * 4 + r] =
            a[0 * 4 + r] * b[c * 4 + 0] +
            a[1 * 4 + r] * b[c * 4 + 1] +
            a[2 * 4 + r] * b[c * 4 + 2] +
            a[3 * 4 + r] * b[c * 4 + 3];
        }
      }
      return out;
    });
  }

  function translate(x, y, z) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }

  function scale(x, y, z) {
    return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
  }

  function rotateX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }

  function rotateY(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }

  function rotateZ(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function normalFromModel(m) {
    return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
  }

  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
})();
