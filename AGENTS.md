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

## Integration boundary

`createWorld(renderer: THREE.WebGLRenderer, quality: 'low' | 'high')` in `src/world.ts` returns `{scene, camera, interactive, update, dispose}`. `interactive` entries: `{id, kind: 'lotus' | 'lantern', object: THREE.Object3D, position: THREE.Vector3, response: number}`. `update(elapsed, dt, reducedMotion)` animates entities and their response. App sets response via hover + proximity. Camera initially at `(0, 2.2, 12)` facing near `(0, 1.1, 0)`. World coordinates: x/z pond, y up. Navigable radius 27, pond radius >=34. No DOM or input handlers in world.ts. No touching other agents' owned files.
