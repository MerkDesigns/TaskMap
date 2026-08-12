import React from "react";
import ReactDOM from "react-dom/client";
import "@mantine/core/styles.css";
import AppShell from "./app/AppShell";
import { TaskMapMantineProvider } from "./ui/mantine/TaskMapMantineProvider";
import "./index.css";

const DevelopmentRendererBenchmark =
  import.meta.env.DEV && import.meta.env.VITE_TASKMAP_RENDERER_BENCHMARK === "1"
    ? React.lazy(async () => {
        const module = await import("./ui/dev/renderer-benchmark/RendererV2PerformanceBenchmark");
        return { default: module.RendererV2PerformanceBenchmark };
      })
    : null;

const DevelopmentLiquidDomFixture =
  import.meta.env.DEV && import.meta.env.VITE_TASKMAP_LIQUID_DOM_FIXTURE === "1"
    ? React.lazy(async () => {
        const module = await import("./ui/dev/LiquidDomVerificationFixture");
        return { default: module.LiquidDomVerificationFixture };
      })
    : null;

const DevelopmentMantineFixture =
  import.meta.env.DEV && import.meta.env.VITE_TASKMAP_MANTINE_FIXTURE === "1"
    ? React.lazy(async () => {
        const module = await import("./ui/dev/MantineVerificationFixture");
        return { default: module.MantineVerificationFixture };
      })
    : null;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TaskMapMantineProvider>
      {DevelopmentRendererBenchmark ? (
        <React.Suspense fallback={null}>
          <DevelopmentRendererBenchmark />
        </React.Suspense>
      ) : DevelopmentLiquidDomFixture ? (
        <React.Suspense fallback={null}>
          <DevelopmentLiquidDomFixture />
        </React.Suspense>
      ) : DevelopmentMantineFixture ? (
        <React.Suspense fallback={null}>
          <DevelopmentMantineFixture />
        </React.Suspense>
      ) : (
        <AppShell />
      )}
    </TaskMapMantineProvider>
  </React.StrictMode>,
);
