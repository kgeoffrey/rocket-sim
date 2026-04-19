window.RocketSim = window.RocketSim || {};

(function initShared(ns) {
  "use strict";

  ns.TAU = Math.PI * 2;

  ns.CONSTS = {
    re: 6371000,
    g0: 9.81,
    rho0: 1.225,
    scaleHeight: 8000,
    dragCoeffArea: 0.2,
    trailMax: 1800,
    trailSampleTime: 0.08,
    cloudTile: 32000,
    maxDt: 0.033
  };

  ns.createInitialView = function createInitialView() {
    return {
      width: 0,
      height: 0,
      dpr: 1
    };
  };

  ns.createInitialState = function createInitialState() {
    return {
      launchMass: 100000,
      mass: 100000,
      thrustKN: 2500,
      fuelFraction: 0.68,
      fuelEnabled: true,
      isp: 320,
      dryMass: 32000,
      fuelMass: 68000,
      initialFuelMass: 68000,
      massFlow: 0,
      dragEnabled: true,
      parallaxEnabled: true,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      pitch: Math.PI / 2,
      worldAngle: Math.PI / 2,
      commandedPitch: Math.PI / 2,
      timeElapsed: 0,
      launched: false,
      engineOn: false,
      statusLabel: "Ready",
      statusNote: "Vehicle on pad",
      altitude: 0,
      horizontalSpeed: 0,
      verticalSpeed: 0,
      downrange: 0,
      onSurface: true,
      hasLiftedOff: false,
      maxAltitude: 0,
      history: [],
      historyTimer: 0,
      speed: 0,
      twr: 0,
      gLoad: 1,
      gravityAccel: ns.CONSTS.g0,
      dragAccel: 0,
      density: ns.CONSTS.rho0
    };
  };

  ns.createInitialEffects = function createInitialEffects() {
    return {
      impactTriggered: false,
      impactX: 0,
      impactY: 0,
      explosionDuration: 0,
      explosionTime: 0,
      impactFlash: 0,
      explosionParticles: []
    };
  };

  ns.createInitialCamera = function createInitialCamera() {
    return {
      x: 0,
      y: 620,
      zoom: 0.2,
      baseManualZoom: 2.4,
      manualZoom: 2.4,
      targetX: 0,
      targetY: 620,
      targetZoom: 0.2
    };
  };

  ns.createScene = function createScene() {
    return {
      stars: [],
      hazes: [],
      cloudsLow: [],
      cloudsHigh: []
    };
  };

  ns.clamp = function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  };

  ns.lerp = function lerp(a, b, t) {
    return a + (b - a) * t;
  };

  ns.smoothstep = function smoothstep(edge0, edge1, x) {
    const t = ns.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  ns.mixColor = function mixColor(a, b, t) {
    const r = Math.round(ns.lerp(a[0], b[0], t));
    const g = Math.round(ns.lerp(a[1], b[1], t));
    const bCh = Math.round(ns.lerp(a[2], b[2], t));
    return `rgb(${r}, ${g}, ${bCh})`;
  };

  ns.formatNumber = function formatNumber(value, digits) {
    if (!Number.isFinite(value)) {
      return "--";
    }

    return value.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  };

  ns.formatScale = function formatScale(worldMeters) {
    if (worldMeters >= 1000) {
      return `${ns.formatNumber(worldMeters / 1000, 1)} km`;
    }
    return `${ns.formatNumber(worldMeters, 0)} m`;
  };

  ns.mulberry32 = function mulberry32(seed) {
    let t = seed >>> 0;
    return function next() {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };
})(window.RocketSim);
