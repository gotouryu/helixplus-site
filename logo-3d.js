(() => {
  const stage = document.querySelector(".hero-logo-3d");
  if (!stage) return;

  const canvas = stage.querySelector(".hero-logo-canvas");
  const logoUrl = stage.dataset.logoSrc || "./assets/helixplus-mark.png";
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false
  });
  if (!gl) return;

  const meshProgram = createProgram(gl, `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    uniform mat4 uMatrix;
    uniform mat3 uNormalMatrix;
    varying vec3 vNormal;
    varying vec3 vWorld;
    void main() {
      vNormal = normalize(uNormalMatrix * aNormal);
      vWorld = aPosition;
      gl_Position = uMatrix * vec4(aPosition, 1.0);
    }
  `, `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vWorld;
    void main() {
      vec3 n = normalize(vNormal);
      vec3 keyLight = normalize(vec3(-0.45, 0.68, 0.58));
      vec3 fillLight = normalize(vec3(0.62, -0.28, 0.46));
      float key = max(dot(n, keyLight), 0.0);
      float fill = max(dot(n, fillLight), 0.0);
      float rim = pow(max(1.0 - abs(n.z), 0.0), 1.35);
      float band = 0.5 + 0.5 * sin(vWorld.y * 10.0 + vWorld.x * 6.0 + vWorld.z * 24.0);
      vec3 steel = vec3(0.72, 0.72, 0.69);
      vec3 blackChrome = vec3(0.045, 0.045, 0.047);
      vec3 champagne = vec3(1.0, 0.76, 0.48);
      vec3 base = mix(blackChrome, steel, 0.44 + band * 0.24);
      base = mix(base, champagne, band * 0.22);
      vec3 color = base * (0.32 + key * 0.92 + fill * 0.32) + rim * vec3(1.0, 0.82, 0.56);
      gl_FragColor = vec4(color, 1.0);
    }
  `);

  const textureProgram = createProgram(gl, `
    attribute vec3 aPosition;
    attribute vec2 aUv;
    uniform mat4 uMatrix;
    varying vec2 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = aUv;
      vWorld = aPosition;
      gl_Position = uMatrix * vec4(aPosition, 1.0);
    }
  `, `
    precision mediump float;
    uniform sampler2D uTexture;
    uniform float uFaceLight;
    varying vec2 vUv;
    varying vec3 vWorld;
    void main() {
      vec4 tex = texture2D(uTexture, vUv);
      if (tex.a < 0.045) discard;
      float sheen = 0.5 + 0.5 * sin(vWorld.y * 8.0 + vWorld.x * 4.0 + uFaceLight * 2.0);
      vec3 highlight = vec3(1.0, 0.78, 0.52) * sheen * 0.12;
      vec3 color = tex.rgb * (0.86 + uFaceLight * 0.28) + highlight;
      gl_FragColor = vec4(color, tex.a);
    }
  `);
  if (!meshProgram || !textureProgram) return;

  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    const sideMesh = buildSideMesh(image);
    const sideBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sideBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, sideMesh.vertices, gl.STATIC_DRAW);

    const faceBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, faceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, buildFaceVertices(), gl.STATIC_DRAW);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    stage.classList.add("is-ready");

    const meshLoc = {
      position: gl.getAttribLocation(meshProgram, "aPosition"),
      normal: gl.getAttribLocation(meshProgram, "aNormal"),
      matrix: gl.getUniformLocation(meshProgram, "uMatrix"),
      normalMatrix: gl.getUniformLocation(meshProgram, "uNormalMatrix")
    };
    const texLoc = {
      position: gl.getAttribLocation(textureProgram, "aPosition"),
      uv: gl.getAttribLocation(textureProgram, "aUv"),
      matrix: gl.getUniformLocation(textureProgram, "uMatrix"),
      faceLight: gl.getUniformLocation(textureProgram, "uFaceLight"),
      texture: gl.getUniformLocation(textureProgram, "uTexture")
    };

    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    motionQuery.addEventListener("change", (event) => {
      reduced = event.matches;
    });

    const render = (time) => {
      resizeCanvas();
      const t = reduced ? 1.4 : time * 0.001;
      const spin = 0.72 + t * 0.54;
      const model = multiply(
        rotateX(-0.1 + Math.sin(t * 0.72) * 0.1),
        rotateY(spin),
        rotateZ(Math.sin(t * 0.38) * 0.028),
        scale(1.68, 1.68, 1.68)
      );
      const matrix = multiply(
        perspective(34 * Math.PI / 180, canvas.width / canvas.height, 0.1, 20),
        translate(0, -0.035, -3.2),
        model
      );
      const normalMatrix = normalFromModel(model);
      const faceLight = 0.5 + 0.5 * Math.cos(spin);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(meshProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, sideBuffer);
      gl.enableVertexAttribArray(meshLoc.position);
      gl.enableVertexAttribArray(meshLoc.normal);
      gl.vertexAttribPointer(meshLoc.position, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(meshLoc.normal, 3, gl.FLOAT, false, 24, 12);
      gl.uniformMatrix4fv(meshLoc.matrix, false, matrix);
      gl.uniformMatrix3fv(meshLoc.normalMatrix, false, normalMatrix);
      gl.cullFace(gl.BACK);
      gl.drawArrays(gl.TRIANGLES, 0, sideMesh.count);

      gl.useProgram(textureProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, faceBuffer);
      gl.enableVertexAttribArray(texLoc.position);
      gl.enableVertexAttribArray(texLoc.uv);
      gl.vertexAttribPointer(texLoc.position, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(texLoc.uv, 2, gl.FLOAT, false, 20, 12);
      gl.uniformMatrix4fv(texLoc.matrix, false, matrix);
      gl.uniform1f(texLoc.faceLight, faceLight);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(texLoc.texture, 0);
      gl.disable(gl.CULL_FACE);
      gl.drawArrays(gl.TRIANGLES, 0, 12);
      gl.enable(gl.CULL_FACE);

      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  };
  image.src = logoUrl;

  function buildFaceVertices() {
    const zFront = 0.34;
    const zBack = -0.34;
    const front = [
      -1, -1, zFront, 0, 1,
      1, -1, zFront, 1, 1,
      1, 1, zFront, 1, 0,
      -1, -1, zFront, 0, 1,
      1, 1, zFront, 1, 0,
      -1, 1, zFront, 0, 0
    ];
    const back = [
      1, -1, zBack, 1, 1,
      -1, -1, zBack, 0, 1,
      -1, 1, zBack, 0, 0,
      1, -1, zBack, 1, 1,
      -1, 1, zBack, 0, 0,
      1, 1, zBack, 1, 0
    ];
    return new Float32Array(front.concat(back));
  }

  function buildSideMesh(img) {
    const size = 224;
    const ctxCanvas = document.createElement("canvas");
    ctxCanvas.width = size;
    ctxCanvas.height = size;
    const ctx = ctxCanvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    const alpha = new Uint8Array(size * size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        alpha[y * size + x] = pixels[(y * size + x) * 4 + 3] > 34 ? 1 : 0;
      }
    }

    const out = [];
    const step = 2 / size;
    const zf = 0.34;
    const zb = -0.34;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!solid(alpha, size, x, y)) continue;
        const x0 = -1 + x * step;
        const x1 = x0 + step;
        const yTop = 1 - y * step;
        const yBottom = yTop - step;
        if (!solid(alpha, size, x - 1, y)) {
          quad(out, [x0, yBottom, zb], [x0, yBottom, zf], [x0, yTop, zf], [x0, yTop, zb], [-1, 0, 0]);
        }
        if (!solid(alpha, size, x + 1, y)) {
          quad(out, [x1, yBottom, zf], [x1, yBottom, zb], [x1, yTop, zb], [x1, yTop, zf], [1, 0, 0]);
        }
        if (!solid(alpha, size, x, y - 1)) {
          quad(out, [x0, yTop, zf], [x1, yTop, zf], [x1, yTop, zb], [x0, yTop, zb], [0, 1, 0]);
        }
        if (!solid(alpha, size, x, y + 1)) {
          quad(out, [x0, yBottom, zb], [x1, yBottom, zb], [x1, yBottom, zf], [x0, yBottom, zf], [0, -1, 0]);
        }
      }
    }
    return { vertices: new Float32Array(out), count: out.length / 6 };
  }

  function quad(out, a, b, c, d, normal) {
    vertex(out, a, normal);
    vertex(out, b, normal);
    vertex(out, c, normal);
    vertex(out, a, normal);
    vertex(out, c, normal);
    vertex(out, d, normal);
  }

  function vertex(out, point, normal) {
    out.push(point[0], point[1], point[2], normal[0], normal[1], normal[2]);
  }

  function solid(alpha, size, x, y) {
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    return alpha[y * size + x] === 1;
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

  function createProgram(context, vertexSource, fragmentSource) {
    const vertex = compile(context, context.VERTEX_SHADER, vertexSource);
    const fragment = compile(context, context.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;
    const program = context.createProgram();
    context.attachShader(program, vertex);
    context.attachShader(program, fragment);
    context.linkProgram(program);
    return context.getProgramParameter(program, context.LINK_STATUS) ? program : null;
  }

  function compile(context, type, source) {
    const shader = context.createShader(type);
    context.shaderSource(shader, source);
    context.compileShader(shader);
    return context.getShaderParameter(shader, context.COMPILE_STATUS) ? shader : null;
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
