import { createContext, useContext, type ReactNode } from "react";
import { getSharedMotionFrameScheduler, type MotionFrameScheduler } from "./motionFrameScheduler";

const MotionSchedulerContext = createContext<MotionFrameScheduler | null>(null);

export interface MotionProviderProps {
  readonly children: ReactNode;
  readonly scheduler?: MotionFrameScheduler;
}

export function MotionProvider({ children, scheduler }: MotionProviderProps) {
  return (
    <MotionSchedulerContext.Provider value={scheduler ?? getSharedMotionFrameScheduler()}>
      {children}
    </MotionSchedulerContext.Provider>
  );
}

export function useMotionFrameScheduler(): MotionFrameScheduler {
  return useContext(MotionSchedulerContext) ?? getSharedMotionFrameScheduler();
}
