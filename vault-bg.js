/**
 * vault-bg.js — Premium 3D Holographic Graphics Engine for SpellVault
 * Renders:
 * 1. Iridescent Glass Orb (dynamic floating sphere with glass/metallic transmission)
 * 2. Holographic Orbit Rings (multi-layered rotating concentric rings)
 * 3. Liquid Chrome Ribbons (ambient flowing 3D catmull-rom splines)
 * 4. Micro-particle cyber dust with smooth parallax depth
 * Completely offline, non-blocking, GPU-accelerated with static CSS fallback.
 */

(function initHolo3DEngine() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  if (typeof THREE === 'undefined') {
    canvas.style.display = 'none';
    return;
  }

  let renderer, scene, camera, animId;
  let orb, orbitRings = [], chromeRibbons = [], particles;
  let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  let isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    // ── 1. Iridescent Glass Orb ────────────────────────────────
    const orbGeo = new THREE.SphereGeometry(3.5, 48, 48);
    const orbMat = new THREE.MeshPhysicalMaterial({
      color: 0x8B5CF6,
      emissive: 0x1E143C,
      roughness: 0.1,
      metalness: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.28
    });
    orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.set(16, -6, -10);
    scene.add(orb);

    // ── 2. Holographic Orbit Rings ─────────────────────────────
    const ringSpecs = [
      { radius: 5.2, tube: 0.04, color: 0xA78BFA, rotX: 1.2, rotY: 0.4 },
      { radius: 6.8, tube: 0.035, color: 0x22C7A5, rotX: 0.7, rotY: -0.6 },
      { radius: 8.4, tube: 0.03, color: 0x8B5CF6, rotX: 2.1, rotY: 0.8 }
    ];

    ringSpecs.forEach((spec, i) => {
      const rGeo = new THREE.TorusGeometry(spec.radius, spec.tube, 16, 90);
      const rMat = new THREE.MeshBasicMaterial({
        color: spec.color,
        transparent: true,
        opacity: 0.22 - (i * 0.04)
      });
      const ring = new THREE.Mesh(rGeo, rMat);
      ring.rotation.x = spec.rotX;
      ring.rotation.y = spec.rotY;
      orb.add(ring);
      orbitRings.push({ mesh: ring, speed: (i % 2 === 0 ? 0.006 : -0.005) * (i + 1) });
    });

    // ── 3. Liquid Chrome Ribbons ───────────────────────────────
    for (let r = 0; r < 2; r++) {
      const points = [];
      const numPts = 32;
      for (let p = 0; p < numPts; p++) {
        points.push(new THREE.Vector3(
          (p - numPts / 2) * 2.8,
          Math.sin(p * 0.35 + r * 2.5) * 5.5 + (r === 0 ? 8 : -9),
          Math.cos(p * 0.25) * 6 - 16
        ));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(curve, 70, 0.16, 12, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: r === 0 ? 0x8B5CF6 : 0x22C7A5,
        roughness: 0.2,
        metalness: 0.95,
        transparent: true,
        opacity: 0.18
      });
      const ribbonMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(ribbonMesh);
      chromeRibbons.push({ mesh: ribbonMesh, r });
    }

    // ── 4. Floating Cyber Security Dust / Particles ───────────
    const P_COUNT = 150;
    const positions = new Float32Array(P_COUNT * 3);
    const colors    = new Float32Array(P_COUNT * 3);
    const speeds    = [];

    const colorTokens = [
      new THREE.Color(0x8B5CF6),
      new THREE.Color(0xA78BFA),
      new THREE.Color(0x22C7A5),
      new THREE.Color(0x38BDF8)
    ];

    for (let i = 0; i < P_COUNT; i++) {
      const i3 = i * 3;
      positions[i3]     = (Math.random() - 0.5) * 85;
      positions[i3 + 1] = (Math.random() - 0.5) * 85;
      positions[i3 + 2] = (Math.random() - 0.5) * 45;

      const col = colorTokens[Math.floor(Math.random() * colorTokens.length)];
      colors[i3]     = col.r;
      colors[i3 + 1] = col.g;
      colors[i3 + 2] = col.b;

      speeds.push({
        x: (Math.random() - 0.5) * 0.015,
        y: (Math.random() - 0.5) * 0.015,
        z: (Math.random() - 0.5) * 0.008
      });
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true
    });

    particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Lights
    const ambLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambLight);

    const violetLight = new THREE.PointLight(0x8B5CF6, 2.5, 70);
    violetLight.position.set(12, 16, 22);
    scene.add(violetLight);

    const mintLight = new THREE.PointLight(0x22C7A5, 1.8, 50);
    mintLight.position.set(-14, -10, 15);
    scene.add(mintLight);

  } catch (err) {
    canvas.style.display = 'none';
    return;
  }

  // Mouse & Touch Parallax
  window.addEventListener('mousemove', (e) => {
    targetX = (e.clientX / window.innerWidth  - 0.5) * 2;
    targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      targetX = (e.touches[0].clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.touches[0].clientY / window.innerHeight - 0.5) * 2;
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, { passive: true });

  let isDocVisible = true;
  document.addEventListener('visibilitychange', () => {
    isDocVisible = !document.hidden;
    if (isDocVisible && !animId) animate();
  });

  let frame = 0;
  function animate() {
    if (!isDocVisible) {
      animId = null;
      return;
    }
    animId = requestAnimationFrame(animate);
    if (isReducedMotion) return;

    frame++;

    // Mouse Damping
    mouseX += (targetX - mouseX) * 0.04;
    mouseY += (targetY - mouseY) * 0.04;

    // Animate Iridescent Orb & Holographic Rings
    if (orb) {
      orb.rotation.y = frame * 0.007;
      orb.rotation.x = Math.sin(frame * 0.004) * 0.25;
      orb.position.y = -6 + Math.sin(frame * 0.012) * 1.6;

      orbitRings.forEach(r => {
        r.mesh.rotation.z += r.speed;
      });
    }

    // Animate Liquid Chrome Ribbons
    chromeRibbons.forEach((ribbon, idx) => {
      ribbon.mesh.rotation.z = Math.sin(frame * 0.003 + idx) * 0.06;
      ribbon.mesh.position.y = (idx === 0 ? 1 : -1) * Math.sin(frame * 0.005) * 1.2;
    });

    // Animate Particle Mesh
    if (particles) {
      const pos = particles.geometry.attributes.position.array;
      const count = pos.length / 3;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        pos[i3]     += speeds[i].x;
        pos[i3 + 1] += speeds[i].y;
        pos[i3 + 2] += speeds[i].z;

        if (pos[i3] > 42)  pos[i3] = -42;
        if (pos[i3] < -42) pos[i3] = 42;
        if (pos[i3 + 1] > 42)  pos[i3 + 1] = -42;
        if (pos[i3 + 1] < -42) pos[i3 + 1] = 42;
      }
      particles.geometry.attributes.position.needsUpdate = true;
      particles.rotation.y = frame * 0.0002;
    }

    // Parallax depth
    camera.position.x += (mouseX * 2.8 - camera.position.x) * 0.03;
    camera.position.y += (-mouseY * 2.2 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  animate();
})();
