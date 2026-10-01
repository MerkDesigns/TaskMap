export function blockTabKeyNavigation(event: KeyboardEvent): void {
  if (event.key !== "Tab") return;
  // Forms can opt into native traversal; the canvas keeps its existing shortcut behavior.
  if (
    event.target instanceof Element &&
    event.target.closest('[data-native-tab-navigation="true"]')
  )
    return;
  // Only cancel the browser's focus traversal: app shortcuts (panel toggles, canvas cycling) and
  // dialog focus traps still receive Tab.
  event.preventDefault();
}
