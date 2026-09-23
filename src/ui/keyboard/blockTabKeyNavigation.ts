export function blockTabKeyNavigation(event: KeyboardEvent): void {
  if (event.key !== "Tab") return;
  // Forms can opt into native traversal; the canvas keeps its existing shortcut behavior.
  if (
    event.target instanceof Element &&
    event.target.closest('[data-native-tab-navigation="true"]')
  )
    return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
