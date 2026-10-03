import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MindMapConnectionMenu } from "./MindMapConnectionMenu";

afterEach(cleanup);

describe("MindMapConnectionMenu", () => {
  it("deletes the connection it was opened for", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <MindMapConnectionMenu
        connectionId="connection-1"
        position={{ left: 100, top: 100 }}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("menuitem", { name: "Delete connection" }));

    expect(onDelete).toHaveBeenCalledWith("connection-1");
  });
});
