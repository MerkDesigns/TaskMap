import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXTENSIONS } from "../extensions/registry";
import { MaterialSurfaceRegistrationProvider } from "../ui/materials/MaterialSurfaceRegistration";
import { readNativeGlassDiagnostics } from "../ui/materials/SharedSmallGlassPlane";
import {
  createMaterialSurfaceRegistry,
  type MaterialSurfaceRegistry,
} from "../ui/materials/materialSurfaceRegistry";
import { ReducedMotionProvider } from "../ui/motion/reducedMotionPreference";
import { ExtensionsPanel, QuickExtensionsMenu } from "./ExtensionsPanel";

const FAVORITES_KEY = "taskmap.extensionFavorites";

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Quick extensions menu", () => {
  it("focuses its search and filters extensions as the user types", async () => {
    const user = userEvent.setup();
    render(
      <QuickExtensionsMenu left={100} top={100} onClose={vi.fn()} onDropExtension={vi.fn()} />,
    );

    const search = screen.getByPlaceholderText("Search extensions");
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, "command");

    expect(screen.getByText("Command Runner")).toBeInTheDocument();
    expect(screen.queryByText("Checkbox")).not.toBeInTheDocument();
  });
});

describe("C2E Extensions panel", () => {
  it("uses one bounded Small batch and suspends it when the retained view settles inactive", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains("taskmap-extension-browser-scroll-area")) {
        return rect(16, 120, 264, 190);
      }
      if (this.dataset.extensionCardId) {
        const index = EXTENSIONS.findIndex(
          (extension) => extension.id === this.dataset.extensionCardId,
        );
        return rect(16, 120 + index * 66, 264, 58);
      }
      return rect(0, 0, 0, 0);
    });
    const registry = createMaterialSurfaceRegistry(null);
    const view = (active: boolean) => (
      <MaterialSurfaceRegistrationProvider
        value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
      >
        <ReducedMotionProvider override>
          <ExtensionsPanel active={active} closing={false} sharedPanel onDropExtension={vi.fn()} />
        </ReducedMotionProvider>
      </MaterialSurfaceRegistrationProvider>
    );
    const { container, rerender } = render(view(true));

    expect(
      container.querySelectorAll(
        '[data-extension-card-id][data-material-backdrop-source="shared"]',
      ),
    ).toHaveLength(EXTENSIONS.length);
    expect(readNativeGlassDiagnostics(container)).toMatchObject({
      localMaterialBackdropFilterCount: 0,
      nativeBackdropFilterLayerCount: 1,
      sharedSmallBatchCount: 1,
    });

    rerender(view(false));
    await waitFor(() =>
      expect(readNativeGlassDiagnostics(container)).toMatchObject({
        nativeBackdropFilterLayerCount: 0,
        sharedSmallBatchCount: 0,
      }),
    );
    registry.dispose();
  });

  it("maps production cards to Acrylic Small and icon boxes to unregistered Cutout", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = renderProduction(registry);
    const cards = [...container.querySelectorAll("[data-extension-card-id]")];
    const icons = [...container.querySelectorAll(".taskmap-extension-browser-icon")];

    expect(cards).toHaveLength(EXTENSIONS.length);
    expect(icons).toHaveLength(EXTENSIONS.length);
    for (const card of cards) {
      expect(card).toHaveAttribute("data-material", "acrylic-small");
      expect((card as HTMLElement).style.getPropertyValue("--taskmap-material-radius")).toBe("8px");
    }
    for (const icon of icons) {
      expect(icon).toHaveAttribute("data-material", "cutout");
      expect((icon as HTMLElement).style.getPropertyValue("--taskmap-material-radius")).toBe("6px");
      expect(icon).not.toHaveAttribute("data-material-surface-id");
    }
    expect(
      cards.every((card) => card.getAttribute("data-material-strategy") === "native-glass"),
    ).toBe(true);
    expect(registry.getSnapshot().surfaces).toEqual([]);
    registry.dispose();
  });

  it("uses Opaque cards and registers zero cached-acrylic surfaces in embedded mode", () => {
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = renderPanel(registry, { embedded: true });

    expect(container.querySelectorAll('[data-material="opaque"]')).toHaveLength(EXTENSIONS.length);
    expect(container.querySelectorAll('[data-material="cutout"]')).toHaveLength(EXTENSIONS.length);
    expect(registry.getSnapshot().surfaces).toHaveLength(0);
    registry.dispose();
  });

  it("preserves search matching, placeholder, and spellcheck behavior", async () => {
    const user = userEvent.setup();
    render(<ExtensionsPanel closing={false} embedded onDropExtension={vi.fn()} />);
    const search = screen.getByRole("searchbox", { name: "Search extensions" });

    expect(search).toHaveAttribute("placeholder", "Search extensions");
    expect(search).toHaveAttribute("spellcheck", "false");
    await user.type(search, "text cards");

    expect(screen.getByText("Checkbox")).toBeInTheDocument();
    expect(screen.getByText("Command Runner")).toBeInTheDocument();
    expect(screen.queryByText("Privacy")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "fine-tune");
    expect(screen.getByText("Extra colors")).toBeInTheDocument();
    expect(screen.queryByText("Lock")).not.toBeInTheDocument();
  });

  it("preserves target filtering and keeps the legacy filter portal outside the panel", async () => {
    const user = userEvent.setup();
    render(<ExtensionsPanel closing={false} onDropExtension={vi.fn()} />);
    const panel = screen.getByLabelText("Extensions panel");
    const trigger = screen.getByRole("button", { name: "Filter by element" });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveAttribute("aria-pressed");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const filterMenu = document.body.querySelector("[data-extension-filter-menu]") as HTMLElement;
    expect(filterMenu).toHaveClass("context-menu-panel", "taskmap-target-theme");
    expect(filterMenu).not.toHaveAttribute("data-material");
    expect(panel.contains(filterMenu)).toBe(false);

    for (const label of ["Containers", "Text blocks", "Text cards", "Images"]) {
      await user.click(within(filterMenu).getByRole("button", { name: label }));
    }
    expect(trigger).toHaveAttribute("data-filter-active", "true");
    expect(screen.getByText("Lock")).toBeInTheDocument();
    expect(screen.getByText("Extra colors")).toBeInTheDocument();
    expect(screen.queryByText("Privacy")).not.toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    await waitFor(() =>
      expect(document.body.querySelector("[data-extension-filter-menu]")).toBeNull(),
    );
  });

  it("preserves Favorites and Extensions grouping in registry order", () => {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify({ sorting: true, privacy: true }));
    const { container } = render(
      <ExtensionsPanel closing={false} embedded onDropExtension={vi.fn()} />,
    );
    const sections = [...container.querySelectorAll(".taskmap-extension-browser-section")];

    expect(sections).toHaveLength(2);
    expect(within(sections[0] as HTMLElement).getByText("Favorites")).toBeInTheDocument();
    expect(extensionIds(sections[0] as HTMLElement)).toEqual(["privacy", "sorting"]);
    expect(within(sections[1] as HTMLElement).getByText("Extensions")).toBeInTheDocument();
    expect(extensionIds(sections[1] as HTMLElement).slice(0, 2)).toEqual(["lock", "colorPicker"]);
  });

  it("preserves favorite toggle persistence and the five-favorite limit", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify({ privacy: true, lock: true, colorPicker: true, search: true, sorting: true }),
    );
    const { container } = render(
      <ExtensionsPanel closing={false} embedded onDropExtension={vi.fn()} />,
    );
    const checkboxCard = extensionCard(container, "checkbox");
    const limited = within(checkboxCard).getByRole("button", {
      name: "Maximum 5 favorites",
    });
    expect(limited).toBeDisabled();
    expect(limited).toHaveAttribute("title", "Maximum 5 favorites");

    const privacyCard = extensionCard(container, "privacy");
    const removePrivacy = within(privacyCard).getByRole("button", { name: "Remove favorite" });
    expect(removePrivacy.querySelector("svg")).toHaveAttribute("fill", "currentColor");
    await user.click(removePrivacy);
    expect(within(checkboxCard).getByRole("button", { name: "Favorite" })).toBeEnabled();
    await user.click(within(checkboxCard).getByRole("button", { name: "Favorite" }));
    expect(
      within(extensionCard(container, "checkbox"))
        .getByRole("button", { name: "Remove favorite" })
        .querySelector("svg"),
    ).toHaveAttribute("fill", "currentColor");

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "{}") as Record<
        string,
        boolean
      >;
      expect(Object.values(stored).filter(Boolean)).toHaveLength(5);
      expect(stored.privacy).toBe(false);
      expect(stored.checkbox).toBe(true);
    });
  });

  it("keeps favorite and legacy info controls from starting extension drag", () => {
    const onDragExtension = vi.fn();
    const { container } = render(
      <ExtensionsPanel
        closing={false}
        embedded
        onDropExtension={vi.fn()}
        onDragExtension={onDragExtension}
      />,
    );
    const card = extensionCard(container, "privacy");
    const favorite = within(card).getByRole("button", { name: "Favorite" });
    const info = card.querySelector(
      "button:not(.taskmap-extension-browser-favorite)",
    ) as HTMLButtonElement;

    fireEvent.pointerDown(favorite, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerDown(info, { button: 0, clientX: 20, clientY: 20 });
    expect(onDragExtension).not.toHaveBeenCalled();
  });

  it("preserves extension drag/drop, source suppression, and an unregistered body preview", async () => {
    const user = userEvent.setup();
    const registry = createMaterialSurfaceRegistry(null);
    const onDragExtension = vi.fn();
    const onDropExtension = vi.fn();
    const { container } = renderPanel(registry, { onDragExtension, onDropExtension });
    const panel = screen.getByLabelText("Extensions panel");
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue(rect(0, 0, 290, 500));
    const card = extensionCard(container, "privacy");

    await user.pointer({
      keys: "[MouseLeft>]",
      target: card,
      coords: { clientX: 20, clientY: 20 },
    });
    expect(onDragExtension).toHaveBeenLastCalledWith("privacy", 20, 20);
    const preview = document.body.querySelector("[data-extension-drag-preview]") as HTMLElement;
    expect(preview).toBeInTheDocument();
    expect(preview).not.toHaveAttribute("data-material-surface-id");
    expect(registry.getSnapshot().surfaces.some((surface) => surface.element === preview)).toBe(
      false,
    );

    await user.pointer({ target: document.body, coords: { clientX: 340, clientY: 560 } });
    expect(onDragExtension).toHaveBeenLastCalledWith("privacy", 340, 560);
    await user.pointer({
      keys: "[/MouseLeft]",
      target: document.body,
      coords: { clientX: 340, clientY: 560 },
    });
    expect(onDropExtension).toHaveBeenCalledWith("privacy", 340, 560);
    expect(onDragExtension).toHaveBeenLastCalledWith(null);
    expect(document.body.querySelector("[data-extension-drag-preview]")).toBeNull();

    await user.pointer({
      keys: "[MouseLeft>]",
      target: card,
      coords: { clientX: 20, clientY: 20 },
    });
    await user.pointer({
      keys: "[/MouseLeft]",
      target: panel,
      coords: { clientX: 40, clientY: 40 },
    });
    expect(onDropExtension).toHaveBeenCalledTimes(1);
    registry.dispose();
  });

  it("renders an unregistered empty state when no extension matches", async () => {
    const user = userEvent.setup();
    const registry = createMaterialSurfaceRegistry(null);
    const { container } = renderPanel(registry, { embedded: true });

    await user.type(screen.getByRole("searchbox", { name: "Search extensions" }), "no-match-z9");
    const empty = screen.getByText("No extensions found");
    expect(empty).toHaveClass("taskmap-extension-browser-empty");
    expect(empty).not.toHaveAttribute("data-material");
    expect(container.querySelectorAll("[data-extension-card-id]")).toHaveLength(0);
    expect(registry.getSnapshot().surfaces).toHaveLength(0);
    registry.dispose();
  });
});

function renderProduction(registry: MaterialSurfaceRegistry) {
  return renderPanel(registry);
}

function renderPanel(
  registry: MaterialSurfaceRegistry,
  overrides: Partial<ComponentProps<typeof ExtensionsPanel>> = {},
) {
  return render(
    <MaterialSurfaceRegistrationProvider
      value={{ registry, notifySurfaceGeometryChanged: vi.fn() }}
    >
      <ReducedMotionProvider override>
        <ExtensionsPanel closing={false} onDropExtension={vi.fn()} {...overrides} />
      </ReducedMotionProvider>
    </MaterialSurfaceRegistrationProvider>,
  );
}

function extensionCard(container: HTMLElement, id: string): HTMLElement {
  return container.querySelector(`[data-extension-card-id="${id}"]`) as HTMLElement;
}

function extensionIds(section: HTMLElement): string[] {
  return [...section.querySelectorAll("[data-extension-card-id]")].map(
    (card) => (card as HTMLElement).dataset.extensionCardId ?? "",
  );
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  };
}
