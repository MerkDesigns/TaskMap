export function blockTabKeyNavigation(event: KeyboardEvent): void {
  if (event.key !== "Tab") return;
  event.preventDefault();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
