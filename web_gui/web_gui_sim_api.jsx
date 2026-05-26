// OlgaFecto · Live Interception Simulator — multi-threat edition

const { useState, useEffect, useRef } = React;

// ---------- World constants ----------
const WORLD_X_MIN = -6000;
const WORLD_X_MAX = 22000;
const WORLD_W = WORLD_X_MAX - WORLD_X_MIN;
const WORLD_H = 25000;
const VB_W = 1920;
const VB_H = 1080;
const BATTERY_X = 1000;
const BATTERY_Y = 0;
const RADAR_RANGE_M = 20000;
const RADAR_MIN_ALT_M = 35;
const wx = (x) => ((x - WORLD_X_MIN) / WORLD_W) * VB_W;
const wy = (y) => VB_H - (y / WORLD_H) * VB_H;
const wr = (m) => (m / WORLD_W) * VB_W;

const BALLISTIC_TYPES = new Set(["V2", "SCUD_B", "ISKANDER", "FATEH_110"]);

// ---------- Missile parameter templates ----------
const M = {
  V1_R:  { threat_type: "V1",        initial_x: 19000, initial_y: 700,   initial_vx: -220, initial_vy: 0    },
  V1_L:  { threat_type: "V1",        initial_x: -2000, initial_y: 750,   initial_vx:  230, initial_vy: 0    },
  V2:    { threat_type: "V2",        initial_x: 18000, initial_y: 17000, initial_vx: -520, initial_vy: -140 },
  V2P:   { threat_type: "V2",        initial_x: 5000,  initial_y: 23000, initial_vx:  -60, initial_vy: -950 },
  SCUD:  { threat_type: "SCUD_B",    initial_x: 19500, initial_y: 14000, initial_vx: -560, initial_vy: -180 },
  F110:  { threat_type: "FATEH_110", initial_x: 18500, initial_y: 13000, initial_vx: -420, initial_vy: -310 },
  ISK:   { threat_type: "ISKANDER",  initial_x: 19000, initial_y: 9000,  initial_vx: -700, initial_vy:  -55 },
};

// ---------- Scenarios ----------
const SCENARIOS = {
  V1:         { category: "CRUISE",    label: "V1 - standard",      vector: "STARBOARD", desc: "Subsonic low-alt right flank",              missiles: [M.V1_R] },
  V1_CROSS:   { category: "CRUISE",    label: "V1 - port cross",    vector: "PORT",      desc: "Left-flank approach crossing vector",       missiles: [M.V1_L] },
  V2:         { category: "BALLISTIC", label: "V2 - ballistic",     vector: "RIGHT ARC", desc: "Supersonic arc with gravity descent",       missiles: [M.V2]   },
  V2_PLUNGE:  { category: "BALLISTIC", label: "V2 - plunge",        vector: "VERTICAL",  desc: "Near-vertical terminal dive",              missiles: [M.V2P]  },
  SCUD_B:     { category: "BALLISTIC", label: "SCUD-B - theater",   vector: "LONG ARC",  desc: "Long range high arc heavy warhead",        missiles: [M.SCUD] },
  FATEH_110:  { category: "BALLISTIC", label: "Fateh-110",          vector: "STEEP",     desc: "Short-range ballistic terminal angle",     missiles: [M.F110] },
  ISKANDER:   { category: "ADVANCED",  label: "Iskander-M",         vector: "EVASIVE",   desc: "Quasi-ballistic terminal maneuver",        missiles: [M.ISK]  },
  DUAL_V1:    { category: "SALVO",     label: "Dual V1 - pincer",   vector: "PINCER",    desc: "Generated port + starboard cruise attack", random: { scenario_kind: "cruise", count: 2 } },
  BARRAGE:    { category: "SALVO",     label: "Ballistic barrage",  vector: "3X BALL",   desc: "Generated theater ballistic raid",         random: { scenario_kind: "ballistic", count: 3 } },
  MIXED:      { category: "SALVO",     label: "Mixed salvo",        vector: "MIXED",     desc: "Generated mixed raid with varied vectors",  random: { scenario_kind: "mixed", count: 4 } },
  SATURATION: { category: "SALVO",     label: "Saturation strike",  vector: "5X RAID",   desc: "Generated mass raid with varied vectors",   random: { scenario_kind: "saturation", count: 5 } },
  RAID_20:    { category: "SALVO",     label: "Raid 20",            vector: "20X",       desc: "Generated saturation raid",                 random: { scenario_kind: "saturation", count: 20 } },
  RAID_50:    { category: "SALVO",     label: "Raid 50",            vector: "50X",       desc: "Generated saturation raid",                 random: { scenario_kind: "saturation", count: 50 } },
  RAID_100:   { category: "SALVO",     label: "Raid 100",           vector: "100X",      desc: "Generated mass raid",                       random: { scenario_kind: "saturation", count: 100 } },
  RAID_300:   { category: "SALVO",     label: "Raid 300",           vector: "300X",      desc: "Generated overload raid",                   random: { scenario_kind: "saturation", count: 300 } },
};
const SCENARIO_CATEGORIES = [
  { id: "CRUISE",    label: "CRUISE",    color: "#ffb84a" },
  { id: "BALLISTIC", label: "BALLISTIC", color: "#ff7a4a" },
  { id: "ADVANCED",  label: "ADVANCED",  color: "#c47aff" },
  { id: "SALVO",     label: "SALVO",     color: "#ff4a8a" },
];

// ---------- Decorative geometry ----------
function genStars(n = 90) {
  const out = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < n; i++) out.push({
    x: rnd() * VB_W, y: rnd() * VB_H * 0.55,
    r: 0.6 + rnd() * 1.6, a: 0.3 + rnd() * 0.7, tw: rnd() * 4,
  });
  return out;
}
const STARS = genStars();

function genHills() {
  const layers = [];
  for (let L = 0; L < 3; L++) {
    let seed = 13 + L * 5;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const base = VB_H - 20 - L * 10;
    const amp = 28 - L * 8;
    const step = 80 + L * 30;
    let d = `M -20 ${VB_H + 20} L -20 ${base}`;
    for (let x = 0; x <= VB_W + 40; x += step) {
      const y = base - (Math.sin(x * 0.003 + L) + rnd() - 0.5) * amp;
      d += ` L ${x} ${y.toFixed(1)}`;
    }
    d += ` L ${VB_W + 20} ${VB_H + 20} Z`;
    layers.push(d);
  }
  return layers;
}
const HILLS = genHills();
const CLOUDS = [
  { x: 400, y: 2500, w: 220, h: 28, o: 0.55 },
  { x: 1100, y: 3100, w: 280, h: 32, o: 0.45 },
  { x: 1700, y: 2200, w: 180, h: 22, o: 0.5 },
  { x: 200,  y: 4200, w: 320, h: 30, o: 0.35 },
  { x: 1400, y: 1800, w: 200, h: 24, o: 0.4 },
];

// ============================================================
//                         APP
// ============================================================
function App() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "apiBase": "http://localhost:8080",
    "pollMs": 50,
    "showGrid": true,
    "showVectors": false
  }/*EDITMODE-END*/;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // ── Multi-threat tracking ────────────────────────────────────────────────
  const apiThreatsRef = useRef(new Map()); // id → {x,y,vx,vy,type}
  const apiTimeRef    = useRef(null);
  const lastWallRef   = useRef(null);
  const statusRef     = useRef({ intercepted: 0, leakers: 0, total: 0, active_threats: 0, active_interceptors: 0 });

  // ── Multi-interceptor tracking ───────────────────────────────────────────
  const intersRef          = useRef(new Map());  // id → {x,y,vx,vy}
  const trailsRef          = useRef(new Map());  // id → {threat:[], inter:[]}
  const interceptedIdsRef  = useRef(new Set());
  const totalThreatCountRef = useRef(0);
  const interceptedCountRef = useRef(0);

  const explosionsRef = useRef([]);
  const flashRef      = useRef(0);
  const apiFailRef    = useRef(0);
  const lastEventIdRef = useRef(0);

  // ── Pan / zoom ───────────────────────────────────────────────────────────
  const svgRef  = useRef(null);
  const viewRef = useRef({ panX: 0, panY: 0, zoom: 1 });
  const dragRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const v = viewRef.current;
      v.zoom = Math.max(0.3, Math.min(6, v.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      force(n => n + 1);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onSvgMouseDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: viewRef.current.panX, py: viewRef.current.panY };
  };
  const onSvgMouseMove = (e) => {
    if (!dragRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    v.panX = dragRef.current.px - (e.clientX - dragRef.current.sx) * (VB_W / v.zoom) / rect.width;
    v.panY = dragRef.current.py - (e.clientY - dragRef.current.sy) * (VB_H / v.zoom) / rect.height;
    force(n => n + 1);
  };
  const onSvgMouseUp   = () => { dragRef.current = null; };
  const resetView      = () => { viewRef.current = { panX: 0, panY: 0, zoom: 1 }; force(n => n + 1); };

  // ── State ────────────────────────────────────────────────────────────────
  const [hud, setHud] = useState({
    threats: [],          // [{id, type, alt, speed, range, closing, status}]
    elapsed: 0, frames: 0, dt: 0,
    status: "STANDBY", statusKind: "idle",
    apiStatus: "checking",
    intercepted: 0, total: 0,
  });
  const [scenarioName, setScenarioName] = useState("V2");
  const [outcome, setOutcome] = useState(null); // {intercepted, total} | null
  const [stress, setStress] = useState(null);
  const [stressBusy, setStressBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [, force] = useState(0);

  // ── API health probe ─────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const probe = async () => {
      try {
        const ctl = new AbortController();
        const tid = setTimeout(() => ctl.abort(), 1500);
        await fetch(`${t.apiBase}/status`, { signal: ctl.signal });
        clearTimeout(tid);
        if (!alive) return;
        setHud(h => h.apiStatus === "online" ? h : { ...h, apiStatus: "online" });
      } catch {
        if (!alive) return;
        setHud(h => h.apiStatus === "offline" ? h : { ...h, apiStatus: "offline" });
      }
    };
    probe();
    const id = setInterval(probe, 2000);
    return () => { alive = false; clearInterval(id); };
  }, [t.apiBase]);

  // ── Launch ───────────────────────────────────────────────────────────────
  const launch = async (name) => {
    const cfg = SCENARIOS[name];
    apiThreatsRef.current     = new Map();
    intersRef.current         = new Map();
    trailsRef.current         = new Map();
    interceptedIdsRef.current = new Set();
    const scenarioTotal = cfg.random ? cfg.random.count : cfg.missiles.length;
    totalThreatCountRef.current  = scenarioTotal;
    interceptedCountRef.current  = 0;
    statusRef.current = { intercepted: 0, leakers: 0, total: scenarioTotal, active_threats: 0, active_interceptors: 0 };
    lastEventIdRef.current = 0;
    explosionsRef.current = [];
    flashRef.current      = 0;
    apiFailRef.current    = 0;
    setScenarioName(name);
    setOutcome(null);

    try {
      const ctl = new AbortController();
      const tid = setTimeout(() => ctl.abort(), 1500);
      const endpoint = cfg.random ? "/scenario/random" : "/scenario";
      const body = cfg.random
        ? { ...cfg.random, seed: Math.floor(Math.random() * 2147483647) }
        : { missiles: cfg.missiles };
      const res = await fetch(`${t.apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`POST /scenario → ${res.status}`);
    } catch {
      setHud(h => ({ ...h, apiStatus: "offline", status: "API OFFLINE", statusKind: "error" }));
      return;
    }

    setHud(h => ({ ...h, apiStatus: "online" }));
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    apiThreatsRef.current     = new Map();
    intersRef.current         = new Map();
    trailsRef.current         = new Map();
    interceptedIdsRef.current = new Set();
    interceptedCountRef.current = 0;
    lastEventIdRef.current = 0;
    explosionsRef.current = [];
    flashRef.current      = 0;
    setOutcome(null);
    setHud(h => ({
      ...h, threats: [], status: "STANDBY", statusKind: "idle",
      elapsed: 0, frames: 0, dt: 0, intercepted: 0, total: 0,
    }));
    force(n => n + 1);
  };

  const runStress = async () => {
    setStressBusy(true);
    try {
      const ctl = new AbortController();
      const tid = setTimeout(() => ctl.abort(), 10000);
      const res = await fetch(`${t.apiBase}/stress-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_kind: "saturation",
          min_count: 1,
          max_count: 40,
          step: 3,
          trials_per_count: 25,
          interceptor_inventory: 12,
          launcher_cooldown_s: 0.65,
          max_time_s: 90
        }),
        signal: ctl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`POST /stress-test -> ${res.status}`);
      setStress(await res.json());
    } catch {
      setStress({ breakpoint_count: 0, breakpoint_assessment: "API error", primary_failure: "stress test failed", buckets: [] });
    } finally {
      setStressBusy(false);
    }
  };

  // Poll C++-driven track state from the FastAPI service.
  useEffect(() => {
    if (!running) return;
    let alive = true;

    const poll = async () => {
      try {
        const ctl = new AbortController();
        const tid = setTimeout(() => ctl.abort(), 800);
        const [trackRes, statusRes, eventRes] = await Promise.all([
          fetch(`${t.apiBase}/tracks`, { signal: ctl.signal }),
          fetch(`${t.apiBase}/status`, { signal: ctl.signal }),
          fetch(`${t.apiBase}/events?after=${lastEventIdRef.current}`, { signal: ctl.signal }),
        ]);
        clearTimeout(tid);
        if (!trackRes.ok) throw new Error(`GET /tracks -> ${trackRes.status}`);
        if (!statusRes.ok) throw new Error(`GET /status -> ${statusRes.status}`);
        if (!eventRes.ok) throw new Error(`GET /events -> ${eventRes.status}`);
        const tracks = await trackRes.json();
        const status = await statusRes.json();
        const events = await eventRes.json();
        if (!alive) return;

        apiFailRef.current = 0;
        const previousThreats = apiThreatsRef.current;
        const previousInterceptors = intersRef.current;
        const previousStatus = statusRef.current;
        statusRef.current = status;
        setHud(h => h.apiStatus === "online" ? h : { ...h, apiStatus: "online" });

        const threatMap = new Map();
        const interMap = new Map();
        for (const track of tracks) {
          if (track.object_type === "threat") {
            threatMap.set(track.track_id, {
              x: track.x, y: track.y, vx: track.vx, vy: track.vy,
              speed: track.speed_mps ?? 0,
              range: track.range_m ?? 0,
              type: track.track_type, status: track.status || "TRACKING",
            });
            apiTimeRef.current = track.timestamp;
          } else if (track.object_type === "interceptor") {
            const key = track.target_id || track.track_id;
            interMap.set(key, {
              x: track.x, y: track.y, vx: track.vx, vy: track.vy,
              type: track.track_type, trackId: track.track_id, targetId: track.target_id,
            });
            apiTimeRef.current = track.timestamp;
          }
        }

        for (const [id, th] of threatMap) {
          if (!trailsRef.current.has(id)) trailsRef.current.set(id, { threat: [], inter: [] });
          const tr = trailsRef.current.get(id);
          tr.threat.push([th.x, th.y]);
          if (tr.threat.length > 500) tr.threat.shift();
        }
        for (const [id, inter] of interMap) {
          if (!trailsRef.current.has(id)) trailsRef.current.set(id, { threat: [], inter: [] });
          const tr = trailsRef.current.get(id);
          tr.inter.push([inter.x, inter.y]);
          if (tr.inter.length > 500) tr.inter.shift();
        }

        for (const event of events) {
          lastEventIdRef.current = Math.max(lastEventIdRef.current, event.event_id || 0);
          if (event.event_type === "INTERCEPT") {
            explosionsRef.current.push({ x: event.x, y: event.y, t: 0, kind: "air" });
          } else if (event.event_type === "GROUND_IMPACT") {
            explosionsRef.current.push({ x: event.x, y: Math.max(60, event.y), t: 0, kind: "ground" });
          } else if (event.event_type === "LAUNCH") {
            flashRef.current = Math.max(flashRef.current, 0.6);
          }
        }

        const removedThreatIds = [...previousThreats.keys()].filter(id => !threatMap.has(id));
        const newIntercepts = Math.max(0, (status.intercepted || 0) - (previousStatus.intercepted || 0));
        const newLeakers = Math.max(0, (status.leakers || 0) - (previousStatus.leakers || 0));
        removedThreatIds.forEach((id, idx) => {
          if (events.some(e => e.track_id === id && (e.event_type === "INTERCEPT" || e.event_type === "GROUND_IMPACT"))) return;
          const lastTrail = trailsRef.current.get(id)?.threat;
          const fallback = previousThreats.get(id);
          const lastPoint = lastTrail && lastTrail.length ? lastTrail[lastTrail.length - 1] : [fallback?.x || BATTERY_X, fallback?.y || 60];
          const kind = idx < newLeakers ? "ground" : "air";
          explosionsRef.current.push({ x: lastPoint[0], y: kind === "ground" ? Math.max(60, lastPoint[1]) : lastPoint[1], t: 0, kind });
        });

        if (interMap.size > previousInterceptors.size || newIntercepts > 0) {
          flashRef.current = Math.max(flashRef.current, 0.6);
        }

        apiThreatsRef.current = threatMap;
        intersRef.current = interMap;
        interceptedCountRef.current = status.intercepted || 0;
        totalThreatCountRef.current = status.total || totalThreatCountRef.current;
        lastWallRef.current = performance.now();

        const threatRows = [...threatMap.entries()].map(([id, threat]) => ({
          id,
          type: threat.type,
          alt: threat.y,
          speed: threat.speed,
          range: threat.range,
          closing: 0,
          status: threat.status,
        }));

        setHud(h => ({
          ...h,
          threats: threatRows,
          elapsed: status.timestamp || h.elapsed,
          frames: h.frames + 1,
          dt: 0,
          status: threatMap.size > 0 ? (interMap.size > 0 ? "ENGAGING" : "TRACKING") : "RESOLVING",
          statusKind: threatMap.size > 0 ? (interMap.size > 0 ? "engage" : "track") : "idle",
          intercepted: status.intercepted || 0,
          total: status.total || 0,
        }));

        if ((status.total || 0) > 0 && (status.active_threats || 0) === 0 && (status.active_interceptors || 0) === 0) {
          setOutcome({ intercepted: status.intercepted || 0, total: status.total || 0 });
          setRunning(false);
        }
      } catch {
        if (!alive) return;
        apiFailRef.current++;
        if (apiFailRef.current >= 3) {
          setHud(h => h.apiStatus === "offline" ? h : { ...h, apiStatus: "offline" });
        }
      }
    };

    poll();
    const id = setInterval(poll, t.pollMs);
    return () => { alive = false; clearInterval(id); };
  }, [running, t.apiBase, t.pollMs]);
  // Render loop only. Physics, guidance, detection, speed limiting, and fuze logic are C++/API-owned.
  useEffect(() => {
    if (!running) return;
    let raf;
    const step = () => {
      explosionsRef.current.forEach(e => e.t += 1 / 60);
      explosionsRef.current = explosionsRef.current.filter(e => e.t < 2.5);
      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 1 / 60);
      force(n => n + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  // Explosion linger after engagement ends
  useEffect(() => {
    if (running || !outcome) return;
    let raf, last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000; last = now;
      explosionsRef.current.forEach(e => e.t += dt);
      explosionsRef.current = explosionsRef.current.filter(e => e.t < 2.5);
      force(n => n + 1);
      if (explosionsRef.current.length > 0) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, outcome]);

  // Derived render data: direct API tracks, no browser-side dead reckoning.
  const renderThreats = new Map(apiThreatsRef.current);
  const allTrailEntries = [...trailsRef.current.entries()];
  const v = viewRef.current;
  return (
    <div className="app">
      <div className="sky-bg" />
      <svg
        ref={svgRef}
        className="world"
        viewBox={`${v.panX.toFixed(1)} ${v.panY.toFixed(1)} ${(VB_W / v.zoom).toFixed(1)} ${(VB_H / v.zoom).toFixed(1)}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={onSvgMouseDown}
        onMouseMove={onSvgMouseMove}
        onMouseUp={onSvgMouseUp}
        onMouseLeave={onSvgMouseUp}
        onDoubleClick={resetView}
        style={{ cursor: dragRef.current ? 'grabbing' : 'grab' }}
      >
        <Defs />
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#atmoGrad)" />
        <g className="stars">
          {STARS.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.a}>
              <animate attributeName="opacity" values={`${s.a};${s.a * 0.3};${s.a}`}
                dur={`${3 + s.tw}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
        <g>
          <circle cx={VB_W - 220} cy={140} r="46" fill="url(#sunGrad)" />
          <circle cx={VB_W - 220} cy={140} r="120" fill="url(#sunGlow)" opacity="0.6" />
        </g>
        <g className="clouds">
          {CLOUDS.map((c, i) => (
            <ellipse key={i} cx={wx(c.x * 8 + 4000)} cy={wy(c.y)}
              rx={c.w} ry={c.h} fill="#fff" opacity={c.o} filter="url(#blur)" />
          ))}
        </g>
        {t.showGrid && <Grid />}
        <g>
          <path d={HILLS[0]} fill="#1a2a3a" opacity="0.55" />
          <path d={HILLS[1]} fill="#0f1c2b" opacity="0.75" />
          <path d={HILLS[2]} fill="#070e17" />
        </g>
        <Skyline />
        <DefenseBattery flash={flashRef.current} />

        {allTrailEntries.map(([id, tr]) => [
          tr.threat.length > 1 && <Trail key={`${id}_t`} points={tr.threat} color="#ff5c46" width={2.2} />,
          tr.inter.length  > 1 && <Trail key={`${id}_i`} points={tr.inter}  color="#7cf3ff" width={2.6} dashed />,
        ])}

        {[...renderThreats.entries()].map(([id, th]) => (
          <ThreatSprite key={id} t={th} label={id} showVec={t.showVectors} />
        ))}
        {[...intersRef.current.entries()].map(([id, inter]) => (
          <InterceptorSprite key={id} t={inter} label={inter.trackId || `INT_${id.split("_")[1]}`} showVec={t.showVectors} />
        ))}
        {explosionsRef.current.map((e, i) => <Explosion key={i} e={e} />)}
        <RadarSweep active={running} />
      </svg>

      <Hud
        hud={hud}
        scenarioName={scenarioName}
        outcome={outcome}
        running={running}
        onLaunch={launch}
        onReset={reset}
        onStress={runStress}
        stress={stress}
        stressBusy={stressBusy}
        t={t}
      />

      <TweaksPanel title="Tweaks">
        <TweakSection title="Sensor API">
          <TweakText label="API base" value={t.apiBase} onChange={v => setTweak("apiBase", v)} />
          <TweakSlider label="Poll interval (ms)" min={20} max={500} step={10}
            value={t.pollMs} onChange={v => setTweak("pollMs", v)} />
        </TweakSection>
        <TweakSection title="Physics">
          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--ink-dim)', letterSpacing: '1px', lineHeight: 1.7 }}>
            Guidance, interceptor motion, radar gating, speed limits, and fuze checks are computed by the C++ engine through the API.
          </div>
        </TweakSection>
        <TweakSection title="View">
          <TweakToggle label="Grid overlay" value={t.showGrid} onChange={v => setTweak("showGrid", v)} />
          <TweakToggle label="Velocity vectors" value={t.showVectors} onChange={v => setTweak("showVectors", v)} />
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-dim)', letterSpacing: '1px', lineHeight: 1.7 }}>
            DRAG · pan map<br />SCROLL · zoom in/out<br />DOUBLE-CLICK · reset view
          </div>
          <button onClick={resetView} style={{ marginTop: 8, width: '100%', background: 'rgba(20,30,42,0.85)', border: '1px solid var(--panel-line)', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '1.5px', padding: '6px 0', cursor: 'pointer' }}>
            RESET VIEW
          </button>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// ============================================================
//                     SUB-COMPONENTS
// ============================================================

function Defs() {
  return (
    <defs>
      <linearGradient id="atmoGrad" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%"   stopColor="#020514" stopOpacity="0.95" />
        <stop offset="35%"  stopColor="#0a1f3d" stopOpacity="0.6" />
        <stop offset="65%"  stopColor="#3d6fa5" stopOpacity="0.25" />
        <stop offset="92%"  stopColor="#9ab8d8" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#c9d6e2" stopOpacity="0.6" />
      </linearGradient>
      <radialGradient id="sunGrad">
        <stop offset="0%"   stopColor="#fff5d6" />
        <stop offset="60%"  stopColor="#ffd166" />
        <stop offset="100%" stopColor="#ff9a3c" />
      </radialGradient>
      <radialGradient id="sunGlow">
        <stop offset="0%"   stopColor="#ffd166" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#ffd166" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="explosionGrad">
        <stop offset="0%"   stopColor="#fff8c4" />
        <stop offset="35%"  stopColor="#ffb14b" />
        <stop offset="70%"  stopColor="#ff4d2a" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#ff2a2a" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="flashGrad">
        <stop offset="0%"   stopColor="#fff" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

function Grid() {
  const lines = [];
  const startX = Math.ceil(WORLD_X_MIN / 2000) * 2000;
  for (let x = startX; x <= WORLD_X_MAX; x += 2000) {
    lines.push(<line key={`vx${x}`} x1={wx(x)} x2={wx(x)} y1={0} y2={VB_H} stroke="rgba(120,200,255,0.06)" strokeWidth="1" />);
    if (x !== 0) lines.push(<text key={`vt${x}`} x={wx(x) + 4} y={VB_H - 6} fill="rgba(120,200,255,0.35)" fontSize="14" fontFamily="ui-monospace,monospace">{x / 1000}km</text>);
  }
  for (let y = 0; y <= WORLD_H; y += 5000) {
    lines.push(<line key={`hy${y}`} x1={0} x2={VB_W} y1={wy(y)} y2={wy(y)} stroke="rgba(120,200,255,0.06)" strokeWidth="1" />);
    if (y > 0) lines.push(<text key={`ht${y}`} x={8} y={wy(y) - 4} fill="rgba(120,200,255,0.35)" fontSize="14" fontFamily="ui-monospace,monospace">{y / 1000}km</text>);
  }
  return <g>{lines}</g>;
}

function Skyline() {
  const buildings = [];
  let seed = 31;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  let x = wx(2500);
  while (x < wx(11000)) {
    const w = 12 + rnd() * 28;
    const h = 12 + rnd() * 48;
    buildings.push(<rect key={x} x={x} y={VB_H - 50 - h} width={w} height={h} fill="#0c1722" opacity="0.85" />);
    x += w + 2;
  }
  return <g>{buildings}</g>;
}

function DefenseBattery({ flash }) {
  const cx = wx(BATTERY_X); const gy = VB_H - 30;
  return (
    <g>
      <rect x={cx - 60} y={gy - 8} width="120" height="14" fill="#1a2530" />
      <rect x={cx - 60} y={gy - 8} width="120" height="3"  fill="#2a3a4a" />
      <rect x={cx - 50} y={gy - 26} width="10" height="20" fill="#2a3a4a" />
      <circle cx={cx - 45} cy={gy - 32} r="10" fill="#2e4458" stroke="#5a8aa8" strokeWidth="1" />
      <line x1={cx - 45} y1={gy - 32} x2={cx - 30} y2={gy - 40} stroke="#7fb8d8" strokeWidth="1.5" />
      <g transform={`translate(${cx + 20} ${gy - 12}) rotate(-62)`}>
        <rect x="-6" y="-50" width="12" height="56" fill="#1f2c38" stroke="#4a6478" strokeWidth="1" />
        <rect x="-6" y="-50" width="12" height="6"  fill="#0f1820" />
      </g>
      <rect x={cx + 50} y={gy - 18} width="40" height="18" fill="#162028" />
      <rect x={cx + 56} y={gy - 14} width="6" height="6" fill="#7cf3ff" opacity="0.7" />
      <rect x={cx + 68} y={gy - 14} width="6" height="6" fill="#ffb84a" opacity="0.6" />
      {flash > 0 && (
        <g transform={`translate(${cx + 28} ${gy - 50})`}>
          <circle cx="0" cy="0" r={40 * flash} fill="url(#flashGrad)" opacity={flash} />
          <circle cx="0" cy="0" r={18 * flash} fill="#fff5b0" opacity={flash * 0.9} />
        </g>
      )}
      <text x={cx} y={gy + 22} textAnchor="middle" fill="rgba(124,243,255,0.6)" fontSize="11" fontFamily="ui-monospace,monospace" letterSpacing="2">DEFENSE BATTERY · OF-1</text>
    </g>
  );
}

function Trail({ points, color, width, dashed }) {
  const d = points.map(([x, y]) => `${wx(x).toFixed(1)},${wy(y).toFixed(1)}`).join(" ");
  return (
    <g>
      <polyline points={d} fill="none" stroke={color} strokeWidth={width + 4} opacity="0.15" filter="url(#glow)" />
      <polyline points={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={dashed ? "8 6" : "none"} opacity="0.95" />
    </g>
  );
}

function ThreatSprite({ t, label, showVec }) {
  const angle = Math.atan2(-t.vy, t.vx) * 180 / Math.PI;
  return (
    <g transform={`translate(${wx(t.x)} ${wy(t.y)})`}>
      <g transform={`rotate(${angle})`}>
        <ellipse cx="14" cy="0" rx="18" ry="3" fill="#ff7a3a" opacity="0.6" filter="url(#blur)" />
        <ellipse cx="10" cy="0" rx="8"  ry="2" fill="#fff3c4" opacity="0.9" />
        <polygon points="-14,-5 8,-5 14,0 8,5 -14,5" fill="#d44530" stroke="#8a1a0a" strokeWidth="1" />
        <polygon points="-14,-5 -18,-8 -10,-5" fill="#8a1a0a" />
        <polygon points="-14,5 -18,8 -10,5"   fill="#8a1a0a" />
        <circle cx="2" cy="0" r="1.5" fill="#ffd166" />
      </g>
      <g>
        <rect x="-22" y="-22" width="44" height="44" fill="none" stroke="#ff5c46" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.85" />
        <line x1="-22" y1="0" x2="-28" y2="0" stroke="#ff5c46" strokeWidth="1.5" />
        <line x1="22"  y1="0" x2="28"  y2="0" stroke="#ff5c46" strokeWidth="1.5" />
      </g>
      <text x="28" y="-14" fill="#ff8a78" fontSize="11" fontFamily="ui-monospace,monospace" letterSpacing="1">{label} · {t.type}</text>
      {showVec && <line x1="0" y1="0" x2={t.vx * 0.08} y2={-t.vy * 0.08} stroke="#ff5c46" strokeWidth="1.5" opacity="0.7" />}
    </g>
  );
}

function InterceptorSprite({ t, label, showVec }) {
  const angle = Math.atan2(-t.vy, t.vx) * 180 / Math.PI;
  return (
    <g transform={`translate(${wx(t.x)} ${wy(t.y)})`}>
      <g transform={`rotate(${angle})`}>
        <ellipse cx="-14" cy="0" rx="22" ry="3.5" fill="#7cf3ff" opacity="0.55" filter="url(#blur)" />
        <ellipse cx="-10" cy="0" rx="10" ry="2.2" fill="#fff"    opacity="0.95" />
        <polygon points="-10,-4 8,-4 14,0 8,4 -10,4" fill="#e8f6ff" stroke="#5a8aa8" strokeWidth="1" />
        <polygon points="-10,-4 -14,-7 -6,-4" fill="#5a8aa8" />
        <polygon points="-10,4 -14,7 -6,4"   fill="#5a8aa8" />
        <circle cx="4" cy="0" r="1.5" fill="#1d8fbf" />
      </g>
      <g><circle cx="0" cy="0" r="24" fill="none" stroke="#7cf3ff" strokeWidth="1" strokeDasharray="2 4" opacity="0.7" /></g>
      <text x="28" y="14" fill="#a8eaff" fontSize="11" fontFamily="ui-monospace,monospace" letterSpacing="1">{label} · AIM9</text>
      {showVec && <line x1="0" y1="0" x2={t.vx * 0.08} y2={-t.vy * 0.08} stroke="#7cf3ff" strokeWidth="1.5" opacity="0.7" />}
    </g>
  );
}

function Explosion({ e }) {
  const tt = e.t;
  const p      = tt / 2.5;
  const radius = (e.kind === "ground" ? 90 : 70) * (1 - Math.exp(-tt * 4));
  const opacity = Math.max(0, 1 - p);
  const ringR   = 30 + tt * 180;
  return (
    <g transform={`translate(${wx(e.x)} ${wy(e.y)})`}>
      <circle cx="0" cy="0" r={ringR}        fill="none" stroke="#ffd166" strokeWidth="1.5" opacity={opacity * 0.4} />
      <circle cx="0" cy="0" r={radius}       fill="url(#explosionGrad)" opacity={opacity} />
      <circle cx="0" cy="0" r={radius * 0.5} fill="#fff8c4" opacity={opacity * 0.9} />
      {[0,1,2,3,4,5].map(i => {
        const a = (i / 6) * Math.PI * 2;
        const d = radius * 1.4 * (0.6 + 0.4 * Math.sin(i + tt * 2));
        return <circle key={i} cx={Math.cos(a)*d} cy={Math.sin(a)*d} r={2} fill="#ffb84a" opacity={opacity * 0.7} />;
      })}
    </g>
  );
}

function RadarSweep({ active }) {
  const cx = wx(BATTERY_X); const cy = wy(BATTERY_Y) - 36;
  const rings = [5000, 10000, 15000, 20000];
  return (
    <g>
      <path
        d={`M ${cx} ${cy} L ${cx + wr(RADAR_RANGE_M)} ${cy} A ${wr(RADAR_RANGE_M)} ${wr(RADAR_RANGE_M)} 0 0 0 ${cx - wr(RADAR_RANGE_M)} ${cy} Z`}
        fill="rgba(124,243,255,0.025)"
        stroke="rgba(124,243,255,0.08)"
        strokeWidth="1"
      />
      {rings.map((r) => (
        <circle key={r} cx={cx} cy={cy} r={wr(r)} fill="none" stroke="rgba(124,243,255,0.09)" strokeWidth="1" />
      ))}
      <text x={cx + wr(5000) + 8} y={cy - 8} fill="rgba(124,243,255,0.45)" fontSize="10" fontFamily="ui-monospace,monospace" letterSpacing="1.5">RADAR ENVELOPE</text>
      {active && (
        <line x1={cx} y1={cy} x2={cx + wr(12000)} y2={cy} stroke="rgba(124,243,255,0.5)" strokeWidth="1.5">
          <animateTransform attributeName="transform" type="rotate"
            from={`0 ${cx} ${cy}`} to={`-180 ${cx} ${cy}`} dur="3s" repeatCount="indefinite" />
        </line>
      )}
    </g>
  );
}

// ============================================================
//                          HUD
// ============================================================

function Hud({ hud, scenarioName, outcome, running, onLaunch, onReset, onStress, stress, stressBusy, t }) {
  const [bottomOpen, setBottomOpen] = useState(true);
  const [leftOpen,   setLeftOpen]   = useState(true);
  const [rightOpen,  setRightOpen]  = useState(true);

  const statusColors = { idle: "#7a8a98", track: "#ffb84a", engage: "#7cf3ff", error: "#ff5c46" };
  const statusColor  = statusColors[hud.statusKind] || "#7a8a98";
  const apiColor  = hud.apiStatus === "online" ? "#7cf3ff" : hud.apiStatus === "offline" ? "#ff5c46" : "#ffb84a";
  const apiLabel  = hud.apiStatus === "online" ? "API ONLINE" : hud.apiStatus === "offline" ? "API OFFLINE" : "API …";

  return (
    <div className="hud">
      {/* ── Top bar ── */}
      <div className="hud-top">
        <div className="hud-brand">
          <div className="logo-mark">◆</div>
          <div>
            <div className="brand-name">OLGAFECTO</div>
            <div className="brand-sub">Integrated Fire Control · live API</div>
          </div>
        </div>
        <div className="hud-status">
          <div className="status-dot" style={{ background: apiColor, boxShadow: `0 0 12px ${apiColor}` }} />
          <span style={{ color: apiColor }}>{apiLabel}</span>
          <span className="muted">·</span>
          <div className="status-dot" style={{ background: statusColor, boxShadow: `0 0 12px ${statusColor}` }} />
          <span style={{ color: statusColor }}>{hud.status}</span>
          <span className="muted">· SCEN {scenarioName.replace("_","-")}</span>
          <span className="muted">· T+{hud.elapsed.toFixed(2)}s</span>
          <span className="muted">· {hud.intercepted}/{hud.total} NEUTRALIZED</span>
        </div>
      </div>

      {/* ── Threat table (left) ── */}
      {leftOpen ? (
        <div className="hud-panel left-panel">
          <div className="panel-title">
            ACTIVE THREATS · {hud.threats.length}
            <button className="panel-close" onClick={() => setLeftOpen(false)} title="Collapse">‹</button>
          </div>
          {hud.threats.length === 0 && (
            <div style={{ color: "var(--ink-dim)", fontSize: 11, letterSpacing: 1, marginTop: 6 }}>NO CONTACTS</div>
          )}
          {hud.threats.map(row => (
            <div key={row.id} className="threat-row">
              <div className="threat-row-top">
                <span className="threat-id">{row.id}</span>
                <span className="threat-type">{row.type}</span>
                <span className={`threat-status ${row.status === "ENGAGING" ? "eng" : "trk"}`}>{row.status}</span>
              </div>
              <div className="threat-row-stats">
                <span>ALT {(row.alt / 1000).toFixed(1)}km</span>
                <span>RNG {(row.range / 1000).toFixed(1)}km</span>
                <span>CLO {row.closing.toFixed(0)}m/s</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel-tab left-tab" onClick={() => setLeftOpen(true)} title="Expand">
          <span>THREATS · {hud.threats.length}</span>
        </div>
      )}

      {/* ── Engagement summary (right) ── */}
      {rightOpen ? (
        <div className="hud-panel right-panel">
          <div className="panel-title">
            ENGAGEMENT SUMMARY
            <button className="panel-close" onClick={() => setRightOpen(false)} title="Collapse">›</button>
          </div>
          <Stat label="TOTAL"   value={hud.total || "—"} />
          <Stat label="ENGAGED" value={running ? hud.threats.filter(r => r.status === "ENGAGING").length : "—"} />
          <Stat label="KILLED"  value={hud.intercepted || "—"} />
          <Stat label="T+"      value={`${hud.elapsed.toFixed(1)}s`} />
          <Stat label="FUZE"    value="C++" />
          {outcome && (
            <div className={`outcome-hud ${outcome.intercepted === outcome.total ? "intercept" : outcome.intercepted === 0 ? "leaker" : "partial"}`}>
              <div className="outcome-hud-big">
                {outcome.intercepted === outcome.total ? "ALL CLEAR" : outcome.intercepted === 0 ? "LEAKER" : "PARTIAL"}
              </div>
              <div className="outcome-hud-sub">{outcome.intercepted} / {outcome.total} neutralized</div>
            </div>
          )}
        </div>
      ) : (
        <div className="panel-tab right-tab" onClick={() => setRightOpen(true)} title="Expand">
          <span>SUMMARY</span>
        </div>
      )}

      {hud.apiStatus === "offline" && !running && (
        <div className="api-warning">
          <strong>FastAPI not reachable at {t.apiBase}</strong>
          <div>Start it from your project root:</div>
          <pre>uvicorn sensor_api.main:app --host 0.0.0.0 --port 8080</pre>
        </div>
      )}

      {stress && (
        <div className="hud-panel stress-panel" style={{ right: rightOpen ? 20 : 46 }}>
          <div className="panel-title">RAID STRESS TEST</div>
          <div className="stress-main">
            <span className="stress-count">{stress.breakpoint_count || "—"}</span>
            <span className={`stress-badge ${stress.breakpoint_assessment}`}>{stress.breakpoint_assessment}</span>
          </div>
          <div className="stress-sub">primary failure: {stress.primary_failure}</div>
          <div className="stress-bars">
            {(stress.buckets || []).map(b => (
              <div key={b.missile_count} className="stress-row">
                <span>{b.missile_count}</span>
                <div className="stress-track"><i style={{ width: `${Math.max(4, Math.min(100, b.neutralized_pct))}%` }} /></div>
                <span>{b.neutralized_pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <div className={`hud-bottom ${bottomOpen ? "" : "bottom-mini"}`}>
        {bottomOpen ? (
          <>
            <div className="bottom-scenarios">
              <div className="bottom-section-label">SCENARIO SELECT</div>
              <div className="scenarios-grid">
                {SCENARIO_CATEGORIES.map(cat => {
                  const entries = Object.entries(SCENARIOS).filter(([, v]) => v.category === cat.id);
                  const isSalvo = cat.id === "SALVO";
                  return (
                    <div key={cat.id} className={`scenario-cat ${isSalvo ? "salvo-cat" : ""}`}>
                      <div className="cat-label" style={{ color: cat.color, borderColor: cat.color + "44" }}>{cat.label}</div>
                      <div className={isSalvo ? "salvo-grid" : ""}>
                        {entries.map(([k, v]) => {
                          const isActive = scenarioName === k && running;
                          return (
                            <button key={k}
                              className={`scen-btn ${isActive ? "scen-active" : ""}`}
                              style={isActive ? { borderColor: cat.color, boxShadow: `0 0 14px ${cat.color}44`, background: cat.color + "18" } : {}}
                              onClick={() => onLaunch(k)}
                              disabled={running || hud.apiStatus === "offline"}>
                              <div className="scen-top">
                                <span className="scen-name">{v.label}</span>
                                <span className="scen-vec" style={{ color: cat.color }}>{v.vector}</span>
                              </div>
                              <div className="scen-desc">{v.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bottom-control">
              <div className="bottom-section-label">FIRE CONTROL</div>
              <div className="fire-status">
                <div className="fire-status-row">
                  <span className="fire-label">MODE</span>
                  <span className="fire-value" style={{ color: running ? "#7cf3ff" : "#7a8a98" }}>{running ? "ENGAGING" : "STANDBY"}</span>
                </div>
                <div className="fire-status-row">
                  <span className="fire-label">SCEN</span>
                  <span className="fire-value">{scenarioName.replace("_","-")}</span>
                </div>
                <div className="fire-status-row">
                  <span className="fire-label">KILL</span>
                  <span className="fire-value" style={{ color: "#7cf3ff" }}>{hud.intercepted}/{hud.total || "—"}</span>
                </div>
                <div className="fire-status-row">
                  <span className="fire-label">T+</span>
                  <span className="fire-value">{hud.elapsed.toFixed(1)}s</span>
                </div>
              </div>
              <button className="standby-btn" onClick={onReset}>
                <span className="standby-icon">■</span>
                <span>STANDBY</span>
              </button>
              <button className="standby-btn" onClick={onStress} disabled={running || stressBusy || hud.apiStatus === "offline"}>
                <span className="standby-icon">⚡</span>
                <span>{stressBusy ? "TESTING…" : "BREAKPOINT"}</span>
              </button>
            </div>

            <button className="bottom-toggle" onClick={() => setBottomOpen(false)} title="Collapse panel">▼</button>
          </>
        ) : (
          <button className="bottom-reopen" onClick={() => setBottomOpen(true)}>
            ▲ &nbsp; SCENARIO SELECT · {scenarioName.replace("_","-")} · {hud.intercepted}/{hud.total || "—"} KILLED
          </button>
        )}
      </div>

      <div className="scanlines" />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
