# TaskMap Glass System Contract

> Status: normative target contract for the final Phase 4.5 glass system.
>
> This document defines required behavior. It does **not** pre-approve a particular CSS/WebView2
> topology. The active rendering technique must prove that it satisfies this contract before broad
> production migration.

## 1. Authority and scope

This contract is the highest-authority document for TaskMap glass behavior.

It governs:

- Major and Minor Glass semantics;
- logical backdrop layers;
- scroll/list material behavior;
- glass-on-glass behavior;
- overscan;
- backdrop freshness;
- material-aware presence;
- glass geometry motion;
- glass performance acceptance;
- the development proof/workbench used to validate the system.

`UI-SYSTEM-CONTRACT.md` governs the general public UI architecture.
`UI-QUALITY-GUARDRAILS.md` governs reusable controls and visual consistency.

Historical visual documents, old compositor plans, old UI-Lab experiments, and superseded ADR
implementation details do not override this contract.

## 2. Contract vs implementation

The contract specifies the result TaskMap needs.

It intentionally does **not** assume that:

- CSS stacking contexts alone can provide logical backdrop isolation;
- native `backdrop-filter` will always invalidate correctly in WebView2;
- the current oversized-filter overscan implementation is correct;
- the current shared Small batch topology is final;
- the parked Canvas2D compositor must return.

Before committing to a final rendering topology, the implementation must pass the rendering proof in
section 20.

If a candidate WebView2/CSS technique cannot satisfy the proof without visual or performance
regression, change the rendering technique. Do not weaken the contract merely to preserve the
candidate.

## 3. Core principles

1. **One canonical recipe per material.**
   Major Glass and Minor Glass each have one fixed optical recipe.

2. **Presence is not a new recipe.**
   Animation may modulate the contribution of a fixed recipe without creating a separate
   "fading material".

3. **Logical backdrop depth is explicit.**
   Sampling must follow TaskMap's logical material layers, not accidental DOM/z-index order.

4. **Material, content and external effects are separate.**
   A material silhouette may change without scaling/distorting its HTML content or clipping its
   shadow with the same rectangle.

5. **Backdrop freshness is continuous.**
   Moving and animated content behind glass must update while it moves, not only on settlement.

6. **Movement does not change intrinsic optics.**
   Settled, dragged, batched and promoted forms of the same material have the same intrinsic
   response.

7. **Batching is an optimization.**
   It is valid only while it preserves the required visual ordering.

8. **Foreground interaction is isolated from parent optics.**
   A button hover/press must not accidentally perturb its parent glass.

9. **High-frequency interaction remains cheap.**
   Translation, scroll and drag must stay off document/history/persistence paths and avoid
   unnecessary layout/React/material work.

10. **Renderer workarounds are private.**
    Features never own backdrop refresh tricks, overscan math, batch internals or browser hacks.

## 4. "Same appearance" means same intrinsic material response

"Moving equals settled" does **not** mean identical pixels regardless of backdrop.

A promoted card should legitimately look different when it moves over text, a colored object or
another card, because its backdrop changed.

The invariant is:

```text
same canonical recipe
same presence state
same geometry/elevation state
same backdrop
= same optical response
```

Promotion itself must not introduce an additional brightness, blur, tint, rim, shadow or topology
jump.

## 5. Material recipe vs material presence

A canonical recipe contains fixed parameters such as:

- preblur;
- main blur;
- saturation;
- brightness;
- contrast;
- tint/body;
- highlight;
- rim;
- shadow/elevation;
- overscan/ambient sampling range;
- default radius behavior.

A material-presence state is a separate multiplier/curve used by animation.

Presence may modulate:

- effective blur contribution;
- tint/body contribution;
- highlight;
- rim intensity;
- shadow/elevation visibility.

This does not create a new recipe.

The following must not become separate material definitions:

- dragged Minor;
- settled Minor;
- batched Minor;
- standalone Minor;
- scrolling Minor;
- fading Minor;
- promoted Minor.

## 6. Material vocabulary

### Major Glass

Major Glass is the structural glass used for large chrome and overlay surfaces, including:

- Canvas Browser;
- toolbar/chrome islands;
- minimap;
- window/navigation surfaces;
- Settings;
- Quick Extensions;
- other major temporary panels.

### Minor Glass

Minor Glass is a smaller physical glass object placed on a Major context, including:

- Canvas Browser cards;
- settings islands/groups;
- compact glass objects;
- liquid selectors where appropriate.

A Minor object retains a physical identity through body/transmission, rounded silhouette, rim and
shadow/elevation.

### Minor shell

A Minor shell is the same visual language without an additional backdrop-blur pass.

It keeps:

- material body/tint/highlight;
- rim;
- shadow/elevation;
- rounded silhouette.

The normal policy is:

```text
Major
└─ first useful Minor depth: blur-capable
   └─ deeper Minor-on-Minor objects: shell
```

This is a default policy, not an irreversible limitation. A future concrete case may require another
real blur depth.

## 7. Logical glass layers

TaskMap logical material layers are not ordinary z-index groups. A logical layer defines what
completed visual result a glass surface is allowed to sample.

### Layer 0 — workspace scene

Contains the canvas scene:

- canvas/grid;
- images;
- GIF/video;
- text/content;
- containers and other canvas elements.

### Layer 1 — persistent main UI

Contains persistent main-screen glass:

- Canvas Browser;
- minimap;
- toolbar/chrome;
- window/navigation glass;
- other always-present main panels.

Layer-1 Major surfaces sample the completed Layer-0 workspace.

**Layer-1 sibling Major surfaces must not influence one another's glass.**

A toolbar next to Canvas Browser must not brighten or blur into Canvas Browser merely because of
native backdrop ordering.

### Layer 2 — temporary/overlay UI

Contains temporary UI intentionally above persistent chrome:

- Settings;
- Quick Extensions;
- temporary major menus/panels.

A Layer-2 Major may sample the completed result below it:

- workspace;
- Layer-1 Major surfaces;
- Layer-1 Minor surfaces;
- Layer-1 foreground content.

Additional layers are added only for real product cases.

## 8. Same-layer isolation is a required result, not an assumed CSS feature

Native CSS backdrop filtering samples painted backdrop content according to browser backdrop rules.
Assigning a logical layer name does not itself isolate samples.

Therefore:

> The final implementation must demonstrate same-layer Major isolation in WebView2 before that
> topology is accepted.

The proof must use at least two adjacent/overlapping persistent Major surfaces and show that changing
one cannot contaminate the other's material.

If ordinary native CSS topology cannot provide this, the implementation must introduce another
material-backend technique rather than abandoning isolation.

## 9. Nested glass ordering

When the logical layer model says an upper glass object sits above another completed object, the
upper object must see the completed lower result.

Dragged Canvas Browser example:

```text
workspace
→ Major panel material
→ Major panel content
→ settled Minor material
→ settled card content
→ promoted dragged Minor material
→ dragged card content
```

The dragged Minor must be able to blur the lower card's:

- fill;
- text;
- icons;
- preview/media;
- colors.

## 10. Shared Minor batching

Settled, non-overlapping Minor objects in the same logical context should share material work where
possible.

Batching must preserve:

- canonical Minor optics;
- each object's visible silhouette;
- radius;
- rim/shadow behavior;
- scroll-edge behavior.

When an object needs a new visual depth, promote that object rather than permanently assigning
independent filters to every list item.

## 11. Drag promotion

When a Minor object can overlap content it must blur, it leaves the settled shared batch and is
temporarily promoted.

Promotion changes ownership/depth only.

It must not itself change:

- recipe;
- radius;
- rim;
- shadow;
- overscan policy;
- material-presence state.

No material pop is allowed at promotion or demotion.

## 12. Scrollable glass lists

Scrollable lists use four independent concepts:

1. full/logical item geometry;
2. visible material geometry;
3. content mask/viewport;
4. external effect geometry.

Do not model all four with one `overflow: hidden` box.

### Settled edge morph

When a settled Minor item scrolls through the top or bottom boundary:

- visible material height shrinks from the clipped side;
- the configured radius remains visually constant while geometry permits;
- a very small/awkward remaining glass strip is acceptable initially;
- rim follows the visible material silhouette;
- shadow follows the visible material silhouette;
- content keeps its normal layout size;
- content is **clipped, never vertically scaled**;
- the content mask respects the visible rounded material shape, including corners.

The first version does not need an additional near-zero opacity treatment. That may be tuned later.

### Shadow behavior

Content clipping and shadow/effect clipping are independent.

The list must not simply guillotine the card shadow at the same boundary used to hide content.

## 13. Held-item exemption and auto-scroll

The scroll-edge morph applies to **settled** list items.

An actively held item is promoted out of that clipping/morph context.

While held:

- it restores toward full physical geometry;
- keeps full corners;
- keeps full rim/shadow;
- does not shrink because the pointer entered the auto-scroll zone;
- the list scrolls beneath it;
- settled cards continue their normal edge morphing.

The auto-scroll edge is an interaction trigger, not a material clipping boundary for the held object.

## 14. Pickup and drop geometry motion

When practical, use a dynamic liquid pickup/drop transition.

### Pickup

A partially shrunken settled card may:

```text
partial settled silhouette
→ short liquid expansion
→ full dragged silhouette
```

Other cards may move outward slightly to clarify the pickup.

Exact distance, duration and easing are tuning values.

### Drop

During drop:

- the card flies/snaps toward its destination;
- it may simultaneously morph toward the destination's settled visible size;
- a destination near the viewport edge may therefore end partially shrunken;
- ownership returns to the settled batch only when the visual handoff is coherent.

## 15. Geometry motion

Geometry animation is opt-in.

Use it for:

- Liquid Tabs/selection indicators;
- scroll-edge morphing;
- drag pickup/drop;
- explicit panel mode transitions;
- other intentional liquid transitions.

Do not automatically animate every ordinary layout change.

Preferred principles:

- persistent identity;
- one motion owner;
- known target geometry;
- shared scheduler;
- transform/size/radius interpolation;
- no material implementation swap during motion.

## 16. Composable presence and motion

Presence/motion is built from independent channels, such as:

- content Fade;
- Material Fade;
- Slide X/Y;
- Lift;
- Scale;
- Geometry Morph.

Components may combine channels or use one alone.

Examples:

```text
Fade
Fade + Slide
Fade + Lift
Fade + Scale
Fade + Slide + Scale
```

One controller/timeline may coordinate them, but each channel owns its own curve/value.

## 17. Material fade

Do not fade an entire glass subtree through ancestor `opacity`, `filter: opacity()` or a mask that
breaks native backdrop behavior.

Conceptually:

```text
Surface
├─ Material
│  ├─ blur presence
│  ├─ tint/highlight presence
│  ├─ rim presence
│  └─ shadow presence
└─ ordinary Content
   └─ opacity
```

Blur timing does not need to mathematically equal content-opacity timing.

The development workbench must allow blur delay/curve to be tuned independently because perceptual
synchronization may differ from numeric synchronization.

No fade may depend on a visible strategy/topology swap.

## 18. Intentional motion-policy supersession

The final system intentionally supersedes older UI rules that hard-coded specific components to
slide-only or opacity-only presence.

The new rule is:

> Motion channels are composable. Each component chooses the channels its design requires.

Existing side-panel/minimap/modal motion remains useful reference behavior, but it is not a higher
authority than this contract.

## 19. Reduced-motion policy

Product decision for the final TaskMap UI:

> Do not maintain a separate reduced-motion material or motion behavior mode.

Existing `prefers-reduced-motion` immediate-settle behavior is legacy behavior and is intentionally
superseded for the final motion system.

This is a deliberate policy change, not an accidental omission. If the product decision changes
later, it must be reintroduced explicitly at the UI-system level rather than through scattered
component branches.

## 20. Rendering proof gate

Before implementing the complete final glass system, build one development proof scene using the
same material backend intended for production.

The proof scene must contain:

- workspace/grid backdrop;
- a bright moving red object;
- animated GIF or equivalent changing media;
- persistent Major A;
- persistent Major B on the same logical layer;
- a higher-layer overlay Major;
- at least two Minor cards;
- one Minor promoted/overlapping another.

Prove all of these before broad implementation:

1. same-layer Major A/B do not contaminate each other;
2. higher overlay Major samples the completed lower UI when intended;
3. promoted Minor can blur lower Minor/content correctly;
4. moving red content updates continuously under glass;
5. moving red content leaves no stale blur after moving away;
6. pointer release causes no visual correction;
7. animated media remains live through stationary glass;
8. overscan retains the intended ambient appearance without violating logical sampling boundaries.

If the candidate topology fails, stop and revise the material backend before implementing scroll
morphing, final presence, or large production migration.

## 21. Overscan and ambient response

Overscan/expanded ambient sampling is a required part of the intended appearance.

The current approximate visual range is an acceptable starting point.

Do not reduce overscan merely to hide invalidation/sampling bugs.

The implementation must separate:

- desired optical ambient response;
- logical backdrop source;
- browser-specific mechanism used to obtain it.

Overscan must not cause:

- stale/frozen backdrop pixels;
- same-layer Major contamination;
- mouse-up-only correction;
- unbounded distant sampling;
- unrelated UI interaction artifacts.

The current oversized filter-element implementation is not itself normative.

## 22. Backdrop freshness

Moving or animated scene content must remain live behind glass.

For a moving object:

```text
outside
→ under/near glass
→ across glass
→ away
→ far away
```

the blurred contribution must continuously follow it and disappear while the pointer is still held.

Mouse-up must not visibly fix the material.

This applies to images, GIF/video, colored elements, text, containers and other allowed lower-layer
content.

## 23. Geometry invalidation vs backdrop damage

These are separate concepts.

### Geometry invalidation

Examples:

- size;
- radius;
- DPR;
- clip topology;
- real layout change;
- recipe/tuning change.

It may update material silhouette, cached dimensions, sampling bounds and rim cache.

### Backdrop damage

Examples:

- object moved underneath;
- animation frame changed;
- camera exposed different pixels;
- lower-layer foreground state legitimately changed.

Backdrop damage should not require:

- geometry measurement;
- rim redraw;
- React render;
- history/persistence/database work.

If WebView2 requires explicit refresh behavior, there must be exactly one material-backend-owned
mechanism.

## 24. Foreground interaction isolation

Controls inside glass are foreground content.

Hover/press/focus/selection/toggle states may alter the control itself.

They must not accidentally change the parent material's:

- blur;
- tint;
- brightness;
- saturation;
- contrast;
- sampling bounds;
- overscan;
- compositor topology.

A legitimately higher glass surface may of course blur the changed control because it is real lower
content.

## 25. Rim and shadow

Rim and shadow are part of the physical-object illusion.

### Rim

- follows visible material silhouette;
- communicates polished glass rather than a generic uniform border;
- translation alone does not redraw it;
- is cached by geometry/DPR/recipe identity where practical.

### Shadow

- belongs outside the material body;
- follows scroll-edge shrink;
- remains full while held;
- follows geometry morph;
- may be modulated by Material Fade;
- is not clipped by the ordinary content mask.

## 26. Development workbench

UI Lab is no longer a separate development application architecture.

The target development composition is:

```text
DatabaseApplication / one active session
├─ App view
└─ UI Lab view
```

A development-only switch changes views without creating a second database/session/workspace owner.

Both views share:

- active database session;
- normalized workspace;
- media resources;
- device resources;
- material implementation;
- motion system;
- theme/tokens;
- development material tuning state.

The workbench must use the new database system. Switching App/Lab must not reopen the database,
recreate the session, or create a parallel persistence owner.

### Development tuning

UI Lab may expose development-only tuning for:

- Major/Minor optics;
- rim/shadow;
- overscan;
- presence curves;
- blur delay;
- pickup/drop timing;
- geometry easing.

These overrides are development state, not TaskMap document data.

The old rule that removed the **production** frosted-glass tuner does not prohibit this development
workbench tuner.

## 27. Diagnostics

Development diagnostics should make the material system inspectable.

Useful counters/overlays include:

- logical layer/context;
- visible material bounds;
- full logical geometry;
- content mask;
- shadow/effect bounds;
- overscan/sampling bounds;
- native filter-layer count;
- shared batch count;
- promoted surface count;
- shell count;
- geometry reads/frame;
- rim redraws/frame;
- backdrop refresh/damage work;
- scheduler subscriber count;
- frame time.

Diagnostics must not alter production behavior.

## 28. Performance objective

TaskMap should pursue maximum practical interaction throughput and low frame-time variance.

The design target includes very-high-refresh displays; 360 Hz corresponds to about 2.78 ms/frame.
This is an optimization objective, not a blanket promise that every scene will sustain 360 FPS.

"60 FPS is good enough" is not the design philosophy.

### Hot-path invariants

Pure translation should avoid:

- App-level React render;
- document mutation;
- history;
- persistence/database work;
- JSON serialization;
- geometry remeasurement;
- rim redraw;
- material reconstruction.

Scroll should project cached geometry when possible rather than remeasure every item.

Drag may temporarily add the minimum material depth required for correct overlap.

## 29. Measurable performance acceptance

Final performance acceptance must record a reproducible environment and workload.

Every accepted run records:

- commit;
- stable/development/release mode;
- CPU/GPU;
- display resolution and refresh rate;
- DPR/scaling;
- WebView2/browser version;
- viewport;
- database/fixture identity;
- visible element/media count;
- glass surface/batch/filter counts.

Measure at least:

- median frame time;
- p95 frame time;
- p99 frame time;
- long/dropped frame count;
- material geometry reads;
- rim redraws;
- React render activity where relevant.

Acceptance compares the final path against a recorded pre-change baseline on the same environment and
scene. The final glass architecture must not produce a meaningful regression in interaction
frame-time distribution.

The proof/benchmark must also verify the hot-path invariants independently of FPS.

## 30. UI Lab acceptance fixtures

The workbench must eventually include controlled fixtures for:

- Major over dark/grid backdrop;
- bright colors/images under Major;
- live GIF under Major;
- two same-layer persistent Majors;
- higher overlay Major;
- Minor cards on Major;
- promoted Minor-over-Minor;
- scroll-edge shrink;
- partial-item pickup;
- drop into clipped destination;
- Fade;
- Fade + Slide;
- Fade + Lift/Scale;
- foreground button interaction;
- stale-red moving-object test.

## 31. Hard visual acceptance

The system is not accepted until all applicable cases pass:

### Same-layer isolation

Persistent Major siblings do not affect one another.

### Overlay sampling

Higher-layer Major correctly samples intended lower UI.

### Glass-on-glass

Promoted Minor correctly blurs lower card/content.

### Scroll-edge material morph

Material shrinks with rounded shape; content clips with rounded mask; shadow/rim remain coherent.

### Auto-scroll drag

Held card remains full while list auto-scrolls beneath it.

### Partial-item pickup

Partially shrunken card expands smoothly to held geometry.

### Drop near edge

Held card flies/morphs to its partially clipped settled destination without material pop.

### Presence

Content and material presence transition coherently with independently tunable blur timing.

### Composed motion

Motion channels compose without competing ownership/schedulers.

### Moving backdrop

Bright moving object follows continuously and leaves no stale blur.

### Animated backdrop

GIF/video remains live through stationary glass.

### Foreground control isolation

Button interaction does not perturb parent glass.

### Deterministic round trip

After repeated interaction, returning to identical state produces the same material result.

### Resource stability

No accumulating observers, schedulers, filter layers, promoted surfaces or stale temporary owners.

## 32. Tuning values deliberately left open

These are visual tuning decisions, not architectural decisions:

- pickup duration/easing;
- drop duration/easing;
- amount neighboring cards move on pickup;
- blur fade delay;
- fade curves;
- rim exposure;
- shadow strengths;
- exact overscan implementation;
- optional later fade for tiny scroll remnants.

They are tuned after the rendering proof and core topology are correct.

## 33. Migration constraints

During implementation:

- do not broadly refactor `App.tsx` as part of glass work;
- do not move document ownership merely to simplify materials;
- do not alter canonical optics to hide correctness bugs;
- do not reduce overscan merely to hide stale-backdrop symptoms;
- do not permanently give every settled Minor its own filter;
- do not reactivate the parked cached compositor without an explicit decision;
- do not add feature-local repaint hacks;
- do not delete rollback/reference code until the final path passes proof and acceptance.

## 34. Completion definition

The final glass system is structurally complete when:

1. the rendering proof passes;
2. logical Major isolation and overlay sampling are implemented;
3. Minor batching/promotion works;
4. scroll material/content/effect separation works;
5. pickup/drop geometry motion works;
6. composable presence works;
7. overscan keeps its intended look without stale backdrop;
8. moving/animated backdrops stay live;
9. foreground interactions do not perturb parent glass;
10. development App/UI-Lab switching uses one database/session runtime;
11. performance acceptance shows no meaningful regression and hot-path invariants hold;
12. obsolete competing glass paths can be removed.

After this point, visual work should mostly tune canonical material/motion constants rather than
redesigning the renderer again.
