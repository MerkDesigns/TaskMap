import { useState } from "react";
import type { CardAdornment } from "../cardAdornment";
import { FolderGlyph } from "./FolderGlyph";
import "./folder.css";

/** The folder button before a folder card's text: opens the folder, or sets it when none is. */
export const folderCardAdornment: CardAdornment = {
  extension: "folder",
  Leading: ({ context, commands }) => {
    const cardId = context.elementId;
    const path = context.extensions.folder?.path ?? "";
    // The path last found missing; the button stays dimmed until the path changes or opens.
    const [missingPath, setMissingPath] = useState<string | null>(null);
    const missing = path !== "" && missingPath === path;
    const title =
      path === "" ? "Choose a folder" : missing ? `Folder not found: ${path}` : `Open ${path}`;
    return (
      <button
        type="button"
        className="taskmap-extension-folder"
        data-state={path === "" ? "empty" : missing ? "missing" : undefined}
        aria-label={title}
        title={title}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (path === "") {
            commands.openFolderEditor(cardId);
            return;
          }
          void commands.openFolder(cardId).then((result) => {
            setMissingPath(result === "missing" ? path : null);
          });
        }}
      >
        <FolderGlyph />
      </button>
    );
  },
};
