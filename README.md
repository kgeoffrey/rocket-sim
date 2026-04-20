# Rocket Simulator

A cinematic browser-based rocket launch simulator built with plain HTML, CSS, and vanilla JavaScript.

Live site: [kgeoffrey.github.io/rocket-sim](https://kgeoffrey.github.io/rocket-sim/)

This project focuses on making ascent feel readable and dramatic to a human viewer: heavy liftoff, visible thrust, a smooth gravity turn, changing atmosphere, curved-Earth scale cues, and a live telemetry panel that makes the flight legible without feeling like a spreadsheet.

## Highlights

- smooth 2D launch simulation from Earth
- altitude-dependent gravity and atmospheric drag
- finite-fuel mode with mass burnoff and burnout / fallback behavior
- curved-Earth rendering with layered sky, clouds, stars, and parallax
- live telemetry for altitude, mass, speed, TWR, g-load, drag, density, and flight phase
- responsive UI with controls, simulation view, and telemetry sidebars

## Rocket Presets

The simulator includes preset vehicles inspired by real launch systems:

- Rocket Lab Electron
- SpaceX Falcon 9
- NASA Saturn V
- SpaceX Starship / Super Heavy

These presets are designed to be plausible and fun to explore in the simulator. They are based on public reference values and reasonable approximations, not mission-grade aerospace models.

## Run Locally

No build step is required.

Open `index.html` directly in a browser, or serve the folder with any simple static file server.

## Controls

- choose a preset rocket or switch to custom values
- adjust launch mass, thrust, fuel load, and engine Isp
- toggle drag, parallax, and finite-fuel mode in `Settings`
- launch, reset, and zoom directly from the UI

## Physics Model

The sim uses a simplified but robust flight model with:

- inverse-square gravity
- exponential atmospheric density
- drag opposing the velocity vector
- a smooth programmed gravity turn
- propellant depletion that reduces mass during powered flight

If the selected parameters are poor, liftoff can fail, the vehicle can burn out too early, or it can fall back and impact Earth.

## Project Structure

- `index.html` - app structure
- `styles.css` - layout and visual styling
- `js/shared.js` - constants and shared helpers
- `js/render.js` - canvas rendering and scene drawing
- `js/app.js` - controls, physics, telemetry, and app flow

## Notes

This project is intentionally framework-free and easy to modify. It works best on desktop, but remains usable on smaller screens as well.
