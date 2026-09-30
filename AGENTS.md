# Stillwater

A peaceful blue-hour Three.js pond. Use TypeScript, Vite, plain DOM/CSS, procedural original assets, and no runtime CDN dependencies. No backend, analytics, credentials, or external font requests.

## Workflow

- Work only inside this repository.
- Use vertical test-first slices: observe each new behavior fail before implementing it.
- `npm test` runs Vitest unit tests; `npm run test:e2e` runs real Chromium browser tests. `npm run build` typechecks and builds production.
- Tests cover interactions, camera movement/bounds, touch equivalents, motion preference, audio lifecycle, and graceful renderer failure.
- Preserve the cursor: mouse direction steers/glides without a held button, with a quiet centre; WASD/arrow glide and touch-drag look remain available. Never capture mouse implicitly.
- Reduced motion disables ambient animation, not just CSS. UI must be keyboard-operable and legible.
- Create no public deployments. The GitHub repository must be private.

## Shift-left verification

- Treat local verification as the primary feedback loop and a mandatory push gate. CI is an independent confirmation, not the first place to discover whether a change works.
- Start with the smallest relevant local test. For a new behavior or bug fix, observe it fail for the intended reason before implementing, then rerun until it passes.
- Before committing code, run `npm run check` locally (formatting, all unit tests, typecheck, and production build).
- Before pushing code, run the full `npm run test:e2e` suite locally against the final code. Exercise real WebGL and preserve desktop, touch, reduced-motion, and input-lifecycle coverage.
- Bring production/CI risks into local tests: cover slow rendering, delayed frames, and device-specific input explicitly. Prefer assertions on observed behavior/state over fixed sleeps or excessive frame-count waits; do not weaken acceptance criteria or lower rendering quality merely to get green tests.
- When CI finds a problem, inspect its logs, reproduce the failure locally, add or strengthen a regression test, and verify the fix locally before pushing again. Do not rely on repeated CI reruns as the debugging loop.
- Inspect desktop/mobile captures and browser console errors locally for visual or shader changes. Passing compilation alone does not prove correct rendering.
- Report exactly which checks ran and their outcomes. Never call unrun checks passed, and clearly distinguish locally verified results from pending CI.

## Integration boundary

`createWorld(renderer: THREE.WebGLRenderer, quality: 'low' | 'high')` in `src/world.ts` returns `{scene, camera, interactive, update, dispose}`. `interactive` entries: `{id, kind: 'lotus' | 'lantern', object: THREE.Object3D, position: THREE.Vector3, response: number}`. `update(elapsed, dt, reducedMotion)` animates entities and their response. App sets response via hover + proximity. Camera initially at `(0, 2.2, 12)` facing near `(0, 1.1, 0)`. World coordinates: x/z pond, y up. Navigable radius 27, pond radius >=34. No DOM or input handlers in world.ts. No touching other agents' owned files.
