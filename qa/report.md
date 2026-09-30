# Stillwater — QA notes

## Scope

Full single-page pond experience: opening composition, enter flow, movement, drag look, hover/proximity, touch input, optional sound, motion preferences, guide, reset, resize, and graphics fallback. Tests use real Chromium WebGL with SwiftShader on this headless Linux host; touch is browser-emulated, not a physical phone.

## Resolved findings

- **Nearby objects out of range:** the opening composition now includes responsive foreground lotuses on desktop and portrait screens.
- **Incorrect opening camera aspect:** viewport aspect is set before the first frame, with a regression test.
- **Hard mist edges and flat petals:** feathered procedural mist and curved lotus petals replace the initial forms. Individual morph influences physically unfold interactive blooms.
- **Graphics loss recovery:** persistent recovery text and a keyboard-focusable reload action pause movement/audio and prevent restarting rendering into a lost context.
- **Mountain orientation and fog:** ridge faces are tangent to the pond and fog uniforms/declarations are complete. Unit and real-browser checks cover integration.
- **Low-frame-rate navigation:** bounded simulation substeps preserve glide speed without unsafe tab-return jumps.
- **Touch tap lost during a renderer stall:** a deterministic browser-clock regression reproduced taps expiring before the next frame. Tap lifetime now counts bounded rendered interaction time; the regression and full suite pass.
- **Browser timing and target coordinates:** tests hold movement until observed displacement instead of fixed short sleeps. Reset waits for a rendered camera projection. Interaction coordinates project the actual bloom/lantern body instead of the stem/root base.

## Final local verification

- `npm run check`: formatting, 27 unit tests, TypeScript checking, and production build passed.
- `npm run test:e2e`: all 13 browser tests passed in one complete run after the timing/coordinate corrections.
- Browser coverage includes keyboard and real emulated touch movement, lotus hover/tap, lantern red hover and return, mouse-responsive reflecting water, stars, airborne lanterns, drag look, reset, resize, focus loss, sound toggles, guide/Escape, reduced motion, unsupported graphics, and context loss.
- Final screenshot capture reported no browser console or page errors. Desktop: 480 stars, 371 reported draw calls, 344,162 triangles including the reflection pass. These are scene counts, not a physical-device performance benchmark.
- `npm audit --audit-level=moderate`: zero vulnerabilities.
- Staged security scan: no hardcoded secrets or unsafe execution patterns found.
- Independent review passed with no security concerns or logic errors. Its nonblocking suggestions noted the vendor chunk size and a navigation timing failure from a concurrent software-rendering run; the subsequent complete parent suite passed.

## Limitations

No physical-phone performance benchmark, Safari coverage, or public deployment. Water uses quality-scaled planar scene reflections with artistic ripple distortion, not a full fluid simulation. Vite reports a nonblocking advisory for the Three.js vendor chunk slightly exceeding 500 kB (approximately 128 kB gzip). GitHub CI and remote commit/privacy are verified separately after push.
