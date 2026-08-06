type WindowCloseGuard = () => Promise<void>;

let activeGuard: WindowCloseGuard | null = null;

export function registerWindowCloseGuard(guard: WindowCloseGuard): () => void {
  activeGuard = guard;
  return () => {
    if (activeGuard === guard) activeGuard = null;
  };
}

export async function runWindowCloseGuard(): Promise<void> {
  await activeGuard?.();
}
