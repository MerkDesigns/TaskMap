import { createContext, useContext, type PropsWithChildren } from "react";
import type { MaterialPlane } from "./materialTypes";

const MaterialPlaneContext = createContext<MaterialPlane>("base");

export interface MaterialPlaneProviderProps extends PropsWithChildren {
  readonly plane: MaterialPlane;
}

export function MaterialPlaneProvider({ children, plane }: MaterialPlaneProviderProps) {
  return <MaterialPlaneContext.Provider value={plane}>{children}</MaterialPlaneContext.Provider>;
}

export function useMaterialPlane(override?: MaterialPlane): MaterialPlane {
  const inherited = useContext(MaterialPlaneContext);
  return override ?? inherited;
}
