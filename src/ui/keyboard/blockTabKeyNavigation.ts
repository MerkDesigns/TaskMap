export function blockTabKeyNavigation(event: KeyboardEvent): void {
  if (event.key !== "Tab") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
