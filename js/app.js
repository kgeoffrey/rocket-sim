window.RocketSim = window.RocketSim || {};

(function initApp(ns) {
  "use strict";

  const { CONSTS, clamp, lerp, smoothstep, formatNumber } = ns;
  const ROCKET_PRESETS = {
    electron: {
      mass: 13000,
      thrustKN: 190,
      fuelPercent: 92,
      isp: 311
    },
    falcon9: {
      mass: 549000,
      thrustKN: 7686,
      fuelPercent: 94,
      isp: 282
    },
    saturnV: {
      mass: 2800000,
      thrustKN: 34500,
      fuelPercent: 85,
      isp: 263
    },
    starship: {
      mass: 5200000,
      thrustKN: 74400,
      fuelPercent: 94,
      isp: 327
    }
  };

  function createDomReferences() {
    return {
      canvas: document.getElementById("simCanvas"),
      presetSelect: document.getElementById("presetSelect"),
      massInput: document.getElementById("massInput"),
      thrustInput: document.getElementById("thrustInput"),
      fuelInput: document.getElementById("fuelInput"),
      ispInput: document.getElementById("ispInput"),
      dragToggle: document.getElementById("dragToggle"),
      parallaxToggle: document.getElementById("parallaxToggle"),
      fuelToggle: document.getElementById("fuelToggle"),
      massValue: document.getElementById("massValue"),
      thrustValue: document.getElementById("thrustValue"),
      fuelValue: document.getElementById("fuelValue"),
      ispValue: document.getElementById("ispValue"),
      launchButton: document.getElementById("launchButton"),
      resetButton: document.getElementById("resetButton"),
      zoomInButton: document.getElementById("zoomInButton"),
      zoomOutButton: document.getElementById("zoomOutButton"),
      zoomReadout: document.getElementById("zoomReadout"),
      controlsWrap: document.getElementById("controlsWrap"),
      statusPill: document.getElementById("statusPill"),
      statusNote: document.getElementById("statusNote"),
      phaseChip: document.getElementById("phaseChip"),
      metricAltitude: document.getElementById("metricAltitude"),
      metricMass: document.getElementById("metricMass"),
      metricVx: document.getElementById("metricVx"),
      metricVy: document.getElementById("metricVy"),
      metricSpeed: document.getElementById("metricSpeed"),
      metricTwr: document.getElementById("metricTwr"),
      metricGravity: document.getElementById("metricGravity"),
      metricDrag: document.getElementById("metricDrag"),
      metricGload: document.getElementById("metricGload"),
      metricFuel: document.getElementById("metricFuel"),
      metricTime: document.getElementById("metricTime"),
      metricRange: document.getElementById("metricRange"),
      metricPitch: document.getElementById("metricPitch"),
      metricDensity: document.getElementById("metricDensity"),
      metricPhase: document.getElementById("metricPhase")
    };
  }

  function createApp() {
    return {
      dom: createDomReferences(),
      ctx: null,
      view: ns.createInitialView(),
      state: ns.createInitialState(),
      effects: ns.createInitialEffects(),
      camera: ns.createInitialCamera(),
      scene: ns.createScene(),
      lastFrameTime: performance.now(),
      visualTime: 0
    };
  }

  function init() {
    const app = createApp();
    app.ctx = app.dom.canvas.getContext("2d");

    ns.generateScene(app.scene);
    bindEvents(app);
    syncControls(app);
    resizeCanvas(app);
    resetSimulation(app);
    requestAnimationFrame((now) => loop(app, now));
  }

  function bindEvents(app) {
    const { dom } = app;
    dom.presetSelect.addEventListener("change", () => applyPreset(app, dom.presetSelect.value));
    dom.massInput.addEventListener("input", () => handleControlChange(app));
    dom.thrustInput.addEventListener("input", () => handleControlChange(app));
    dom.fuelInput.addEventListener("input", () => handleControlChange(app));
    dom.ispInput.addEventListener("input", () => handleControlChange(app));
    dom.dragToggle.addEventListener("change", () => handleControlChange(app));
    dom.parallaxToggle.addEventListener("change", () => handleControlChange(app));
    dom.fuelToggle.addEventListener("change", () => handleControlChange(app));
    dom.launchButton.addEventListener("click", () => launchSimulation(app));
    dom.resetButton.addEventListener("click", () => resetSimulation(app));
    dom.zoomInButton.addEventListener("click", () => adjustManualZoom(app, 1.18));
    dom.zoomOutButton.addEventListener("click", () => adjustManualZoom(app, 1 / 1.18));
    window.addEventListener("resize", () => resizeCanvas(app));
  }

  function handleControlChange(app, keepPreset = false) {
    if (!keepPreset) {
      app.dom.presetSelect.value = "custom";
    }

    syncControls(app);
    if (!app.state.launched) {
      updateTelemetry(app);
      ns.draw(app);
    }
  }

  function applyPreset(app, presetKey) {
    const preset = ROCKET_PRESETS[presetKey];
    if (!preset) {
      handleControlChange(app, true);
      return;
    }

    const { dom } = app;
    dom.massInput.value = String(preset.mass);
    dom.thrustInput.value = String(preset.thrustKN);
    dom.fuelInput.value = String(preset.fuelPercent);
    dom.ispInput.value = String(preset.isp);
    dom.fuelToggle.checked = true;

    handleControlChange(app, true);
  }

  function syncControls(app) {
    const { dom, state } = app;

    state.launchMass = Number(dom.massInput.value);
    state.thrustKN = Number(dom.thrustInput.value);
    state.fuelFraction = Number(dom.fuelInput.value) / 100;
    state.isp = Number(dom.ispInput.value);
    state.dragEnabled = dom.dragToggle.checked;
    state.parallaxEnabled = dom.parallaxToggle.checked;
    state.fuelEnabled = dom.fuelToggle.checked;

    state.initialFuelMass = state.fuelEnabled ? state.launchMass * state.fuelFraction : 0;
    state.fuelMass = state.fuelEnabled ? state.initialFuelMass : 0;
    state.dryMass = state.launchMass - state.initialFuelMass;
    state.mass = state.fuelEnabled ? state.dryMass + state.fuelMass : state.launchMass;
    state.massFlow = state.fuelEnabled && state.isp > 0 ? (state.thrustKN * 1000) / (state.isp * CONSTS.g0) : 0;
    state.currentThrustN = 0;

    dom.massValue.textContent = formatNumber(state.launchMass, 0);
    dom.thrustValue.textContent = formatNumber(state.thrustKN, 0);
    dom.fuelValue.textContent = formatNumber(state.fuelFraction * 100, 0);
    dom.ispValue.textContent = formatNumber(state.isp, 0);
    dom.fuelInput.disabled = !state.fuelEnabled;
    dom.ispInput.disabled = !state.fuelEnabled;

    if (!state.launched) {
      updateDerivedState(state);
      state.twr = (state.thrustKN * 1000) / (state.mass * CONSTS.g0);
      state.gravityAccel = CONSTS.g0;
      state.dragAccel = 0;
      state.gLoad = 1;
      state.density = CONSTS.rho0;
      state.pitch = Math.PI / 2;
      state.worldAngle = Math.PI / 2;
      state.commandedPitch = Math.PI / 2;
      state.statusLabel = "Ready";
      state.statusNote = "Vehicle on pad";
    }
  }

  function setControlsLocked(app, locked) {
    const { dom, state } = app;
    dom.massInput.disabled = locked;
    dom.thrustInput.disabled = locked;
    dom.fuelInput.disabled = locked || !state.fuelEnabled;
    dom.ispInput.disabled = locked || !state.fuelEnabled;
    dom.dragToggle.disabled = locked;
    dom.parallaxToggle.disabled = locked;
    dom.fuelToggle.disabled = locked;
    dom.launchButton.disabled = locked;
    dom.controlsWrap.classList.toggle("locked", locked);
  }

  function resetSimulation(app) {
    const { state, camera } = app;

    state.launched = false;
    state.engineOn = false;
    state.hasLiftedOff = false;
    clearImpactEffects(app.effects);
    syncControls(app);
    camera.manualZoom = camera.baseManualZoom;

    state.x = 0;
    state.y = 0;
    state.vx = 0;
    state.vy = 0;
    state.ax = 0;
    state.ay = 0;
    state.pitch = Math.PI / 2;
    state.worldAngle = Math.PI / 2;
    state.commandedPitch = Math.PI / 2;
    state.timeElapsed = 0;
    state.statusLabel = "Ready";
    state.statusNote = "Vehicle on pad";
    state.altitude = 0;
    state.horizontalSpeed = 0;
    state.verticalSpeed = 0;
    state.downrange = 0;
    state.onSurface = true;
    state.maxAltitude = 0;
    state.history.length = 0;
    state.historyTimer = 0;
    state.speed = 0;
    state.currentThrustN = 0;
    updateDerivedState(state);
    refreshInstantaneousForces(state);
    state.currentThrustN = 0;
    state.twr = (state.thrustKN * 1000) / (state.mass * CONSTS.g0);
    state.gravityAccel = CONSTS.g0;
    state.dragAccel = 0;
    state.gLoad = 1;
    state.density = CONSTS.rho0;

    updateCamera(app, 0);
    setControlsLocked(app, false);
    updateTelemetry(app);
    ns.draw(app);
    app.lastFrameTime = performance.now();
  }

  function launchSimulation(app) {
    const { state } = app;
    if (state.launched) {
      return;
    }

    syncControls(app);

    clearImpactEffects(app.effects);
    state.launched = true;
    state.engineOn = true;
    state.statusLabel = "Ignition";
    state.statusNote = "Engine ignition on the pad";
    state.history.length = 0;
    state.history.push({ x: state.x, y: state.y });
    state.historyTimer = 0;

    setControlsLocked(app, true);
    updateTelemetry(app);
    ns.draw(app);
    app.lastFrameTime = performance.now();
  }

  function resizeCanvas(app) {
    const rect = app.dom.canvas.getBoundingClientRect();
    app.view.width = Math.max(1, rect.width);
    app.view.height = Math.max(1, rect.height);
    app.view.dpr = Math.min(window.devicePixelRatio || 1, 2);

    app.dom.canvas.width = Math.round(app.view.width * app.view.dpr);
    app.dom.canvas.height = Math.round(app.view.height * app.view.dpr);

    updateCamera(app, 0);
    ns.draw(app);
  }

  function loop(app, now) {
    let dt = (now - app.lastFrameTime) / 1000;
    app.lastFrameTime = now;
    app.visualTime = now * 0.001;

    if (!Number.isFinite(dt) || dt <= 0) {
      dt = 0.016;
    }

    dt = Math.min(CONSTS.maxDt, dt);
    update(app, dt);
    requestAnimationFrame((nextNow) => loop(app, nextNow));
  }

  function update(app, dt) {
    if (app.state.launched) {
      app.state.timeElapsed += dt;
      updatePhysics(app, dt);
    } else {
      updateDerivedState(app.state);
    }

    updateCamera(app, dt);
    updateTelemetry(app);
    ns.draw(app);
  }

  function updatePhysics(app, dt) {
    const { state } = app;
    const substeps = Math.max(1, Math.ceil(dt / 0.008));
    const stepDt = dt / substeps;

    for (let i = 0; i < substeps; i += 1) {
      stepPhysics(app, state, stepDt);
    }

    updateDerivedState(state);
    state.speed = Math.hypot(state.vx, state.vy);
    state.maxAltitude = Math.max(state.maxAltitude, state.altitude);
    if (state.altitude > 2) {
      state.hasLiftedOff = true;
    }
    refreshInstantaneousForces(state);
    state.twr = state.currentThrustN > 0 ? state.currentThrustN / (state.mass * state.gravityAccel) : 0;

    updateFlightStatus(state, state.currentThrustN, state.gravityAccel);

    state.historyTimer += dt;
    if (state.historyTimer >= CONSTS.trailSampleTime) {
      state.historyTimer = 0;
      const last = state.history[state.history.length - 1];
      if (!last || Math.hypot(state.x - last.x, state.y - last.y) > 8) {
        state.history.push({ x: state.x, y: state.y });
        if (state.history.length > CONSTS.trailMax) {
          state.history.shift();
        }
      }
    }
  }

  function computeCommandedPitch(altitude) {
    if (altitude <= 1000) {
      return Math.PI / 2;
    }

    const turnT = smoothstep(1000, 100000, altitude);
    const shaped = Math.pow(turnT, 1.1);
    return (Math.PI / 2) * (1 - shaped);
  }

  function updateFlightStatus(state, thrustN, gravity) {
    if (!state.launched) {
      if (state.hasLiftedOff && state.onSurface) {
        state.statusLabel = "Impact";
        state.statusNote = "Vehicle returned to Earth";
        return;
      }

      state.statusLabel = "Ready";
      state.statusNote = "Vehicle on pad";
      return;
    }

    if (state.onSurface) {
      if (state.hasLiftedOff) {
        state.statusLabel = "Impact";
        state.statusNote = "Vehicle returned to Earth";
        return;
      }

      if (state.engineOn && thrustN > 0) {
        if (thrustN <= state.mass * gravity * 1.01) {
          state.statusLabel = "Liftoff Failed";
          state.statusNote = "Insufficient thrust-to-weight on the pad";
        } else {
          state.statusLabel = "Ignition";
          state.statusNote = "Vehicle unweighting for liftoff";
        }
      } else if (state.fuelEnabled && state.fuelMass <= 0 && state.timeElapsed > 0) {
        state.statusLabel = "Launch Failed";
        state.statusNote = "Propellant depleted before liftoff";
      } else {
        state.statusLabel = "Grounded";
        state.statusNote = "Vehicle on pad";
      }
      return;
    }

    if (state.altitude > 50 && state.verticalSpeed < -15) {
      state.statusLabel = "Falling Back";
      state.statusNote = "Vehicle descending toward Earth";
      return;
    }

    if (!state.engineOn && state.altitude > 0) {
      if (state.fuelEnabled && state.fuelMass <= 0) {
        state.statusLabel = "Burnout";
        state.statusNote = "Propellant depleted, vehicle coasting";
      } else {
        state.statusLabel = "Coasting";
        state.statusNote = "Main engine cutoff";
      }
      return;
    }

    if (state.altitude < 1200) {
      state.statusLabel = "Ascending";
      state.statusNote = "Pad departure and initial climb";
      return;
    }

    if (state.altitude < 95000) {
      state.statusLabel = "Gravity Turn";
      state.statusNote = "Pitching over into downrange flight";
      return;
    }

    state.statusLabel = "Upper Ascent";
    state.statusNote = "Thin air and widening horizon";
  }

  function updateCamera(app, dt) {
    const { state, camera, view } = app;
    const altitude = state.altitude;
    const downrange = Math.abs(state.downrange);

    const fitHeight = Math.max(
      2200,
      altitude * 0.92 + 2500,
      altitude * 0.42 + downrange * 0.19 + 3200
    );

    camera.targetZoom = clamp((view.height / fitHeight) * camera.manualZoom, 0.0018, 1.2);

    const padBlend = smoothstep(250, 5000, altitude);
    const followBlend = smoothstep(1200, 30000, altitude);
    const screenOffsetPx = lerp(view.height * 0.08, view.height * 0.02, smoothstep(2000, 95000, altitude));
    const worldOffset = screenOffsetPx / camera.targetZoom;
    const rocketTargetY = state.y + worldOffset;
    const xLead = state.vx * 8 * followBlend;

    camera.targetX = lerp(0, state.x + xLead, followBlend);
    camera.targetY = lerp(180, rocketTargetY, padBlend);
    constrainRocketToFrame(app, true);

    if (!dt) {
      camera.x = camera.targetX;
      camera.y = camera.targetY;
      camera.zoom = camera.targetZoom;
      constrainRocketToFrame(app, false);
      return;
    }

    const posEase = 1 - Math.exp(-dt * 2.9);
    const zoomEase = 1 - Math.exp(-dt * 2.1);

    camera.x += (camera.targetX - camera.x) * posEase;
    camera.y += (camera.targetY - camera.y) * posEase;
    camera.zoom += (camera.targetZoom - camera.zoom) * zoomEase;
    constrainRocketToFrame(app, false);
  }

  function updateTelemetry(app) {
    const { dom, state, camera } = app;

    dom.metricAltitude.textContent = `${formatNumber(state.altitude / 1000, 2)} km`;
    dom.metricMass.textContent = `${formatNumber(state.mass, 0)} kg`;
    dom.metricVx.textContent = `${formatNumber(state.horizontalSpeed, 1)} m/s`;
    dom.metricVy.textContent = `${formatNumber(state.verticalSpeed, 1)} m/s`;
    dom.metricSpeed.textContent = `${formatNumber(state.speed, 1)} m/s`;
    dom.metricTwr.textContent = formatNumber(state.twr, 2);
    dom.metricGravity.textContent = `${formatNumber(state.gravityAccel, 2)} m/s²`;
    dom.metricDrag.textContent = `${formatNumber(state.dragAccel, 2)} m/s²`;
    dom.metricGload.textContent = `${formatNumber(state.gLoad, 2)} g`;
    dom.metricFuel.textContent = state.fuelEnabled ? `${formatNumber(state.fuelMass, 0)} kg` : "Infinite";
    dom.metricTime.textContent = `${formatNumber(state.timeElapsed, 1)} s`;
    dom.metricRange.textContent = `${formatNumber(state.downrange / 1000, 2)} km`;
    dom.metricPitch.textContent = `${formatNumber((state.pitch * 180) / Math.PI, 1)}°`;
    dom.metricDensity.textContent = `${formatNumber(state.density, 3)} kg/m³`;
    dom.metricPhase.textContent = state.statusLabel;

    dom.statusPill.textContent = state.statusLabel;
    dom.statusNote.textContent = state.statusNote;
    dom.phaseChip.textContent = state.statusLabel;
    dom.zoomReadout.textContent = `Zoom ${formatSignedPercent(getRelativeZoomPercent(camera))}`;
  }

  function adjustManualZoom(app, factor) {
    const { camera } = app;
    const minManualZoom = camera.baseManualZoom / 4;
    const maxManualZoom = camera.baseManualZoom * 4;
    camera.manualZoom = clamp(camera.manualZoom * factor, minManualZoom, maxManualZoom);
  }

  function getRelativeZoomPercent(camera) {
    if (camera.manualZoom >= camera.baseManualZoom) {
      return ((camera.manualZoom / camera.baseManualZoom) - 1) * 100;
    }

    return -((camera.baseManualZoom / camera.manualZoom) - 1) * 100;
  }

  function formatSignedPercent(value) {
    const rounded = Math.round(value);
    if (rounded > 0) {
      return `+${rounded}%`;
    }
    if (rounded < 0) {
      return `${rounded}%`;
    }
    return "0%";
  }

  function constrainRocketToFrame(app, useTarget) {
    const { state, view, camera } = app;
    const zoom = useTarget ? camera.targetZoom : camera.zoom;

    if (!zoom || !Number.isFinite(zoom)) {
      return;
    }

    let camX = useTarget ? camera.targetX : camera.x;
    let camY = useTarget ? camera.targetY : camera.y;

    const minScreenX = view.width * 0.18;
    const maxScreenX = view.width * 0.82;
    const minScreenY = view.height * 0.14;
    const maxScreenY = view.height * 0.76;

    const rocketScreenX = view.width * 0.5 + (state.x - camX) * zoom;
    const rocketScreenY = view.height * 0.5 - (state.y - camY) * zoom;

    if (rocketScreenX < minScreenX) {
      camX -= (minScreenX - rocketScreenX) / zoom;
    } else if (rocketScreenX > maxScreenX) {
      camX += (rocketScreenX - maxScreenX) / zoom;
    }

    if (rocketScreenY < minScreenY) {
      camY += (minScreenY - rocketScreenY) / zoom;
    } else if (rocketScreenY > maxScreenY) {
      camY -= (rocketScreenY - maxScreenY) / zoom;
    }

    if (useTarget) {
      camera.targetX = camX;
      camera.targetY = camY;
    } else {
      camera.x = camX;
      camera.y = camY;
    }
  }

  function getPlanetFrame(state) {
    const radialX = state.x;
    const radialY = state.y + CONSTS.re;
    const radius = Math.max(Math.hypot(radialX, radialY), 1);
    const upX = radialX / radius;
    const upY = radialY / radius;
    const tangentX = upY;
    const tangentY = -upX;

    return {
      radius,
      upX,
      upY,
      tangentX,
      tangentY
    };
  }

  function getThrustDirection(frame, pitch) {
    return {
      x: frame.tangentX * Math.cos(pitch) + frame.upX * Math.sin(pitch),
      y: frame.tangentY * Math.cos(pitch) + frame.upY * Math.sin(pitch)
    };
  }

  function projectToSurface(state, frame) {
    state.x = frame.upX * CONSTS.re;
    state.y = frame.upY * CONSTS.re - CONSTS.re;
  }

  function stepPhysics(app, state, dt) {
    if (dt <= 0) {
      return;
    }

    const frame = updateDerivedState(state);
    const altitude = state.altitude;
    state.commandedPitch = computeCommandedPitch(altitude);
    state.pitch += (state.commandedPitch - state.pitch) * (1 - Math.exp(-dt * 1.9));

    if (!state.fuelEnabled && state.engineOn && altitude > 160000 && state.speed > 2600 && state.pitch < 0.18) {
      state.engineOn = false;
    }

    if (state.fuelEnabled) {
      stepFiniteFuelPhysics(app, state, dt);
      return;
    }

    state.mass = state.launchMass;
    state.massFlow = 0;
    const thrustN = state.engineOn ? state.thrustKN * 1000 : 0;
    integrateSegment(app, state, dt, thrustN, state.mass);
  }

  function stepFiniteFuelPhysics(app, state, dt) {
    if (!state.engineOn) {
      state.massFlow = 0;
      state.mass = state.dryMass + state.fuelMass;
      integrateSegment(app, state, dt, 0, state.mass);
      return;
    }

    if (state.isp <= 0 || !Number.isFinite(state.isp)) {
      state.engineOn = false;
      state.massFlow = 0;
      state.currentThrustN = 0;
      state.mass = state.dryMass + state.fuelMass;
      integrateSegment(app, state, dt, 0, state.mass);
      return;
    }

    const fullThrustN = state.thrustKN * 1000;
    const idealMassFlow = fullThrustN / (state.isp * CONSTS.g0);
    if (!Number.isFinite(idealMassFlow) || idealMassFlow <= 0 || state.fuelMass <= 0) {
      state.fuelMass = Math.max(0, state.fuelMass);
      state.mass = state.dryMass + state.fuelMass;
      state.massFlow = 0;
      state.engineOn = false;
      integrateSegment(app, state, dt, 0, state.mass);
      return;
    }

    const burnDt = Math.min(dt, state.fuelMass / idealMassFlow);
    const burnedFuel = idealMassFlow * burnDt;
    const segmentMass = Math.max(state.dryMass, state.dryMass + state.fuelMass - burnedFuel * 0.5);

    state.massFlow = idealMassFlow;
    integrateSegment(app, state, burnDt, fullThrustN, segmentMass);

    state.fuelMass = Math.max(0, state.fuelMass - burnedFuel);
    state.mass = state.dryMass + state.fuelMass;

    if (state.fuelMass <= 1e-6) {
      state.fuelMass = 0;
      state.mass = state.dryMass;
      state.engineOn = false;
      state.massFlow = 0;
    }

    const coastDt = dt - burnDt;
    if (coastDt > 1e-8) {
      integrateSegment(app, state, coastDt, 0, state.mass);
    }
  }

  function integrateSegment(app, state, dt, thrustN, effectiveMass) {
    if (dt <= 0) {
      return;
    }

    const frame = updateDerivedState(state);
    const altitude = state.altitude;
    const gravity = CONSTS.g0 * Math.pow(CONSTS.re / frame.radius, 2);
    const density = state.dragEnabled ? CONSTS.rho0 * Math.exp(-altitude / CONSTS.scaleHeight) : 0;
    const thrustDirection = getThrustDirection(frame, state.pitch);
    state.worldAngle = Math.atan2(thrustDirection.y, thrustDirection.x);

    const currentSpeed = Math.hypot(state.vx, state.vy);
    let dragMag = 0;
    let dragX = 0;
    let dragY = 0;

    if (state.dragEnabled && currentSpeed > 1e-6) {
      dragMag = 0.5 * density * currentSpeed * currentSpeed * CONSTS.dragCoeffArea;
      dragX = dragMag * (state.vx / currentSpeed);
      dragY = dragMag * (state.vy / currentSpeed);
    }

    const thrustX = thrustN * thrustDirection.x;
    const thrustY = thrustN * thrustDirection.y;
    const nonGravAx = (thrustX - dragX) / effectiveMass;
    const nonGravAy = (thrustY - dragY) / effectiveMass;
    const gravityAx = -gravity * frame.upX;
    const gravityAy = -gravity * frame.upY;
    const totalAx = nonGravAx + gravityAx;
    const totalAy = nonGravAy + gravityAy;
    const radialAcceleration = totalAx * frame.upX + totalAy * frame.upY;

    state.currentThrustN = thrustN;
    state.gravityAccel = gravity;
    state.dragAccel = dragMag / effectiveMass;
    state.gLoad = state.onSurface && thrustN <= 0 ? 1 : Math.hypot(nonGravAx, nonGravAy) / CONSTS.g0;
    state.density = density;

    if (state.onSurface && state.verticalSpeed <= 0 && radialAcceleration <= 0) {
      projectToSurface(state, frame);
      state.ax = 0;
      state.ay = 0;
      state.vx = 0;
      state.vy = 0;
      return;
    }

    state.ax = totalAx;
    state.ay = totalAy;
    state.vx += state.ax * dt;
    state.vy += state.ay * dt;
    state.x += state.vx * dt;
    state.y += state.vy * dt;

    const postFrame = getPlanetFrame(state);
    if (postFrame.radius <= CONSTS.re) {
      projectToSurface(state, postFrame);
      state.ax = 0;
      state.ay = 0;
      state.vx = 0;
      state.vy = 0;
      if (state.hasLiftedOff) {
        clearImpactEffects(app.effects);
        state.engineOn = false;
        state.currentThrustN = 0;
        state.launched = false;
        state.statusLabel = "Impact";
        state.statusNote = "Vehicle returned to Earth";
      }
    }
  }

  function clearImpactEffects(effects) {
    effects.impactTriggered = false;
    effects.impactX = 0;
    effects.impactY = 0;
    effects.explosionDuration = 0;
    effects.explosionTime = 0;
    effects.impactFlash = 0;
    effects.explosionParticles.length = 0;
  }

  function triggerImpactExplosion(effects, impactX, impactY) {
    if (effects.impactTriggered) {
      return;
    }

    clearImpactEffects(effects);
    effects.impactTriggered = true;
    effects.impactX = impactX;
    effects.impactY = impactY;
    effects.explosionDuration = 1.1;
    effects.explosionTime = effects.explosionDuration;
    effects.impactFlash = 1;

    const particleCount = 28;
    for (let i = 0; i < particleCount; i += 1) {
      const spread = (Math.PI * i) / (particleCount - 1);
      const speed = 40 + Math.random() * 170;
      const liftBias = 0.35 + Math.random() * 0.75;

      effects.explosionParticles.push({
        x: effects.impactX,
        y: effects.impactY,
        vx: Math.cos(spread) * speed * (0.65 + Math.random() * 0.55),
        vy: Math.sin(spread) * speed * liftBias,
        life: 0.5 + Math.random() * 0.55,
        maxLife: 0.5 + Math.random() * 0.55,
        radius: 10 + Math.random() * 22,
        heat: Math.random()
      });
    }
  }

  function updateExplosion(effects, dt) {
    if (effects.explosionTime > 0) {
      effects.explosionTime = Math.max(0, effects.explosionTime - dt);
    }

    if (effects.explosionTime <= 0) {
      effects.explosionDuration = 0;
      effects.impactFlash = 0;
      effects.explosionParticles.length = 0;
      return;
    }

    if (effects.impactFlash > 0) {
      effects.impactFlash = Math.max(0, effects.impactFlash - dt * 2.4);
    }

    if (!effects.explosionParticles.length) {
      return;
    }

    const nextParticles = [];
    for (let i = 0; i < effects.explosionParticles.length; i += 1) {
      const particle = effects.explosionParticles[i];
      particle.life -= dt;
      if (particle.life <= 0) {
        continue;
      }

      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.pow(0.92, dt * 60);
      particle.vy = particle.vy * Math.pow(0.9, dt * 60) - 55 * dt;
      nextParticles.push(particle);
    }

    effects.explosionParticles = nextParticles;
  }

  function refreshInstantaneousForces(state) {
    const frame = updateDerivedState(state);
    const altitude = state.altitude;
    const gravity = CONSTS.g0 * Math.pow(CONSTS.re / frame.radius, 2);
    const density = state.dragEnabled ? CONSTS.rho0 * Math.exp(-altitude / CONSTS.scaleHeight) : 0;
    const thrustN = state.engineOn ? state.thrustKN * 1000 : 0;
    const thrustDirection = getThrustDirection(frame, state.pitch);
    const speed = Math.hypot(state.vx, state.vy);
    let dragMag = 0;
    let dragX = 0;
    let dragY = 0;

    if (state.dragEnabled && speed > 1e-6) {
      dragMag = 0.5 * density * speed * speed * CONSTS.dragCoeffArea;
      dragX = dragMag * (state.vx / speed);
      dragY = dragMag * (state.vy / speed);
    }

    const thrustX = thrustN * thrustDirection.x;
    const thrustY = thrustN * thrustDirection.y;
    const nonGravAx = (thrustX - dragX) / state.mass;
    const nonGravAy = (thrustY - dragY) / state.mass;
    const gravityAx = -gravity * frame.upX;
    const gravityAy = -gravity * frame.upY;
    const totalAx = nonGravAx + gravityAx;
    const totalAy = nonGravAy + gravityAy;
    const radialAcceleration = totalAx * frame.upX + totalAy * frame.upY;

    state.worldAngle = Math.atan2(thrustDirection.y, thrustDirection.x);
    state.currentThrustN = thrustN;
    state.gravityAccel = gravity;
    state.dragAccel = dragMag / state.mass;
    state.density = density;

    if (state.onSurface && state.verticalSpeed <= 0 && radialAcceleration <= 0) {
      state.ax = 0;
      state.ay = 0;
      state.gLoad = thrustN > 0 ? thrustN / (state.mass * CONSTS.g0) : 1;
      return;
    }

    state.ax = totalAx;
    state.ay = totalAy;
    state.gLoad = Math.hypot(nonGravAx, nonGravAy) / CONSTS.g0;
  }

  function updateDerivedState(state) {
    const frame = getPlanetFrame(state);
    state.altitude = Math.max(0, frame.radius - CONSTS.re);
    state.verticalSpeed = state.vx * frame.upX + state.vy * frame.upY;
    state.horizontalSpeed = state.vx * frame.tangentX + state.vy * frame.tangentY;
    state.downrange = Math.atan2(state.x, state.y + CONSTS.re) * CONSTS.re;
    state.onSurface = frame.radius <= CONSTS.re + 0.01;
    return frame;
  }

  document.addEventListener("DOMContentLoaded", init);
})(window.RocketSim);
