window.RocketSim = window.RocketSim || {};

(function initRender(ns) {
  "use strict";

  const { CONSTS, TAU, clamp, lerp, smoothstep, formatNumber, formatScale, mulberry32 } = ns;

  ns.generateScene = function generateScene(scene) {
    const rng = mulberry32(42);

    scene.stars.length = 0;
    scene.hazes.length = 0;
    scene.cloudsLow.length = 0;
    scene.cloudsHigh.length = 0;

    for (let i = 0; i < 320; i += 1) {
      scene.stars.push({
        x: (rng() - 0.5) * 14000000,
        y: 20000 + rng() * 4200000,
        radius: 0.35 + rng() * 1.7,
        alpha: 0.18 + rng() * 0.8,
        factor: 0.06 + rng() * 0.14,
        twinkle: rng() * TAU,
        tint: rng()
      });
    }

    for (let i = 0; i < 4; i += 1) {
      scene.hazes.push({
        x: (rng() - 0.5) * 12000000,
        y: 380000 + rng() * 1800000,
        radius: 150000 + rng() * 260000,
        alpha: 0.008 + rng() * 0.018,
        factor: 0.08 + rng() * 0.06,
        hue: rng()
      });
    }

    for (let i = 0; i < 18; i += 1) {
      scene.cloudsLow.push(createCloud(rng, 500, 16000, 0.84, 0.92, 0.95, 1.55));
    }

    for (let i = 0; i < 16; i += 1) {
      scene.cloudsHigh.push(createCloud(rng, 12000, 45000, 0.74, 0.84, 0.85, 1.35));
    }
  };

  ns.draw = function draw(app) {
    const { ctx, view, camera } = app;
    if (!ctx) {
      return;
    }

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);

    drawBackground(app);

    ctx.save();
    ctx.translate(view.width * 0.5, view.height * 0.5);
    ctx.scale(camera.zoom, -camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    drawEarth(app);
    drawLaunchpad(app);

    ctx.restore();

    drawTrail(app);

    ctx.save();
    ctx.translate(view.width * 0.5, view.height * 0.5);
    ctx.scale(camera.zoom, -camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    drawRocket(app);
    ctx.restore();

    drawHUD(app);
  };

  ns.ensureNoisePattern = function ensureNoisePattern(app) {
    if (app.noisePattern) {
      return app.noisePattern;
    }

    const noiseCanvas = document.createElement("canvas");
    noiseCanvas.width = 128;
    noiseCanvas.height = 128;

    const noiseCtx = noiseCanvas.getContext("2d");
    const image = noiseCtx.createImageData(noiseCanvas.width, noiseCanvas.height);

    for (let i = 0; i < image.data.length; i += 4) {
      const shade = 108 + Math.floor(Math.random() * 24);
      const alpha = Math.floor(Math.random() * 18);
      image.data[i] = shade;
      image.data[i + 1] = shade;
      image.data[i + 2] = shade + 4;
      image.data[i + 3] = alpha;
    }

    noiseCtx.putImageData(image, 0, 0);
    app.noisePattern = app.ctx.createPattern(noiseCanvas, "repeat");
    return app.noisePattern;
  };

  function createCloud(rng, minY, maxY, factorMin, factorMax, scaleMin, scaleMax) {
    const blobs = [];
    const blobCount = 4 + Math.floor(rng() * 3);

    for (let i = 0; i < blobCount; i += 1) {
      blobs.push({
        x: (rng() - 0.5) * 1200,
        y: (rng() - 0.3) * 260,
        r: 170 + rng() * 360
      });
    }

    return {
      x: rng() * CONSTS.cloudTile,
      y: minY + Math.pow(rng(), 1.35) * (maxY - minY),
      scale: scaleMin + rng() * (scaleMax - scaleMin),
      alpha: 0.08 + rng() * 0.14,
      factor: factorMin + rng() * (factorMax - factorMin),
      blobs: blobs.map((blob) => ({
        x: blob.x * 1.4,
        y: blob.y * 0.55,
        r: blob.r * 0.78,
        stretch: 1.35 + rng() * 0.9,
        soft: 0.42 + rng() * 0.18
      }))
    };
  }

  function drawBackground(app) {
    const { ctx, view, state } = app;
    const altitude = state.altitude;
    const spaceBlend = smoothstep(6000, 115000, altitude);

    const atmosphereAlpha = 1 - smoothstep(1200, 90000, altitude);
    drawSmoothSky(app, spaceBlend, atmosphereAlpha);

    const glow = ctx.createRadialGradient(
      view.width * 0.5,
      view.height * 0.95,
      view.height * 0.04,
      view.width * 0.5,
      view.height * 0.95,
      view.height * 0.78
    );
    glow.addColorStop(0, `rgba(108, 175, 255, ${0.18 * (1 - spaceBlend * 0.65)})`);
    glow.addColorStop(0.45, `rgba(61, 126, 214, ${0.1 * (1 - spaceBlend * 0.45)})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, view.width, view.height);

    const upperHaze = ctx.createLinearGradient(0, 0, 0, view.height * 0.55);
    upperHaze.addColorStop(0, `rgba(148, 183, 255, ${0.035 * atmosphereAlpha})`);
    upperHaze.addColorStop(0.4, `rgba(124, 168, 244, ${0.028 * atmosphereAlpha})`);
    upperHaze.addColorStop(1, "rgba(148,183,255,0)");
    ctx.fillStyle = upperHaze;
    ctx.fillRect(0, 0, view.width, view.height * 0.55);

    drawStars(app, spaceBlend);
    drawClouds(app);

    const groundFogAlpha = (1 - smoothstep(1800, 18000, altitude)) * (state.engineOn ? 0.28 : 0.18);
    if (groundFogAlpha > 0.004) {
      const fog = ctx.createRadialGradient(
        view.width * 0.5,
        view.height * 1.02,
        30,
        view.width * 0.5,
        view.height * 1.02,
        Math.max(view.width, view.height) * 0.75
      );
      fog.addColorStop(0, `rgba(210, 224, 245, ${groundFogAlpha})`);
      fog.addColorStop(0.35, `rgba(150, 174, 208, ${groundFogAlpha * 0.45})`);
      fog.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, 0, view.width, view.height);
    }

    const vignette = ctx.createRadialGradient(
      view.width * 0.5,
      view.height * 0.42,
      Math.min(view.width, view.height) * 0.25,
      view.width * 0.5,
      view.height * 0.5,
      Math.max(view.width, view.height) * 0.9
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, view.width, view.height);

    const noisePattern = ns.ensureNoisePattern(app);
    if (noisePattern) {
      ctx.save();
      ctx.globalAlpha = 0.012;
      ctx.fillStyle = noisePattern;
      ctx.fillRect(0, 0, view.width, view.height);
      ctx.restore();
    }
  }

  function drawSmoothSky(app, spaceBlend, atmosphereAlpha) {
    const { ctx, view } = app;
    const sky = ctx.createLinearGradient(0, 0, 0, view.height);
    const skyStops = createSkyStops(spaceBlend, atmosphereAlpha);

    for (let i = 0; i < 32; i += 1) {
      const t = i / 31;
      const easedT = t * t * (3 - 2 * t);
      const color = sampleColorStops(skyStops, easedT);
      sky.addColorStop(t, rgbString(color));
    }

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, view.width, view.height);

    const horizonBlend = ctx.createLinearGradient(0, view.height * 0.36, 0, view.height);
    horizonBlend.addColorStop(0, "rgba(0,0,0,0)");
    horizonBlend.addColorStop(0.38, `rgba(78, 128, 204, ${0.035 * atmosphereAlpha})`);
    horizonBlend.addColorStop(0.68, `rgba(108, 166, 244, ${0.08 * atmosphereAlpha})`);
    horizonBlend.addColorStop(0.88, `rgba(140, 196, 255, ${0.12 * atmosphereAlpha})`);
    horizonBlend.addColorStop(1, `rgba(172, 218, 255, ${0.16 * atmosphereAlpha})`);
    ctx.fillStyle = horizonBlend;
    ctx.fillRect(0, 0, view.width, view.height);
  }

  function createSkyStops(spaceBlend, atmosphereAlpha) {
    return [
      { t: 0, color: mixRgb([7, 14, 29], [3, 5, 12], spaceBlend) },
      { t: 0.08, color: mixRgb([8, 16, 32], [3, 6, 14], spaceBlend * 0.55) },
      { t: 0.18, color: mixRgb([8, 18, 36], [4, 8, 17], spaceBlend * 0.7) },
      { t: 0.32, color: mixRgb([9, 22, 44], [4, 8, 17], spaceBlend * 0.78) },
      { t: 0.48, color: mixRgb([10, 22, 46], [4, 7, 16], spaceBlend * 0.85) },
      { t: 0.62, color: mixRgb([12, 28, 58], [5, 8, 17], spaceBlend * 0.88) },
      { t: 0.74, color: mixRgb([16, 38, 78], [6, 9, 18], spaceBlend * 0.9) },
      {
        t: 0.84,
        color: addRgb(
          mixRgb([21, 54, 106], [7, 10, 20], spaceBlend),
          [18 * atmosphereAlpha, 26 * atmosphereAlpha, 40 * atmosphereAlpha]
        )
      },
      {
        t: 0.92,
        color: addRgb(
          mixRgb([34, 80, 142], [8, 11, 21], spaceBlend),
          [34 * atmosphereAlpha, 46 * atmosphereAlpha, 62 * atmosphereAlpha]
        )
      },
      {
        t: 0.97,
        color: addRgb(
          mixRgb([58, 118, 186], [9, 12, 22], spaceBlend),
          [42 * atmosphereAlpha, 56 * atmosphereAlpha, 76 * atmosphereAlpha]
        )
      },
      {
        t: 1,
        color: addRgb(
          mixRgb([94, 156, 222], [11, 14, 24], spaceBlend),
          [46 * atmosphereAlpha, 64 * atmosphereAlpha, 88 * atmosphereAlpha]
        )
      }
    ];
  }

  function sampleColorStops(stops, t) {
    if (t <= stops[0].t) {
      return stops[0].color;
    }

    for (let i = 1; i < stops.length; i += 1) {
      const previous = stops[i - 1];
      const current = stops[i];
      if (t <= current.t) {
        const localT = (t - previous.t) / (current.t - previous.t || 1);
        return [
          lerp(previous.color[0], current.color[0], localT),
          lerp(previous.color[1], current.color[1], localT),
          lerp(previous.color[2], current.color[2], localT)
        ];
      }
    }

    return stops[stops.length - 1].color;
  }

  function mixRgb(a, b, t) {
    return [
      lerp(a[0], b[0], t),
      lerp(a[1], b[1], t),
      lerp(a[2], b[2], t)
    ];
  }

  function rgbString(color) {
    return `rgb(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])})`;
  }

  function addRgb(color, addition) {
    return [
      clamp(color[0] + addition[0], 0, 255),
      clamp(color[1] + addition[1], 0, 255),
      clamp(color[2] + addition[2], 0, 255)
    ];
  }

  function drawStars(app, spaceBlend) {
    const { ctx, view, camera, state, scene, visualTime } = app;
    const starVisibility = 0.02 + 0.98 * smoothstep(18000, 90000, state.altitude);
    const hazeVisibility = 0.02 + 0.98 * smoothstep(60000, 120000, state.altitude);
    const bgScale = 0.00022;

    for (let i = 0; i < scene.hazes.length; i += 1) {
      const haze = scene.hazes[i];
      const factor = state.parallaxEnabled ? haze.factor : 0;
      const sx = view.width * 0.5 + (haze.x - camera.x * factor) * bgScale;
      const sy = view.height * 0.6 - (haze.y - camera.y * factor) * bgScale;
      const radius = haze.radius * bgScale;

      if (sx < -radius || sx > view.width + radius || sy < -radius || sy > view.height + radius) {
        continue;
      }

      const hueMix = haze.hue;
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
      grad.addColorStop(0, `rgba(${Math.round(76 + hueMix * 18)}, ${Math.round(108 + hueMix * 26)}, ${Math.round(180 + hueMix * 20)}, ${haze.alpha * hazeVisibility})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);
    }

    for (let i = 0; i < scene.stars.length; i += 1) {
      const star = scene.stars[i];
      const factor = state.parallaxEnabled ? star.factor : 0;
      const sx = view.width * 0.5 + (star.x - camera.x * factor) * bgScale;
      const sy = view.height * 0.62 - (star.y - camera.y * factor) * bgScale;

      if (sx < -4 || sx > view.width + 4 || sy < -4 || sy > view.height + 4) {
        continue;
      }

      const twinkle = 0.64 + 0.36 * Math.sin(visualTime * (0.8 + star.factor * 3.5) + star.twinkle);
      const alpha = star.alpha * starVisibility * twinkle;
      const warm = star.tint;
      ctx.fillStyle = `rgba(${Math.round(225 + warm * 20)}, ${Math.round(232 + warm * 12)}, 255, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.min(1.45, star.radius), 0, TAU);
      ctx.fill();
    }

    if (spaceBlend > 0.12) {
      const upperGlow = ctx.createLinearGradient(0, 0, 0, view.height * 0.6);
      upperGlow.addColorStop(0, `rgba(255,255,255,${0.03 * spaceBlend})`);
      upperGlow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = upperGlow;
      ctx.fillRect(0, 0, view.width, view.height * 0.6);
    }
  }

  function drawClouds(app) {
    const { state, scene } = app;
    const cloudVisibility = 1 - smoothstep(24000, 90000, state.altitude);
    if (cloudVisibility <= 0.002) {
      return;
    }

    drawCloudLayer(app, scene.cloudsHigh, cloudVisibility * 0.5);
    drawCloudLayer(app, scene.cloudsLow, cloudVisibility * 0.9);
  }

  function drawCloudLayer(app, layer, visibility) {
    const { ctx, view, camera, state } = app;
    if (visibility <= 0.002) {
      return;
    }

    for (let i = 0; i < layer.length; i += 1) {
      const cloud = layer[i];
      const factor = state.parallaxEnabled ? cloud.factor : 1;
      const tileAnchor = Math.floor((camera.x * factor) / CONSTS.cloudTile) * CONSTS.cloudTile;

      for (let k = -1; k <= 1; k += 1) {
        const wx = cloud.x + tileAnchor + k * CONSTS.cloudTile;
        const point = worldToScreenParallax(app, wx, cloud.y, factor);

        if (point.x < -220 || point.x > view.width + 220 || point.y < -160 || point.y > view.height + 180) {
          continue;
        }

        const layerFade = visibility * (1 - smoothstep(36000, 52000, cloud.y));
        const blurAlpha = cloud.alpha * layerFade * 0.28;
        const bodyAlpha = cloud.alpha * layerFade;

        for (let b = 0; b < cloud.blobs.length; b += 1) {
          const blob = cloud.blobs[b];
          const radiusX = blob.r * blob.stretch * cloud.scale * camera.zoom;
          const radiusY = blob.r * blob.soft * cloud.scale * camera.zoom;
          if (radiusX < 0.8 || radiusY < 0.4) {
            continue;
          }

          const bx = point.x + blob.x * cloud.scale * camera.zoom;
          const by = point.y - blob.y * cloud.scale * camera.zoom;

          ctx.fillStyle = `rgba(215, 229, 248, ${blurAlpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(bx, by, radiusX * 1.1, radiusY * 1.3, 0, 0, TAU);
          ctx.fill();

          ctx.fillStyle = `rgba(240, 246, 255, ${bodyAlpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(bx, by, radiusX, radiusY, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function surfaceY(x) {
    const xx = x * x;
    const rr = CONSTS.re * CONSTS.re;
    if (xx >= rr) {
      return -CONSTS.re;
    }
    return Math.sqrt(rr - xx) - CONSTS.re;
  }

  function drawEarth(app) {
    const { ctx, view, camera } = app;
    const span = view.width / camera.zoom;
    const left = camera.x - span * 0.7;
    const right = camera.x + span * 0.7;
    const steps = 110;
    const fillBottom = camera.y - (view.height / camera.zoom) - 180000;

    ctx.beginPath();
    ctx.moveTo(left, fillBottom);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = lerp(left, right, t);
      ctx.lineTo(x, surfaceY(x));
    }
    ctx.lineTo(right, fillBottom);
    ctx.closePath();

    ctx.fillStyle = "#09121c";
    ctx.fill();

    const curveReveal = 1 - smoothstep(0.04, 0.14, camera.zoom);

    if (curveReveal > 0.001) {
      fillSurfaceBand(ctx, left, right, 0, 12000, `rgba(82, 156, 242, ${(0.12 * curveReveal).toFixed(3)})`, steps);
      fillSurfaceBand(ctx, left, right, 12000, 26000, `rgba(124, 194, 255, ${(0.06 * curveReveal).toFixed(3)})`, steps);
    }

    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = lerp(left, right, t);
      const y = surfaceY(x);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = "rgba(150, 208, 255, 0.12)";
    ctx.lineWidth = 1.4 / camera.zoom;
    ctx.stroke();

    if (camera.zoom > 0.015) {
      ctx.beginPath();
      const ridgePoints = [-3200, -2500, -2100, -1500, -1100, -500, 250, 820, 1480, 2200, 3000];
      for (let i = 0; i < ridgePoints.length; i += 1) {
        const x = ridgePoints[i];
        const heights = [18, 36, 28, 72, 30, 48, 22, 58, 38, 64, 20];
        const y = surfaceY(x) + heights[i];
        if (i === 0) {
          ctx.moveTo(x, surfaceY(x));
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      const lastX = ridgePoints[ridgePoints.length - 1];
      ctx.lineTo(lastX, surfaceY(lastX));
      ctx.closePath();
      ctx.fillStyle = "rgba(10, 18, 28, 0.92)";
      ctx.fill();
    }
  }

  function fillSurfaceBand(ctx, left, right, innerOffset, outerOffset, fillStyle, steps) {
    ctx.beginPath();
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = lerp(left, right, t);
      const y = surfaceY(x) + outerOffset;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    for (let i = steps; i >= 0; i -= 1) {
      const t = i / steps;
      const x = lerp(left, right, t);
      const y = surfaceY(x) + innerOffset;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  function drawLaunchpad(app) {
    const { ctx, view, state, camera } = app;
    const padScreen = worldToScreen(app, 0, 0);
    if (padScreen.x < -260 || padScreen.x > view.width + 260 || padScreen.y < -220 || padScreen.y > view.height + 320) {
      return;
    }

    const ground = surfaceY(0);

    if (state.engineOn) {
      ctx.fillStyle = "rgba(255, 168, 96, 0.12)";
      ctx.beginPath();
      ctx.ellipse(0, ground + 8, 110, 28, 0, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = "#141c27";
    ctx.fillRect(-150, ground - 12, 300, 12);

    ctx.fillStyle = "#1b2635";
    ctx.fillRect(-92, ground - 2, 184, 8);

    ctx.fillStyle = "#263648";
    ctx.fillRect(-24, ground, 18, 154);

    ctx.fillStyle = "#31465e";
    ctx.fillRect(-28, ground + 32, 34, 8);
    ctx.fillRect(-28, ground + 68, 28, 7);
    ctx.fillRect(-28, ground + 104, 24, 7);

    ctx.strokeStyle = "rgba(184, 210, 240, 0.35)";
    ctx.lineWidth = 1.2 / camera.zoom;
    ctx.beginPath();
    ctx.moveTo(-6, ground + 36);
    ctx.lineTo(8, ground + 36);
    ctx.lineTo(10, ground + 12);
    ctx.stroke();

    if (!state.launched || state.altitude < 280) {
      ctx.strokeStyle = "rgba(182, 206, 234, 0.26)";
      ctx.beginPath();
      ctx.moveTo(-6, ground + 36);
      ctx.lineTo(-1, ground + 36);
      ctx.lineTo(-1, ground + 32);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(182, 200, 220, 0.16)";
    ctx.fillRect(-72, ground + 2, 144, 2);
  }

  function drawTrail(app) {
    const { ctx, state } = app;
    if (state.history.length < 2) {
      return;
    }

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    let first = true;
    for (let i = 0; i < state.history.length; i += 1) {
      const point = worldToScreen(app, state.history[i].x, state.history[i].y);
      if (first) {
        ctx.moveTo(point.x, point.y);
        first = false;
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    const current = worldToScreen(app, state.x, state.y);
    ctx.lineTo(current.x, current.y);

    ctx.strokeStyle = "rgba(106, 196, 255, 0.16)";
    ctx.lineWidth = 8;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(94, 183, 255, 0.28)";
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(192, 232, 255, 0.78)";
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.restore();
  }

  function drawRocket(app) {
    const { ctx, state, camera, visualTime } = app;
    const rocketLength = 52;
    const scaleBoost = Math.min(4, Math.max(1, 14 / Math.max(rocketLength * camera.zoom, 1e-6)));

    ctx.save();
    ctx.translate(state.x, state.y);
    ctx.rotate((state.worldAngle ?? state.pitch) - Math.PI / 2);
    ctx.scale(scaleBoost, scaleBoost);

    if (state.engineOn && state.launched) {
      const atmosphereFactor = 1 - smoothstep(70000, 220000, state.altitude);
      const flicker = 0.78 + 0.22 * Math.sin(visualTime * 26) + 0.08 * Math.sin(visualTime * 77);
      const plumeLength = 22 + 18 * flicker + 10 * atmosphereFactor;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const outer = ctx.createLinearGradient(0, 0, 0, -plumeLength);
      outer.addColorStop(0, "rgba(255, 247, 218, 0.95)");
      outer.addColorStop(0.24, "rgba(255, 182, 92, 0.88)");
      outer.addColorStop(0.62, "rgba(255, 103, 48, 0.42)");
      outer.addColorStop(1, "rgba(255, 103, 48, 0)");
      ctx.fillStyle = outer;

      ctx.beginPath();
      ctx.moveTo(-4.8, 0);
      ctx.quadraticCurveTo(-8.4, -plumeLength * 0.26, -2.2, -plumeLength * 0.95);
      ctx.quadraticCurveTo(0, -plumeLength * 1.12, 2.2, -plumeLength * 0.95);
      ctx.quadraticCurveTo(8.4, -plumeLength * 0.26, 4.8, 0);
      ctx.closePath();
      ctx.fill();

      const inner = ctx.createLinearGradient(0, 0, 0, -plumeLength * 0.72);
      inner.addColorStop(0, "rgba(255, 255, 240, 1)");
      inner.addColorStop(0.35, "rgba(255, 225, 150, 0.95)");
      inner.addColorStop(1, "rgba(255, 140, 56, 0)");
      ctx.fillStyle = inner;

      ctx.beginPath();
      ctx.moveTo(-2.2, 0);
      ctx.quadraticCurveTo(-4.2, -plumeLength * 0.18, -1.2, -plumeLength * 0.7);
      ctx.quadraticCurveTo(0, -plumeLength * 0.83, 1.2, -plumeLength * 0.7);
      ctx.quadraticCurveTo(4.2, -plumeLength * 0.18, 2.2, 0);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    const bodyGradient = ctx.createLinearGradient(-6, 0, 6, 0);
    bodyGradient.addColorStop(0, "#d5e5f4");
    bodyGradient.addColorStop(0.48, "#fbfeff");
    bodyGradient.addColorStop(1, "#b3c7d9");

    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.moveTo(0, 52);
    ctx.lineTo(5.2, 44);
    ctx.lineTo(5.2, 13.5);
    ctx.lineTo(9, 2.2);
    ctx.lineTo(6.1, 0);
    ctx.lineTo(3.2, 6.6);
    ctx.lineTo(-3.2, 6.6);
    ctx.lineTo(-6.1, 0);
    ctx.lineTo(-9, 2.2);
    ctx.lineTo(-5.2, 13.5);
    ctx.lineTo(-5.2, 44);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#35485b";
    ctx.beginPath();
    ctx.moveTo(-3.6, -1.3);
    ctx.lineTo(3.6, -1.3);
    ctx.lineTo(2.2, -5);
    ctx.lineTo(-2.2, -5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1a2431";
    ctx.fillRect(-1.25, 10.5, 2.5, 22);

    ctx.fillStyle = "#8fb6d8";
    ctx.beginPath();
    ctx.ellipse(0, 30.5, 2.4, 4.4, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1.3 / (camera.zoom * scaleBoost);
    ctx.stroke();

    ctx.strokeStyle = "rgba(33, 45, 60, 0.85)";
    ctx.beginPath();
    ctx.moveTo(0, 52);
    ctx.lineTo(5.2, 44);
    ctx.lineTo(5.2, 13.5);
    ctx.lineTo(9, 2.2);
    ctx.lineTo(6.1, 0);
    ctx.lineTo(3.2, 6.6);
    ctx.lineTo(-3.2, 6.6);
    ctx.lineTo(-6.1, 0);
    ctx.lineTo(-9, 2.2);
    ctx.lineTo(-5.2, 13.5);
    ctx.lineTo(-5.2, 44);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  function drawHUD(app) {
    const { ctx, view, state, camera } = app;

    ctx.save();
    ctx.fillStyle = "rgba(238, 245, 255, 0.82)";
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,0.42)";
    ctx.shadowBlur = 10;

    const scaleWidth = Math.max(80, Math.min(160, view.width * 0.12));
    const worldSpan = scaleWidth / camera.zoom;
    const scaleX = 18;
    const scaleY = view.height - 24;

    ctx.strokeStyle = "rgba(235, 244, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(scaleX, scaleY);
    ctx.lineTo(scaleX + scaleWidth, scaleY);
    ctx.moveTo(scaleX, scaleY - 5);
    ctx.lineTo(scaleX, scaleY + 5);
    ctx.moveTo(scaleX + scaleWidth, scaleY - 5);
    ctx.lineTo(scaleX + scaleWidth, scaleY + 5);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(formatScale(worldSpan), scaleX, scaleY - 8);

    ctx.restore();
  }

  function worldToScreen(app, x, y) {
    const { view, camera } = app;
    return {
      x: view.width * 0.5 + (x - camera.x) * camera.zoom,
      y: view.height * 0.5 - (y - camera.y) * camera.zoom
    };
  }

  function worldToScreenParallax(app, x, y, factor) {
    const { view, camera } = app;
    return {
      x: view.width * 0.5 + (x - camera.x * factor) * camera.zoom,
      y: view.height * 0.5 - (y - camera.y * factor) * camera.zoom
    };
  }

  ns.surfaceY = surfaceY;
})(window.RocketSim);
