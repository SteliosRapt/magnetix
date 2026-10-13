# Magnetix

Interactive 3D visualisation of magnetic fields (Biot–Savart) and of charged particles moving in them.

The deliverable is a single self-contained file, **`dist/magnetix.html`**. Open it in a browser (it loads three.js from a CDN). It is generated from the sources in `src/`, so don't edit it by hand.

## Building

```sh
npm run build     # src/ → dist/magnetix.html
npm run watch     # rebuild on every change in src/
```

No dependencies, just Node 18+.

## How the source is organised

`build.mjs` takes `src/index.html` and inlines every file in `src/styles/` at `/* @styles */` and every file in `src/js/` at `/* @scripts */`, in filename order.

The JS files are **not** ES modules. They're concatenated into one `<script type="module">` and share a single scope, so a function defined in one file can be used in any other. The numeric prefix sets the order the top-level code runs in. A file may *call* a function from a later file (function declarations are hoisted), but top-level code must not read a `const`/`let` declared in a later file before that file has run.

| File | What's in it |
|---|---|
| `src/index.html` | Page shell: panels, viewport, HUD markup, three.js import map |
| **styles/** | |
| `00-base.css` | Colour tokens, body, buttons |
| `10-shell.css` | Activity bar, side panels, explorer tree |
| `20-viewport.css` | Title, viewport toolbar, hint, off-screen indicators |
| `30-charges.css` | Charges tab: charge list, inspector, velocity pad, tabs, sim controls |
| `40-hud.css` | Inspect-mode HUD, scope canvases, force legend |
| `50-params.css` | Field tab: sliders, toggles, buttons |
| **js/** | |
| `00-imports.js` | three.js, OrbitControls, RoomEnvironment |
| `01-physics-core.js` | `workerCore()`: Biot–Savart field of straight segments, vector potential, RK4 field-line tracing, flux-weighted seeding (also runs as a Web Worker) |
| `02-vector-utils.js` | Small vector helpers, polyline subdivision, seeded RNG |
| `03-accelerator.js` | Ring-accelerator geometry (cos-θ dipoles/quadrupoles) and FODO design |
| `04-scenes.js` | Slider definitions, **`VIS`**: every scene (wires, coils, uniform field, accelerator), explorer groups, app `state` |
| `05-renderer.js` | three.js renderer, cameras, lights, materials, field-line colour ramp |
| `06-field-lines.js` | Building conductors and battery, field-line meshes, worker jobs |
| `07-view-loop.js` | Applying a scene, camera framing, arrow and current-flow animation, main `frame()` loop |
| `08-particles.js` | Charges: plane gizmo, axes, creating and removing particles, trails, B at a point, Boris integrator, force arrows |
| `09-ring-efield.js` | Electric fields in the accelerator (RF cavity and induced −∂A/∂t), scope trace |
| `10-interaction.js` | Run/pause/reset, working plane, camera fly-to, mouse picking and dragging, off-screen indicators, follow cam |
| `11-presets.js` | **`PRESETS`**: per-scene charge presets |
| `12-inspect.js` | Inspect mode: chase camera, B-arrow grid, HUD drawing |
| `13-charges-panel.js` | Charges tab: charge list and per-charge inspector |
| `14-tabs-toolbar.js` | Field/Charges tabs, per-scene charge sets, viewport toolbar |
| `15-app-ui.js` | Explorer tree, parameter sliders, display toggles, keyboard shortcuts, startup |
