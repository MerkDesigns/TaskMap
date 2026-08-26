---

name: tauri-ui-development

description: Use for any TaskMap UI implementation, debugging, visual refactor, styling, animation, interaction, or layout work. Inspect and verify the actual running Tauri application through the Tauri MCP instead of judging results only from source code.

---



\# TaskMap Tauri UI Development



The running Tauri application is the source of truth for visible UI behavior.



\## Required workflow



For any task that changes visible UI:



1\. Start or connect to TaskMap using the MCP-enabled development build.

2\. Use the Tauri MCP to inspect the actual running application.

3\. Capture the relevant existing UI before making changes.

4\. Inspect the relevant DOM and computed styles when useful.

5\. Understand the current implementation before modifying shared UI primitives.

6\. Make the smallest change necessary.

7\. Reinspect the running application after the change.

8\. Exercise the affected interaction or state.

9\. Inspect the resulting UI visually.

10\. Check frontend console errors and warnings.

11\. Do not claim the task is complete unless the resulting application was actually inspected.



Compilation or passing tests alone are not visual verification.



\## Visual parity



When a task is intended to preserve existing appearance:



\- Treat the current running application as the visual baseline.

\- Do not redesign or "improve" unrelated styling.

\- Preserve spacing, geometry, colors, opacity, blur, borders, shadows and layering unless explicitly requested.

\- Compare the same component and state before and after the change.

\- Keep window dimensions consistent when comparing screenshots.



If an architectural or refactoring change causes unintended visual differences, fix the regression before considering the task complete.



\## Shared visual systems



Be especially careful when changing:



\- glass or acrylic primitives

\- backdrop-filter

\- opacity

\- CSS filters

\- pseudo-elements

\- masks

\- borders and rim lighting

\- shadows

\- transforms

\- animation wrappers

\- shared layout primitives

\- design tokens

\- stacking contexts

\- compositing layers



Before changing a shared primitive:



1\. Identify its consumers.

2\. Inspect representative consumers in the running application.

3\. Record their current visual state.

4\. Prefer changing the primitive rather than duplicating implementations only when visual parity can be preserved.



After changing it:



1\. Inspect representative consumers again.

2\. Test relevant state transitions.

3\. Look specifically for flicker, flashing, lost blur, opacity changes, stacking changes and layout shifts.



\## Glass-specific rules



TaskMap uses layered acrylic/glass effects.



Never move backdrop-filter, opacity, masks, gradients, pseudo-elements or transforms between DOM layers merely to solve an animation problem without checking the resulting appearance in the actual application.



For glass changes:



1\. Inspect which DOM element owns each visual layer.

2\. Inspect computed styles.

3\. Capture the baseline.

4\. Apply the change.

5\. Test idle and changing states.

6\. Look for:

&nbsp;  - flashing during rerenders

&nbsp;  - temporary loss of blur

&nbsp;  - changed tint

&nbsp;  - changed border brightness

&nbsp;  - changed gradient/rim lighting

&nbsp;  - changed transparency

&nbsp;  - changed stacking/compositing

7\. Compare against the baseline.



Visual parity takes priority over architectural elegance unless the user explicitly requests a visual change.



\## Interactions



When modifying UI with states such as:



\- hover

\- selected

\- expanded

\- collapsed

\- editing

\- dragging

\- opening/closing

\- navigation

\- animation

\- modal states



do not inspect only the idle state.



Actually trigger the relevant state using the Tauri MCP and verify the result.



\## Scope control



Do not make unrelated cleanup changes while performing visual work.



Do not replace existing architecture merely because another implementation seems cleaner.



Prefer localized, reversible changes.



For architectural refactors, preserve existing application behavior and visual output unless explicitly instructed otherwise.



\## Existing unrelated failures



Do not modify unrelated failing tests or unrelated worktree changes merely to obtain a clean test run.



Report them separately.



\## Completion report



For UI work, explicitly report:



\- what changed

\- what was inspected in the running Tauri application

\- which states/interactions were tested

\- whether screenshots were inspected

\- whether console errors occurred

\- anything that could not be visually verified



Never state that visual verification occurred if the Tauri MCP was unavailable or the actual running application was not inspected.

