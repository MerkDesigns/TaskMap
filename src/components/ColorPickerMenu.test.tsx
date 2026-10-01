import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorPickerMenu } from "./ColorPickerMenu";

afterEach(cleanup);

/** Mirrors real callers: the emitted colour is stored and echoed back through `color`. */
function EchoingPicker({ onChange }: { readonly onChange: (color: string) => void }) {
  const [color, setColor] = useState("#476FA8");
  return (
    <ColorPickerMenu
      color={color}
      left={10}
      top={10}
      recentColors={[]}
      onChange={(next) => {
        onChange(next);
        setColor(next);
      }}
      onClose={vi.fn()}
    />
  );
}

describe("ColorPickerMenu", () => {
  it("keeps the other H/S/L sliders steady while one is dragged", () => {
    const onChange = vi.fn();
    render(<EchoingPicker onChange={onChange} />);
    const hue = screen.getByRole("slider", { name: "Hue" });
    const saturation = screen.getByRole("slider", { name: "Sat" });
    const light = screen.getByRole("slider", { name: "Light" });
    expect(hue).toHaveAttribute("step", "1");
    const startHue = (hue as HTMLInputElement).value;
    const startLight = (light as HTMLInputElement).value;

    // Grey at zero saturation used to snap hue to 0 through the RGB round trip.
    for (const value of ["30", "12", "0"]) fireEvent.change(saturation, { target: { value } });

    expect((saturation as HTMLInputElement).value).toBe("0");
    expect((hue as HTMLInputElement).value).toBe(startHue);
    expect((light as HTMLInputElement).value).toBe(startLight);
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("ignores late, out-of-order echoes of colours it already emitted", () => {
    const emitted: string[] = [];
    const view = (color: string) => (
      <ColorPickerMenu
        color={color}
        left={10}
        top={10}
        recentColors={[]}
        onChange={(next) => emitted.push(next)}
        onClose={vi.fn()}
      />
    );
    const { rerender } = render(view("#476FA8"));
    const saturation = screen.getByRole("slider", { name: "Sat" });
    fireEvent.change(saturation, { target: { value: "20" } });
    fireEvent.change(saturation, { target: { value: "5" } });
    expect(emitted).toHaveLength(2);

    // The persisted first change arrives after the second one.
    rerender(view(emitted[0]));
    expect((saturation as HTMLInputElement).value).toBe("5");
    expect(screen.getByRole("textbox", { name: "Hex" })).toHaveValue(emitted[1]);

    // A very fast drag emits hundreds of values; even the oldest echo must not reset the editor.
    const hue = screen.getByRole("slider", { name: "Hue" });
    fireEvent.change(saturation, { target: { value: "60" } });
    for (let value = 0; value < 300; value += 1) {
      fireEvent.change(hue, { target: { value: String(value) } });
    }
    const latest = emitted[emitted.length - 1];
    rerender(view(emitted[2]));
    expect((hue as HTMLInputElement).value).toBe("299");
    expect(screen.getByRole("textbox", { name: "Hex" })).toHaveValue(latest);
  });

  it("re-derives the sliders when the colour changes from outside", () => {
    const { rerender } = render(
      <ColorPickerMenu
        color="#476FA8"
        left={10}
        top={10}
        recentColors={[]}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    rerender(
      <ColorPickerMenu
        color="#FF0000"
        left={10}
        top={10}
        recentColors={[]}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect((screen.getByRole("slider", { name: "Hue" }) as HTMLInputElement).value).toBe("0");
    expect((screen.getByRole("slider", { name: "Sat" }) as HTMLInputElement).value).toBe("100");
    expect(screen.getByRole("textbox", { name: "Hex" })).toHaveValue("#FF0000");
  });
});
