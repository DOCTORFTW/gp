// graph.js — Force-Directed Graph Visualization Engine
const Graph = (() => {
  let canvas, ctx;
  let W = 0, H = 0;
  let nodes = [], edges = [];
  let nodeMap = {};
  let transform = { x: 0, y: 0, scale: 1 };
  let dragging = null, panning = false, panStart = { x: 0, y: 0 };
  let hoveredNode = null, selectedNode = null;
  let onNodeClick = null, onNodeHover = null;
  let edgeParticles = [];
  let filterFn = null;
  let animFrame = null;
  let lastTime = 0;
  let simEnergy = 1;

  const STAGE_COLORS = {
    seedling: { h: 263, s: 84, l: 70 },   // lavender
    budding:  { h: 160, s: 60, l: 55 },    // emerald
    evergreen:{ h: 43,  s: 96, l: 53 },    // gold
  };
  const STAGE_RADIUS = { seedling: 10, budding: 16, evergreen: 22 };

  function init(canvasEl, opts = {}) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onNodeClick = opts.onNodeClick || null;
    onNodeHover = opts.onNodeHover || null;
    resize();
    bindEvents();
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * devicePixelRatio;
    canvas.height = H * devicePixelRatio;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    Particles.resize(W, H);
  }

  function setData(noteList, edgeList) {
    const oldMap = { ...nodeMap };
    nodeMap = {};
    nodes = noteList.map(n => {
      const old = oldMap[n.id];
      const node = {
        id: n.id, title: n.title, stage: n.stage, tags: n.tags,
        connections: n.connections, wordCount: n.wordCount,
        x: old ? old.x : (Math.random() - 0.5) * W * 0.6 + W / 2,
        y: old ? old.y : (Math.random() - 0.5) * H * 0.6 + H / 2,
        vx: old ? old.vx : 0, vy: old ? old.vy : 0,
        targetOpacity: 1, opacity: old ? old.opacity : 1,
        radius: STAGE_RADIUS[n.stage] || 14,
        breathPhase: old ? old.breathPhase : Math.random() * Math.PI * 2,
      };
      nodeMap[n.id] = node;
      return node;
    });
    edges = edgeList.map(e => ({
      source: e.source, target: e.target,
      strength: 0.5,
      particles: Array.from({ length: 2 }, () => ({ t: Math.random(), speed: 0.002 + Math.random() * 0.003 })),
    }));
    simEnergy = 1;
  }

  function computeStrengths(allNotes) {
    edges.forEach(e => {
      e.strength = AI.connectionStrength(e.source, e.target, allNotes);
    });
  }

  function setFilter(fn) {
    filterFn = fn;
    nodes.forEach(n => { n.targetOpacity = (!filterFn || filterFn(n)) ? 1 : 0.08; });
  }

  function clearFilter() { filterFn = null; nodes.forEach(n => { n.targetOpacity = 1; }); }

  function selectNode(id) { selectedNode = id; }
  function getSelectedNode() { return selectedNode; }

  // ── Physics simulation ──
  function simulate() {
    if (simEnergy < 0.001) return;
    const alpha = Math.min(simEnergy, 0.3);
    const N = nodes.length;
    // Repulsion
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) d2 = 1;
        const force = -800 / d2 * alpha;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        nodes[i].vx -= fx; nodes[i].vy -= fy;
        nodes[j].vx += fx; nodes[j].vy += fy;
      }
    }
    // Attraction along edges
    edges.forEach(e => {
      const a = nodeMap[e.source], b = nodeMap[e.target];
      if (!a || !b) return;
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ideal = 140;
      const force = (d - ideal) * 0.005 * alpha;
      const fx = (dx / d) * force, fy = (dy / d) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    });
    // Centering
    const cx = W / 2, cy = H / 2;
    nodes.forEach(n => {
      n.vx += (cx - n.x) * 0.0005 * alpha;
      n.vy += (cy - n.y) * 0.0005 * alpha;
    });
    // Apply velocities + damping
    let totalV = 0;
    nodes.forEach(n => {
      if (dragging && dragging.id === n.id) return;
      n.vx *= 0.85; n.vy *= 0.85;
      n.x += n.vx; n.y += n.vy;
      totalV += Math.abs(n.vx) + Math.abs(n.vy);
    });
    simEnergy *= 0.995;
    if (totalV < 0.5) simEnergy *= 0.95;
  }

  // ── Rendering ──
  function draw(time) {
    const dt = time - lastTime; lastTime = time;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    simulate();
    Particles.update(dt);
    Particles.draw(ctx);

    // Draw edges
    edges.forEach(e => {
      const a = nodeMap[e.source], b = nodeMap[e.target];
      if (!a || !b) return;
      const o = Math.min(a.opacity, b.opacity);
      if (o < 0.02) return;
      // Bezier curve
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const off = Math.min(Math.sqrt(dx*dx+dy*dy) * 0.15, 40);
      const cx1 = mx - dy * 0.15, cy1 = my + dx * 0.15;

      const isHighlighted = hoveredNode && (e.source === hoveredNode || e.target === hoveredNode);
      const lineW = (e.strength || 0.3) * (isHighlighted ? 3.5 : 2);
      const alpha = isHighlighted ? 0.6 * o : 0.18 * o;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx1, cy1, b.x, b.y);
      ctx.strokeStyle = `rgba(74,222,128,${alpha})`;
      ctx.lineWidth = lineW;
      ctx.stroke();

      // Edge particles
      if (o > 0.3) {
        e.particles.forEach(p => {
          p.t += p.speed;
          if (p.t > 1) p.t -= 1;
          const t = p.t;
          const px = (1-t)*(1-t)*a.x + 2*(1-t)*t*cx1 + t*t*b.x;
          const py = (1-t)*(1-t)*a.y + 2*(1-t)*t*cy1 + t*t*b.y;
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(74,222,128,${0.6 * o})`;
          ctx.fill();
        });
      }
    });

    // Draw nodes
    nodes.forEach(n => {
      // Animate opacity
      n.opacity += (n.targetOpacity - n.opacity) * 0.08;
      if (n.opacity < 0.02) return;

      n.breathPhase += 0.02;
      const breathScale = 1 + Math.sin(n.breathPhase) * 0.06;
      const r = n.radius * breathScale;
      const c = STAGE_COLORS[n.stage] || STAGE_COLORS.seedling;
      const isHovered = hoveredNode === n.id;
      const isSelected = selectedNode === n.id;

      // Glow
      const glowR = r * (isHovered ? 3.5 : isSelected ? 3 : 2.2);
      const grad = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, glowR);
      grad.addColorStop(0, `hsla(${c.h},${c.s}%,${c.l}%,${0.35 * n.opacity})`);
      grad.addColorStop(1, `hsla(${c.h},${c.s}%,${c.l}%,0)`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Node body
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      const bodyGrad = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
      bodyGrad.addColorStop(0, `hsla(${c.h},${c.s}%,${c.l + 15}%,${n.opacity})`);
      bodyGrad.addColorStop(1, `hsla(${c.h},${c.s}%,${c.l - 10}%,${n.opacity})`);
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = `hsla(${c.h},${c.s}%,${c.l}%,${0.8 * n.opacity})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Label
      if (transform.scale > 0.4 && n.opacity > 0.3) {
        ctx.font = `${isHovered || isSelected ? 600 : 400} ${Math.max(10, 12 / Math.max(transform.scale, 0.6))}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = `rgba(232,245,224,${0.9 * n.opacity})`;
        ctx.fillText(n.title, n.x, n.y + r + 6);
      }
    });

    // Minimap
    drawMinimap();
    ctx.restore();
    animFrame = requestAnimationFrame(draw);
  }

  function drawMinimap() {
    // Reset transform for minimap (screen space)
    ctx.restore();
    ctx.save();
    const mw = 140, mh = 100, mx = W - mw - 12, my = H - mh - 12, pad = 8;
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'rgba(10,15,13,0.75)';
    ctx.strokeStyle = 'rgba(74,222,128,0.2)';
    ctx.lineWidth = 1;
    roundRect(ctx, mx, my, mw, mh, 8);
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;

    if (nodes.length === 0) { ctx.restore(); ctx.save(); ctx.translate(transform.x, transform.y); ctx.scale(transform.scale, transform.scale); return; }
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    nodes.forEach(n=>{if(n.x<minX)minX=n.x;if(n.y<minY)minY=n.y;if(n.x>maxX)maxX=n.x;if(n.y>maxY)maxY=n.y;});
    const rw=maxX-minX||1,rh=maxY-minY||1;
    const s=Math.min((mw-pad*2)/rw,(mh-pad*2)/rh);

    edges.forEach(e=>{
      const a=nodeMap[e.source],b=nodeMap[e.target];
      if(!a||!b)return;
      ctx.beginPath();
      ctx.moveTo(mx+pad+(a.x-minX)*s, my+pad+(a.y-minY)*s);
      ctx.lineTo(mx+pad+(b.x-minX)*s, my+pad+(b.y-minY)*s);
      ctx.strokeStyle='rgba(74,222,128,0.15)';ctx.lineWidth=0.5;ctx.stroke();
    });
    nodes.forEach(n=>{
      if(n.opacity<0.1)return;
      const c=STAGE_COLORS[n.stage];
      ctx.beginPath();
      ctx.arc(mx+pad+(n.x-minX)*s, my+pad+(n.y-minY)*s, 2, 0, Math.PI*2);
      ctx.fillStyle=`hsla(${c.h},${c.s}%,${c.l}%,${n.opacity*0.9})`;ctx.fill();
    });

    // Restore graph transform
    ctx.restore(); ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
    c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath();
  }

  // ── Hit testing ──
  function screenToWorld(sx, sy) {
    return { x: (sx - transform.x) / transform.scale, y: (sy - transform.y) / transform.scale };
  }

  function hitTest(sx, sy) {
    const { x, y } = screenToWorld(sx, sy);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy < (n.radius + 8) * (n.radius + 8) && n.opacity > 0.2) return n;
    }
    return null;
  }

  // ── Events ──
  function bindEvents() {
    canvas.addEventListener('mousedown', e => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const hit = hitTest(sx, sy);
      if (hit) {
        dragging = hit;
        dragging._ox = hit.x; dragging._oy = hit.y;
        dragging._sx = sx; dragging._sy = sy;
      } else {
        panning = true;
        panStart = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      }
    });

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (dragging) {
        const dx = (sx - dragging._sx) / transform.scale;
        const dy = (sy - dragging._sy) / transform.scale;
        dragging.x = dragging._ox + dx;
        dragging.y = dragging._oy + dy;
        dragging.vx = 0; dragging.vy = 0;
        simEnergy = Math.max(simEnergy, 0.1);
      } else if (panning) {
        transform.x = e.clientX - panStart.x;
        transform.y = e.clientY - panStart.y;
      } else {
        const hit = hitTest(sx, sy);
        const newHover = hit ? hit.id : null;
        if (newHover !== hoveredNode) {
          hoveredNode = newHover;
          canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
          if (onNodeHover) onNodeHover(hoveredNode);
        }
      }
    });

    canvas.addEventListener('mouseup', e => {
      if (dragging) {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
        const dx = sx - dragging._sx, dy = sy - dragging._sy;
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4 && onNodeClick) {
          onNodeClick(dragging.id);
        }
        dragging = null;
      }
      panning = false;
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(transform.scale * delta, 0.2), 4);
      const ratio = newScale / transform.scale;
      transform.x = mx - (mx - transform.x) * ratio;
      transform.y = my - (my - transform.y) * ratio;
      transform.scale = newScale;
    }, { passive: false });

    window.addEventListener('resize', () => { resize(); });
  }

  function start() {
    lastTime = performance.now();
    animFrame = requestAnimationFrame(draw);
  }

  function stop() {
    if (animFrame) cancelAnimationFrame(animFrame);
  }

  function resetView() {
    transform = { x: 0, y: 0, scale: 1 };
    simEnergy = 1;
  }

  return { init, setData, computeStrengths, setFilter, clearFilter, selectNode, getSelectedNode, start, stop, resize, resetView };
})();
