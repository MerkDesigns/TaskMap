import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickExtensionsMenu } from "./ExtensionsPanel";

afterEach(cleanup);

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
