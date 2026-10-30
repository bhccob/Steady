# Glow and Rounder Streak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the background glow drift and breathe, add a warm halo to tappable things on hover (web) and press (phone), and make the Home streak path's blocks rounded and a little bigger.

**Architecture:** Two small pure modules hold every number: `src/ui/ambient.ts` for the background motion and `src/ui/glow.ts` for the halo. Both are tested in Jest. `Background.tsx` animates four separate glow layers with core `Animated` on the native driver (transform and opacity only). A shared `GlowHalo` layer, plus a `GlowPressable` wrapper, gives every listed control the same halo. The streak blocks' sizes and corner radius move into `pathProjection.ts`, so drawing and hit-testing share them.

**Tech Stack:** Expo SDK 58, React Native 0.88 (core `Animated`, `Pressable` hover and focus events, `boxShadow`, `backgroundImage`), TypeScript strict, Jest (jest-expo).

**Spec:** `docs/superpowers/specs/2026-10-30-steady-web-app-design.md`, section 5 (The glow). The streak change is the owner's request of 30 October: "make the 3d streak rounded and slightly bigger view". It's read as rounded blocks (a full pill shape with the 3D edge kept), blocks about 13% bigger, and a taller streak area.

## Global Constraints

- Animate only `transform` and `opacity`. Never animate `boxShadow`, `elevation` or blur intensity. The halo is drawn once and only its opacity changes.
- Background motion: each layer's drift is at most 4% of the screen per axis, scale at most 1.08, opacity at most ±15%, and cycles between 20 and 40 seconds, each a different length. Use `Easing.inOut(Easing.sin)`. Nothing faster.
- Halo: fades in over 150 ms on hover or focus, over 100 ms on press-in, and out over 200 ms. Lift is a 1 px `translateY` on hover only, never while pressed and never under Reduce Motion.
- Under Reduce Motion (`useReducedMotion()`) the background is still and nothing lifts. The halo still shows and hides, because that explains a state change.
- The background is also still when `usePerf().glassMode === 'solid'`, the slow-device signal the app already uses.
- Use `useNativeDriver: Platform.OS !== 'web'` everywhere, so the web build (plan 2) runs the same code.
- Every `Pressable` and `GlowPressable` keeps an `accessibilityLabel`. The guard is `src/theme/a11y.test.ts`.
- Keep passing: `npm test` (564 tests before this plan), `npm run lint`, `npm run typecheck`.

## Review Focus

1. **A halo that is clipped or drawn over content.** `GlowPressable` children must render above the halo, and no listed control may have `overflow: 'hidden'` on the element that owns the halo. Covered by Task 3's visual check on the emulator.
2. **A stuck halo.** If a press is cancelled by scrolling (`onPressOut` without `onPress`), or the pointer leaves mid-press, the halo must fade out. Covered by Task 3's `glowTarget` tests: release without hover gives opacity 0.
3. **Streak taps landing on the wrong block** after the size change. Hit-testing must use the same sizes as drawing. Covered by Task 1's hitTest test with `blockSize`.
4. **Background edges showing while layers drift.** Each layer is oversized by at least its maximum drift. Covered by Task 2's `AMBIENT_LAYERS` test (`bleed >= dx` and `bleed >= dy`).
5. **Battery or jank on a slow Android.** The loops must stop when the screen unmounts, and must not run when glass is solid. Covered by Task 2's `ambientOn` test and the cleanup step.

---

### Task 1: Rounded, bigger streak blocks

**Files:**
- Modify: `src/home/pathProjection.ts` (the `PATH` constants, plus new `blockSize` and `blockRadius`)
- Modify: `src/home/StreakPath.tsx:18`, `:165`, `:207` (use the shared size and radius, drop the literals 60, 68, 16 and 20)
- Modify: `app/(tabs)/home.tsx:286` (`hero.height` 262 → 292)
- Test: `src/home/__tests__/pathProjection.test.ts`

**Interfaces:**
- Produces: `blockSize(kind: 'day' | 'trophy'): number` (68 or 76), `blockRadius(size: number): number` (half the drawn height, so each block is a full pill), and `PATH.side3d` = 9.

- [ ] **Step 1: Write the failing tests**

```ts
import { blockRadius, blockSize, hitTest, PATH, project, zigzag } from '../pathProjection';

describe('blocks', () => {
  it('draws day blocks at 68 and trophies at 76', () => {
    expect(blockSize('day')).toBe(68);
    expect(blockSize('trophy')).toBe(76);
  });

  it('rounds a block fully: its radius is half its drawn height', () => {
    const size = blockSize('day');
    expect(blockRadius(size)).toBeCloseTo((size * PATH.faceRatio + PATH.side3d) / 2);
  });

  it('counts a tap near the edge of the bigger block', () => {
    const p = project(0, zigzag(0), VIEW);
    const tap = { x: p.x + 36 * p.scale, y: p.y };
    expect(hitTest(tap, { position: 0, count: 1, sizeOf: () => blockSize('day'), view: VIEW })).toBe(0);
    expect(hitTest(tap, { position: 0, count: 1, sizeOf: () => 60, view: VIEW })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest src/home/__tests__/pathProjection.test.ts`
Expected: FAIL. `blockSize` and `blockRadius` aren't exported.

- [ ] **Step 3: Implement**

In `pathProjection.ts`:
- add `blockSize: 68` and `trophySize: 76` to `PATH`, and set `side3d: 9`;
- export `blockSize(kind)` and `blockRadius(size)` (`(size * PATH.faceRatio + PATH.side3d) / 2`).

In `StreakPath.tsx`:
- `sizeOf` and the `motionStyles` size both call `blockSize(e.kind)` / `blockSize(kind)`;
- the face `borderRadius` becomes `blockRadius(size)` for days and trophies.

In `home.tsx`, `hero.height` becomes 292.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/home/__tests__/pathProjection.test.ts`
Expected: PASS, including the existing projection tests.

- [ ] **Step 5: Commit**

```bash
git add src/home/pathProjection.ts src/home/StreakPath.tsx "app/(tabs)/home.tsx" src/home/__tests__/pathProjection.test.ts
git commit -m "Streak path: rounded, bigger blocks"
```

### Task 2: A living background glow

**Files:**
- Create: `src/ui/ambient.ts`
- Modify: `src/ui/Background.tsx`
- Test: `src/ui/__tests__/ambient.test.ts`

**Interfaces:**
- Consumes: `GlassMode` from `src/lib/perf.ts`, `useReducedMotion` from `src/lib/useReducedMotion.ts`, `theme.glows` (four colours), `theme.background`.
- Produces:
  - `AmbientLayer { at: string; periodMs: number; dx: number; dy: number; grow: number; breathe: number; bleed: number }`, where `at` is the radial-gradient position, `dx` and `dy` are shares of the screen, and `bleed` is how far the layer extends past each edge, as a share of the screen;
  - `AMBIENT_LAYERS: readonly AmbientLayer[]` (4 layers);
  - `ambientOn(reduced: boolean, glassMode: GlassMode): boolean`;
  - `ambientAt(layer: AmbientLayer, t: number, view: { width: number; height: number }): { translateX: number; translateY: number; scale: number; opacity: number }`, for `t` from 0 to 1.

- [ ] **Step 1: Write the failing tests**

```ts
import { AMBIENT_LAYERS, ambientAt, ambientOn } from '../ambient';

const VIEW = { width: 400, height: 800 };

describe('ambient glow', () => {
  it('has four layers on distinct 20-40 s cycles', () => {
    expect(AMBIENT_LAYERS).toHaveLength(4);
    const periods = AMBIENT_LAYERS.map((l) => l.periodMs);
    expect(new Set(periods).size).toBe(4);
    for (const p of periods) expect(p >= 20000 && p <= 40000).toBe(true);
  });

  it('stays within the calm limits and never shows an edge', () => {
    for (const l of AMBIENT_LAYERS) {
      expect(Math.abs(l.dx)).toBeLessThanOrEqual(0.04);
      expect(Math.abs(l.dy)).toBeLessThanOrEqual(0.04);
      expect(l.grow).toBeLessThanOrEqual(1.08);
      expect(l.breathe).toBeLessThanOrEqual(0.15);
      expect(l.bleed).toBeGreaterThanOrEqual(Math.max(Math.abs(l.dx), Math.abs(l.dy)));
    }
  });

  it('rests centred halfway through a cycle and reaches its extremes at the ends', () => {
    const l = AMBIENT_LAYERS[0]!;
    expect(ambientAt(l, 0.5, VIEW).translateX).toBeCloseTo(0);
    expect(ambientAt(l, 0, VIEW).translateX).toBeCloseTo(-l.dx * VIEW.width);
    expect(ambientAt(l, 1, VIEW).translateX).toBeCloseTo(l.dx * VIEW.width);
    expect(ambientAt(l, 1, VIEW).scale).toBeCloseTo(l.grow);
    expect(ambientAt(l, 0, VIEW).opacity).toBeCloseTo(1 - l.breathe);
    expect(ambientAt(l, 1, VIEW).opacity).toBeCloseTo(1);
  });

  it('only moves with full motion on a capable device', () => {
    expect(ambientOn(false, 'blur')).toBe(true);
    expect(ambientOn(true, 'blur')).toBe(false);
    expect(ambientOn(false, 'solid')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest src/ui/__tests__/ambient.test.ts`
Expected: FAIL. Cannot find module `../ambient`.

- [ ] **Step 3: Implement `ambient.ts`**

- The four `at` positions are today's `GLOW_AT` (0% 0%, 100% 35%, 10% 78%, 100% 100%).
- Periods are 23000, 29000, 31000 and 37000 ms. `bleed` is 0.06.
- `ambientAt` is linear in `t`:
  - translate is `d * size * (2t - 1)`;
  - scale is `1 + (grow - 1) * t`;
  - opacity is `1 - breathe * (1 - t)`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/ui/__tests__/ambient.test.ts`
Expected: PASS.

- [ ] **Step 5: Rebuild `Background.tsx` on the layers**

- The base view keeps today's `linear-gradient(135deg, a, b, c)` and `backgroundColor`.
- Above it go four absolutely positioned, `pointerEvents="none"` layers, each inset by `-bleed` of the screen. Each has a single `radial-gradient(circle at <at>, <glow i>, transparent 55%)`, plus `renderToHardwareTextureAndroid` and `shouldRasterizeIOS`.
- The children render last, in a `flex: 1` view.
- Each layer's `Animated.Value` loops 0→1→0. Each leg lasts `periodMs / 2`, using `Easing.inOut(Easing.sin)` and `useNativeDriver: Platform.OS !== 'web'`.
- Layer `i` starts at value `i / 4`, so they're out of step.
- Interpolate translate, scale and opacity between `ambientAt(l, 0, view)` and `ambientAt(l, 1, view)`, with `view` taken from `onLayout`.
- When `ambientOn` is false, render the layers with no transform and opacity 1 (today's look), and start no loop.
- Stop every loop in the effect's cleanup.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 7: Commit**

```bash
git add src/ui/ambient.ts src/ui/Background.tsx src/ui/__tests__/ambient.test.ts
git commit -m "Background glow drifts and breathes slowly"
```

### Task 3: The hover and press halo

**Files:**
- Create: `src/ui/glow.ts`, `src/ui/GlowHalo.tsx`, `src/ui/GlowPressable.tsx`
- Modify:
  - `src/theme/a11y.test.ts` (also scan `<GlowPressable`)
  - `src/ui/Button.tsx` (primary and secondary; `link` unchanged)
  - `src/home/PillCard.tsx:124` (round check)
  - `src/ui/CheckRow.tsx`
  - `src/home/MoodPrompt.tsx:95` (faces)
  - `src/ui/FloatingTabBar.tsx` (tabs, Reach out, emergency)
  - `src/home/StreakPath.tsx` (block halo)
- Test: `src/ui/__tests__/glow.test.ts`

**Interfaces:**
- Consumes: `Theme` from `src/theme/tokens.ts` (`accentLine`, `name`), `blockRadius` and `hitTest` from Task 1.
- Produces:
  - `GLOW = { hoverInMs: 150, pressInMs: 100, outMs: 200, lift: 1 }`;
  - `type GlowCause = 'hover' | 'press' | 'focus'`;
  - `glowTarget(active: ReadonlySet<GlowCause>, changed: GlowCause, reduced: boolean): { opacity: 0 | 1; durationMs: number; lift: number }`;
  - `haloShadow(theme: Theme): string`;
  - `GlowHalo({ on, radius, durationMs }: { on: boolean; radius: number; durationMs: number })`;
  - `GlowPressable(props: PressableProps & { radius: number })`.

- [ ] **Step 1: Write the failing tests**

```ts
import { themes } from '../../theme/tokens';
import { GLOW, glowTarget, haloShadow } from '../glow';

const on = (...c: ('hover' | 'press' | 'focus')[]) => new Set(c);

describe('glowTarget', () => {
  it('shows quickly on press, without lifting', () => {
    expect(glowTarget(on('press'), 'press', false)).toEqual({ opacity: 1, durationMs: GLOW.pressInMs, lift: 0 });
  });
  it('fades in and lifts a pixel on hover', () => {
    expect(glowTarget(on('hover'), 'hover', false)).toEqual({ opacity: 1, durationMs: GLOW.hoverInMs, lift: 1 });
  });
  it('never lifts under Reduce Motion', () => {
    expect(glowTarget(on('hover'), 'hover', true).lift).toBe(0);
  });
  it('stays lit, and lifts again, when a press ends under the pointer', () => {
    expect(glowTarget(on('hover'), 'press', false)).toEqual({ opacity: 1, durationMs: GLOW.outMs, lift: 1 });
  });
  it('fades out when nothing holds it, including a press cancelled by a scroll', () => {
    expect(glowTarget(on(), 'press', false)).toEqual({ opacity: 0, durationMs: GLOW.outMs, lift: 0 });
  });
  it('shows for keyboard focus, without lifting', () => {
    expect(glowTarget(on('focus'), 'focus', false)).toEqual({ opacity: 1, durationMs: GLOW.hoverInMs, lift: 0 });
  });
});

describe('haloShadow', () => {
  it('uses each theme accent line, softly', () => {
    expect(haloShadow(themes.light)).toBe('0px 0px 20px 4px rgba(154, 125, 82, 0.38)');
    expect(haloShadow(themes.dark)).toBe('0px 0px 20px 4px rgba(205, 179, 140, 0.38)');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx jest src/ui/__tests__/glow.test.ts`
Expected: FAIL. Cannot find module `../glow`.

- [ ] **Step 3: Implement `glow.ts`**

- `opacity` is 1 when `active` is not empty.
- `durationMs` is `pressInMs` when `changed === 'press'` and press is active. It's `hoverInMs` when the change switched hover or focus on. Otherwise it's `outMs`.
- `lift` is `GLOW.lift` only when hover is active, press is not, and `!reduced`.
- `haloShadow` converts `theme.accentLine` from hex to `rgba(…, 0.38)`.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/ui/__tests__/glow.test.ts`
Expected: PASS.

- [ ] **Step 5: Build `GlowHalo` and `GlowPressable`**

`GlowHalo` is an absolutely positioned (`inset 0`), `pointerEvents="none"` `Animated.View`:
- it uses `borderRadius = radius` and `boxShadow = haloShadow(theme)`;
- its opacity animates to `on ? 1 : 0` over `durationMs` on the native driver, whenever `on` changes;
- it's hidden from accessibility.

`GlowPressable` is a `Pressable` that:
- tracks its active causes from `onPressIn`/`onPressOut`, `onHoverIn`/`onHoverOut` and `onFocus`/`onBlur`, calling the caller's own handlers too;
- keeps `glowTarget(...)` in state, which changes per event, never per frame;
- renders `<GlowHalo>` as its first child;
- composes `style`: when it's a function, calls it with the Pressable state, then appends `{ transform: [{ translateY: -lift }] }` only when `lift > 0` and not pressed.

- [ ] **Step 6: Extend the accessibility guard**

In `a11y.test.ts`, `openingTags` scans `<GlowPressable` as well as `<Pressable`. (`<Pressable` is a prefix-safe search only if followed by a space or a newline: match `/<(Glow)?Pressable[\s>]/`.)

Run: `npx jest src/theme/a11y.test.ts`
Expected: PASS.

- [ ] **Step 7: Use it where the spec lists**

Swap `Pressable` for `GlowPressable` with these radii:

| Element | Radius |
|---|---|
| `Button` (primary and secondary) | `radius.pill` |
| PillCard round check | 25 |
| `CheckRow` | `radius.control` |
| Mood faces | 24 |
| Tab bar tabs | 999 |
| Reach out | 999 |
| Emergency button | 999 |

Keep every existing prop, style and label.

For the streak path, track `glowIndex: number | null` in state:
- set it in `onPanResponderGrant` from `hitTest` on the touch point;
- clear it when a drag starts and on release or terminate;
- on the container, `onPointerMove` sets it from `hitTest`, but only when the index changes;
- `onPointerLeave` clears it.

Each block's face renders `<GlowHalo on={glowIndex === i} radius={blockRadius(size)} durationMs={…} />` first, using `GLOW.pressInMs` when it turns on and `GLOW.outMs` when it turns off.

- [ ] **Step 8: Run the full suite, lint and typecheck**

Run: `npm test; npm run lint; npm run typecheck`
Expected: all pass, with no new lint warnings.

- [ ] **Step 9: Commit**

```bash
git add src/ui/glow.ts src/ui/GlowHalo.tsx src/ui/GlowPressable.tsx src/ui/__tests__/glow.test.ts src/theme/a11y.test.ts src/ui/Button.tsx src/home/PillCard.tsx src/ui/CheckRow.tsx src/home/MoodPrompt.tsx src/ui/FloatingTabBar.tsx src/home/StreakPath.tsx
git commit -m "A warm halo on hover and press"
```

### Task 4: See it on Android

**Files:** none changed.

The emulator (`Medium_Phone_API_37.0`) currently has the preview APK (versionCode 3). JS changes need the development build, with Metro.

- [ ] **Step 1: Install the development build on the emulator**

Uninstall `com.steadyreminder.app`, because the dev build's versionCode 1 can't install over 3. The emulator's data is test data. Download the dev build APK from EAS build `0c3bd803`, install it, then run `npx expo start --dev-client` and open it on the emulator.

- [ ] **Step 2: Check by eye, with screenshots**

Set up quickly with the accessibility-tree driver used before (`scratchpad/apk/ui.cjs`). Then confirm each of these:
- Home's streak blocks are pills, visibly bigger, and tapping a block opens that day.
- Two screenshots 10 s apart show the background glow has moved.
- Pressing and holding a button (`adb shell input swipe x y x y 800`) shows the halo, and releasing fades it.
- With Settings → Accessibility → Remove animations on, the background is still.

Expected: all of the above. If any fail, fix them before reporting done.

- [ ] **Step 3: Report**

Tell the owner what changed, with before and after screenshots. Phones only get this in the next preview build (plan 2's checks may come first). Ask whether to build preview 3 now.
