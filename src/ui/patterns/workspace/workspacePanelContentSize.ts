const WORKSPACE_PANEL_CONTENT_SIZE_EVENT = "taskmap:workspace-panel-content-size";

export function notifyWorkspacePanelContentSizeChanged(element: HTMLElement, height: number): void {
  element.dispatchEvent(
    new CustomEvent(WORKSPACE_PANEL_CONTENT_SIZE_EVENT, { bubbles: true, detail: height }),
  );
}

export function subscribeWorkspacePanelContentSizeChanged(
  element: HTMLElement,
  listener: (height: number) => void,
): () => void {
  const handle = (event: Event) => listener((event as CustomEvent<number>).detail);
  element.addEventListener(WORKSPACE_PANEL_CONTENT_SIZE_EVENT, handle);
  return () => element.removeEventListener(WORKSPACE_PANEL_CONTENT_SIZE_EVENT, handle);
}
