export function createAcrylicModuleWorker(): Worker {
  return new Worker(new URL("./acrylicCache.worker.ts", import.meta.url), {
    type: "module",
    name: "taskmap-acrylic-cache",
  });
}
