# Rocket Simulator

A polished browser-based rocket launch simulator built with plain HTML, CSS, and vanilla JavaScript.

Live site: [kgeoffrey.github.io/rocket-sim](https://kgeoffrey.github.io/rocket-sim/)

The app simulates a 2D launch from Earth with:

- altitude-dependent gravity
- atmospheric drag
- a smooth gravity turn
- finite-fuel mass burnoff
- curved-Earth visuals
- live telemetry
- cinematic camera and parallax background layers

## Run

No build step is required.

Open `index.html` directly in a browser, or serve the folder with any simple static file server.

## Controls

- Choose a preset rocket or use custom values
- Adjust launch mass, thrust, fuel load, and engine Isp
- Launch and reset from the left sidebar
- Use the zoom controls in the simulation view
- Open `Settings` for drag, parallax, and finite-fuel toggles

## Presets

Included presets:

- Rocket Lab Electron
- SpaceX Falcon 9
- NASA Saturn V
- SpaceX Starship / Super Heavy

These are reasonable public-data-inspired approximations for interactive simulation, not mission-grade engineering models.

## Physics Notes

The simulator uses a simplified but robust flight model:

- inverse-square gravity
- exponential atmosphere
- drag opposing the velocity vector
- thrust aligned to a programmed pitch profile
- fuel depletion that reduces mass during powered flight

If the configuration is poor, liftoff can fail or the vehicle can burn out and fall back to Earth.

## Project Structure

- `index.html` - app structure
- `styles.css` - layout and visual styling
- `js/shared.js` - constants and shared helpers
- `js/render.js` - canvas rendering and scene drawing
- `js/app.js` - controls, physics, telemetry, and app flow

## Notes

This project is intentionally framework-free and designed to be easy to modify. It is best viewed on desktop, but remains usable on smaller screens.
