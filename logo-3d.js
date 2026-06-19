(() => {
  const stage = document.querySelector(".hero-logo-3d");
  if (!stage) return;

  const canvas = stage.querySelector(".hero-logo-canvas");
  const source = stage.dataset.logoSrc || "./assets/helixplus-mark.png";
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false
  });

  if (!gl) return;

  const vertexShader = `
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

  const fragmentShader = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying vec3 vWorld;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 lightA = normalize(vec3(-0.45, 0.72, 0.52));
      vec3 lightB = normalize(vec3(0.7, -0.25, 0.45));
      float key = max(dot(n, lightA), 0.0);
      float rim = pow(max(1.0 - abs(n.z), 0.0), 2.0);
      float fill = max(dot(n, lightB), 0.0) * 0.34;
      float sideDepth = pow(max(1.0 - abs(n.z), 0.0), 0.72);
      float metalBand = 0.5 + 0.5 * sin((vWorld.y * 8.0) + (vWorld.x * 5.0) + vWorld.z * 20.0);
      vec3 gold = vec3(1.0, 0.72, 0.42);
      vec3 steel = vec3(0.82, 0.82, 0.78);
      vec3 darkSteel = vec3(0.08, 0.08, 0.08);
      vec3 metal = mix(steel, gold, metalBand * 0.38);
      vec3 base = mix(vColor, metal, 0.44);
      base = mix(base, darkSteel, sideDepth * 0.42);
      vec3 color = base * (0.34 + key * 0.88 + fill) + rim * vec3(1.0, 0.82, 0.58);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const program = createProgram(gl, vertexShader, fragmentShader);
  if (!program) return;

  const attributes = {
    position: gl.getAttribLocation(program, "aPosition"),
    normal: gl.getAttribLocation(program, "aNormal"),
    color: gl.getAttribLocation(program, "aColor")
  };
  const uniforms = {
    matrix: gl.getUniformLocation(program, "uMatrix"),
    normalMatrix: gl.getUniformLocation(program, "uNormalMatrix")
  };

  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    const mesh = buildLogoMesh(image);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

    gl.useProgram(program);
    gl.enableVertexAttribArray(attributes.position);
    gl.enableVertexAttribArray(attributes.normal);
    gl.enableVertexAttribArray(attributes.color);
    gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(attributes.color, 3, gl.FLOAT, false, 36, 24);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 0);
    stage.classList.add("is-ready");

    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (event) => {
      reduced = event.matches;
    });

    const render = (time) => {
      resizeCanvas();
      const t = reduced ? 0.2 : time * 0.001;
      const spin = t * 0.52;
      const nod = Math.sin(t * 0.9) * 0.11;
      const matrix = multiply(
        perspective(36 * Math.PI / 180, canvas.width / canvas.height, 0.1, 20),
        translate(0, -0.04, -3.25),
        rotateX(-0.08 + nod),
        rotateY(spin),
        rotateZ(Math.sin(t * 0.47) * 0.035),
        scale(1.72, 1.72, 1.72)
      );
      const normalMatrix = normalFromModel(
        multiply(
          rotateX(-0.08 + nod),
          rotateY(spin),
          rotateZ(Math.sin(t * 0.47) * 0.035)
        )
      );

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(uniforms.matrix, false, matrix);
      gl.uniformMatrix3fv(uniforms.normalMatrix, false, normalMatrix);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  };
  image.src = source;

  function buildLogoMesh(img) {
    const sample = 106;
    const ctxCanvas = document.createElement("canvas");
    ctxCanvas.width = sample;
    ctxCanvas.height = sample;
    const ctx = ctxCanvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, sample, sample);
    ctx.drawImage(img, 0, 0, sample, sample);
    const data = ctx.getImageData(0, 0, sample, sample).data;
    const solid = new Uint8Array(sample * sample);
    for (let y = 0; y < sample; y += 1) {
      for (let x = 0; x < sample; x += 1) {
        solid[y * sample + x] = data[(y * sample + x) * 4 + 3] > 42 ? 1 : 0;
      }
    }

    const verts = [];
    const depth = 0.34;
    const step = 2 / sample;
    const half = step / 2;

    for (let y = 0; y < sample; y += 1) {
      for (let x = 0; x < sample; x += 1) {
        if (!solid[y * sample + x]) continue;
        const index = (y * sample + x) * 4;
        const rgb = [
          Math.max(data[index] / 255, 0.16),
          Math.max(data[index + 1] / 255, 0.14),
          Math.max(data[index + 2] / 255, 0.12)
        ];
        const x0 = -1 + x * step;
        const x1 = x0 + step;
        const y1 = 1 - y * step;
        const y0 = y1 - step;
        const zf = depth / 2;
        const zb = -depth / 2;
        const face = liftColor(rgb, 1.05);
        const side = liftColor(rgb, 0.52);

        quad(verts, [x0, y0, zf], [x1, y0, zf], [x1, y1, zf], [x0, y1, zf], [0, 0, 1], face);
        quad(verts, [x1, y0, zb], [x0, y0, zb], [x0, y1, zb], [x1, y1, zb], [0, 0, -1], side);

        if (!isSolid(solid, sample, x - 1, y)) {
          quad(verts, [x0, y0 + half, zb], [x0, y0 + half, zf], [x0, y1 - half, zf], [x0, y1 - half, zb], [-1, 0, 0], side);
        }
        if (!isSolid(solid, sample, x + 1, y)) {
          quad(verts, [x1, y0 + half, zf], [x1, y0 + half, zb], [x1, y1 - half, zb], [x1, y1 - half, zf], [1, 0, 0], side);
        }
        if (!isSolid(solid, sample, x, y - 1)) {
          quad(verts, [x0 + half, y1, zf], [x1 - half, y1, zf], [x1 - half, y1, zb], [x0 + half, y1, zb], [0, 1, 0], side);
        }
        if (!isSolid(solid, sample, x, y + 1)) {
          quad(verts, [x0 + half, y0, zb], [x1 - half, y0, zb], [x1 - half, y0, zf], [x0 + half, y0, zf], [0, -1, 0], side);
        }
      }
    }
    return { vertices: new Float32Array(verts), count: verts.length / 9 };
  }

  function quad(out, a, b, c, d, normal, color) {
    vertex(out, a, normal, color);
    vertex(out, b, normal, color);
    vertex(out, c, normal, color);
    vertex(out, a, normal, color);
    vertex(out, c, normal, color);
    vertex(out, d, normal, color);
  }

  function vertex(out, position, normal, color) {
    out.push(position[0], position[1], position[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
  }

  function liftColor(color, amount) {
    return color.map((value) => Math.min(1, Math.max(0.05, value * amount + 0.04)));
  }

  function isSolid(solid, size, x, y) {
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    return solid[y * size + x] === 1;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
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
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 4; col += 1) {
          out[col * 4 + row] =
            a[0 * 4 + row] * b[col * 4 + 0] +
            a[1 * 4 + row] * b[col * 4 + 1] +
            a[2 * 4 + row] * b[col * 4 + 2] +
            a[3 * 4 + row] * b[col * 4 + 3];
        }
      }
      return out;
    });
  }

  function translate(x, y, z) {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1
    ]);
  }

  function scale(x, y, z) {
    return new Float32Array([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1
    ]);
  }

  function rotateX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1
    ]);
  }

  function rotateY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1
    ]);
  }

  function rotateZ(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Float32Array([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  function normalFromModel(model) {
    return new Float32Array([
      model[0], model[1], model[2],
      model[4], model[5], model[6],
      model[8], model[9], model[10]
    ]);
  }
})();
