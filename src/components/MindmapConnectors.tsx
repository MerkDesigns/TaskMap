import type { PointerEvent } from "react";
import type { MindmapPort } from "../types";

type MindmapConnectorsProps = {
  ownerId: string;
  accent: string;
  connectionMode: boolean;
  activeSourcePort?: MindmapPort;
  activeTargetPort?: MindmapPort;
  onStartConnection: (
    event: PointerEvent<HTMLButtonElement>,
    ownerId: string,
    port: MindmapPort,
  ) => void;
};

const PORTS: MindmapPort[] = ["left", "right", "top", "bottom"];

const portClass: Record<MindmapPort, string> = {
  left: "-left-[7px] top-1/2 -translate-y-1/2",
  right: "-right-[7px] top-1/2 -translate-y-1/2",
  top: "left-1/2 -top-[7px] -translate-x-1/2",
  bottom: "left-1/2 -bottom-[7px] -translate-x-1/2",
};

export function MindmapConnectors({
  ownerId,
  accent,
  connectionMode,
  activeSourcePort,
  activeTargetPort,
  onStartConnection,
}: MindmapConnectorsProps) {
  return PORTS.map((port) => {
    const active = port === activeSourcePort || port === activeTargetPort;
    return (
      <button
        key={port}
        type="button"
        data-connection-port={port}
        data-connection-port-owner={ownerId}
        className={`absolute z-30 h-[14px] w-[14px] rounded-full border-2 bg-[#111318] transition-[opacity,transform,box-shadow,background-color] ${portClass[port]} ${
          connectionMode
            ? active
              ? "pointer-events-auto scale-125 bg-white/20 opacity-100 shadow-[0_0_12px_rgba(255,255,255,0.55)]"
              : "pointer-events-auto scale-100 opacity-100 hover:scale-125 hover:bg-white/20 hover:shadow-[0_0_12px_rgba(255,255,255,0.45)]"
            : "pointer-events-none scale-75 opacity-0"
        }`}
        style={{ borderColor: accent }}
        onPointerDown={(event) => onStartConnection(event, ownerId, port)}
        aria-label={`${port} connection point`}
      />
    );
  });
}
