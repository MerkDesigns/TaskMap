import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@mantine/core/styles.css";
import { describe, expect, it } from "vitest";
import { TaskMapMantineProvider } from "../mantine/TaskMapMantineProvider";
import { MantineVerificationFixture } from "./MantineVerificationFixture";

describe("MantineVerificationFixture", () => {
  it("exercises representative controls and overlays", async () => {
    const user = userEvent.setup();
    render(
      <TaskMapMantineProvider>
        <MantineVerificationFixture />
      </TaskMapMantineProvider>,
    );

    expect(screen.getByRole("textbox", { name: "Canvas name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Primary action" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Workspace type" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(await screen.findByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open modal" }));
    expect(
      await screen.findByRole("dialog", { name: "Mantine modal verification" }),
    ).toBeInTheDocument();
  });
});
