# TaskMap UI Quality Guardrails

> Status: normative UI quality rules.
>
> These rules prevent avoidable visual and interaction inconsistencies from becoming feature-local
> exceptions.

## 1. Principle

If a visual/interaction rule belongs to a reusable category, fix it at the reusable owner.

Examples:

- one icon button still has an old rim;
- one overflow button has a tiny hitbox;
- one dialog has different shell spacing;
- one scroll panel exposes an ugly native scrollbar.

These are system bugs, not acceptable one-off polish debt.

## 2. Explicit surface roles

Every visible panel/window/popover uses an intentional role:

- Major Glass;
- Minor Glass;
- Minor Shell;
- Opaque;
- Cutout;
- transparent/layout-only.

Do not create feature-local pseudo-materials.

The Create Canvas dialog is a **Major Glass overlay** and should use the shared dialog/overlay
structure.

## 3. Shared dialog structure

Standard dialogs use a common composition:

```text
DialogSurface
├─ Header
│  ├─ optional leading icon
│  ├─ title
│  └─ close action
├─ Body
└─ Actions/Footer
```

Required invariants:

- header/body/footer align to one spacing grid;
- close action aligns consistently;
- form controls align to the content grid;
- action rows follow one reusable alignment pattern;
- feature code supplies content, not a bespoke dialog shell.

## 4. Scrollbar policy

A glass panel must not accidentally expose an OS/native scrollbar that:

- visibly contaminates the glass;
- creates an unexplained permanent gutter;
- changes content width when it appears/disappears in an ugly way.

A scrollable area must intentionally choose a strategy such as:

- hidden native scrollbar;
- custom overlay scrollbar;
- explicit persistent gutter when deliberately designed.

For Settings-style glass panels, default toward hidden-native or custom-overlay behavior so content
uses the full available width.

Scrollbar presentation, content viewport and material geometry are separate concerns.

## 5. Primitive ownership

Common controls come from reusable primitives.

This includes at minimum:

- buttons;
- icon buttons;
- toggle buttons;
- switches;
- tabs;
- text/search fields;
- checkbox/radio controls;
- card overflow/action buttons.

If the app has a primitive for the role, feature code must not reproduce it with local styles.

## 6. Local override rule

Feature CSS must not silently change primitive identity.

Forbidden examples:

- restoring a rim removed from the canonical IconButton;
- changing hit-target dimensions for one card overflow action;
- adding a local shadow/border to one instance of a shared button;
- recreating hover/pressed states independently.

If one instance differs unexpectedly, investigate:

1. whether it bypasses the primitive;
2. whether feature CSS leaks into it;
3. whether the primitive lacks a required variant.

Fix the owner rather than patching the instance.

## 7. Variant rule

When a visual distinction is legitimate, express it as an explicit reusable variant/state.

Prefer:

```text
IconButton variant="ghost"
IconButton variant="danger"
```

over feature-specific descendant selectors that mutate the button.

A variant must still obey shared geometry, hit-target and accessibility rules.

## 8. Interactive target sizes

Small icons are allowed.
Small hitboxes are not.

Default TaskMap rule:

- icon-only actions: at least **32 × 32 px** interactive target;
- absolute constrained floor: **28 × 28 px** only where the composition genuinely cannot fit 32 px.

The glyph can remain visually small inside the larger target.

The Canvas Browser 3-dot action must use a shared action/IconButton target and must not require pixel
hunting.

## 9. Hitbox diagnostics

UI Lab/dev diagnostics should be able to display interactive bounds.

This makes it possible to catch:

- tiny overflow targets;
- overlapping hitboxes;
- dead gaps;
- click targets that do not match visible controls.

## 10. Button rim rule

A rim/border is part of a button primitive/variant, never an accidental leftover.

If a class of chrome IconButtons is rimless, all instances of that class are rimless.

Removing a rim should require changing the shared primitive/variant once, not auditing every feature
for copied CSS.

## 11. Layout consistency

Reusable shells own reusable geometry.

Do not let every dialog/panel independently define:

- header spacing;
- title alignment;
- close-button placement;
- footer spacing;
- common control row heights.

Feature code can define feature layout inside the shared shell.

## 12. Content overflow and rounded masks

Content must not visibly escape a rounded UI shape.

Where content can approach a rounded edge:

- clip/mask the content to the intended rounded visible shape;
- do not use that content mask to accidentally clip external material shadows;
- do not distort content merely to fit a changing material silhouette.

## 13. Glass interaction isolation

Button hover/press/focus must not accidentally perturb the parent glass material.

A control may intentionally change itself.

If an upper glass surface legitimately samples that control, the changed control can naturally
affect the upper glass.

See `GLASS-SYSTEM-CONTRACT.md`.

## 14. No one-off scrollbar fixes

Do not solve scrollbar problems with feature-local right padding, arbitrary width subtraction or
magic gaps.

Fix/use the shared ScrollArea/pattern.

When a scrollbar is overlaid/hidden, content should reclaim the space unless the design explicitly
requires a persistent gutter.

## 15. No one-off dialog material

Dialogs/overlays choose from the registered surface roles.

A feature may not use a frozen compatibility material merely because it historically did.

If a retained dialog is intentionally redesigned to Major Glass, migrate it to Major Glass and
delete the compatibility exception when no longer needed.

## 16. Review checklist

Before accepting new UI:

### Surface

- correct role?
- correct logical glass layer?
- shared shell where applicable?

### Layout

- shared spacing/grid?
- title/close/actions aligned?
- no unexplained gaps?

### Scroll

- intentional scrollbar strategy?
- content fills available width?
- no material bleed/gutter artifact?

### Controls

- shared primitives?
- correct variants?
- no local rim/border/shadow fork?

### Hit targets

- comfortably clickable?
- 32 px baseline for icon-only actions?
- visible dev hitbox matches intended control?

### Interaction

- consistent hover/press/focus?
- parent material unaffected unintentionally?

Any failed item is a UI defect, not optional polish.

## 17. Definition of done

A UI feature is complete only when:

1. surface role is correct;
2. shared shell/pattern is used where applicable;
3. scroll treatment is intentional;
4. primitives are reused;
5. stale visual variants are removed;
6. hit targets are usable;
7. applicable material rules pass;
8. the real App view receives a manual consistency pass.
