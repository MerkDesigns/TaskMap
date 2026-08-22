import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FrostedGlassTuner,
  type GlassMaterialValues,
  type PreviewTuningValues,
  type WorkspaceGeometryValues,
} from "./FrostedGlassTuner";

afterEach(cleanup);

const materialValues: GlassMaterialValues = {
  large: { tintColor: "#babec4", tintOpacity: 0.075, blur: 60, borderBrightness: 0.98 },
  small: { tintColor: "#b6b7c3", tintOpacity: 0, blur: 23.5, borderBrightness: 1.15 },
};
const geometryValues: WorkspaceGeometryValues = {
  canvasBrowserRadius: 19,
  canvasCardRadius: 13,
  topBarRadius: 17,
  sideInset: 16,
  topInset: 16,
  panelGap: 8,
};
const previewValues: PreviewTuningValues = {
  tintColor: "#000000",
  tintOpacity: 0,
  borderThickness: 1,
  borderOpacity: 0.2,
  borderColor: "#808080",
  gap: 9,
};

describe("FrostedGlassTuner material controls", () => {
  it("keeps Large and Small material optics independent", () => {
    const onMaterialChange = vi.fn();
    renderTuner(onMaterialChange, vi.fn());

    expect(screen.getByRole("button", { name: "Large" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Small" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gaps" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("large tint color"), {
      target: { value: "#123456" },
    });
    expect(onMaterialChange).toHaveBeenLastCalledWith({
      ...materialValues,
      large: { ...materialValues.large, tintColor: "#123456" },
    });
    fireEvent.change(screen.getByRole("slider", { name: /Blur/ }), {
      target: { value: "44" },
    });
    expect(onMaterialChange).toHaveBeenLastCalledWith({
      ...materialValues,
      large: { ...materialValues.large, blur: 44 },
    });

    fireEvent.click(screen.getByRole("button", { name: "Small" }));
    fireEvent.change(screen.getByRole("slider", { name: /Tint opacity/ }), {
      target: { value: "0.08" },
    });
    expect(onMaterialChange).toHaveBeenLastCalledWith({
      ...materialValues,
      small: { ...materialValues.small, tintOpacity: 0.08 },
    });
    fireEvent.change(screen.getByRole("slider", { name: /Border brightness/ }), {
      target: { value: "1.25" },
    });
    expect(onMaterialChange).toHaveBeenLastCalledWith({
      ...materialValues,
      small: { ...materialValues.small, borderBrightness: 1.25 },
    });
  });

  it("keeps Large geometry on Large and card radius on Small", () => {
    const onGeometryChange = vi.fn();
    renderTuner(vi.fn(), onGeometryChange);

    expect(screen.getByRole("slider", { name: /Canvas Browser radius/ })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /Canvas card radius/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Small" }));
    fireEvent.change(screen.getByRole("slider", { name: /Canvas card radius/ }), {
      target: { value: "16" },
    });
    expect(onGeometryChange).toHaveBeenLastCalledWith({ ...geometryValues, canvasCardRadius: 16 });
  });

  it("edits preview appearance and its equal edge gap", () => {
    const onPreviewChange = vi.fn();
    renderTuner(vi.fn(), vi.fn(), onPreviewChange);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.change(screen.getByLabelText("preview border color"), {
      target: { value: "#123456" },
    });
    expect(onPreviewChange).toHaveBeenLastCalledWith({
      ...previewValues,
      borderColor: "#123456",
    });
    fireEvent.change(screen.getByRole("slider", { name: /Preview gap/ }), {
      target: { value: "12" },
    });
    expect(onPreviewChange).toHaveBeenLastCalledWith({ ...previewValues, gap: 12 });
  });

  it("keeps window and side-panel gaps in the Gaps tab", () => {
    const onGeometryChange = vi.fn();
    renderTuner(vi.fn(), onGeometryChange);

    expect(screen.queryByRole("slider", { name: /Side edge gap/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gaps" }));
    fireEvent.change(screen.getByRole("slider", { name: /Side edge gap/ }), {
      target: { value: "24" },
    });
    expect(onGeometryChange).toHaveBeenLastCalledWith({ ...geometryValues, sideInset: 24 });
    fireEvent.change(screen.getByRole("slider", { name: /Top bar \/ side panel gap/ }), {
      target: { value: "18" },
    });
    expect(onGeometryChange).toHaveBeenLastCalledWith({ ...geometryValues, panelGap: 18 });
  });
});

function renderTuner(
  onMaterialChange: (values: GlassMaterialValues) => void,
  onGeometryChange: (values: WorkspaceGeometryValues) => void,
  onPreviewChange: (values: PreviewTuningValues) => void = vi.fn(),
) {
  return render(
    <FrostedGlassTuner
      materialValues={materialValues}
      previewValues={previewValues}
      geometryValues={geometryValues}
      onMaterialChange={onMaterialChange}
      onPreviewChange={onPreviewChange}
      onGeometryChange={onGeometryChange}
    />,
  );
}
