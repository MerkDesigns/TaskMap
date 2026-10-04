import { IconSearch, IconX } from "@tabler/icons-react";
import type { SyntheticEvent } from "react";
import type { HeaderRow } from "../headerRow";
import { SEARCH_ROW_HEIGHT } from "./searchRule";
import "./search.css";

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

/** The query field below a container's header; the container shows only matching cards. */
export const searchHeaderRow: HeaderRow = {
  extension: "search",
  hosts: ["container"],
  height: SEARCH_ROW_HEIGHT,
  Row: ({ context, commands }) => {
    const query = context.extensions.search?.query ?? "";
    return (
      <div
        className="taskmap-extension-search"
        onPointerDown={stopPropagation}
        onClick={stopPropagation}
      >
        <div className="taskmap-extension-search__field">
          <IconSearch size={16} stroke={2} />
          <input
            className="taskmap-extension-search__input"
            value={query}
            spellCheck={false}
            placeholder="Search"
            onChange={(event) => commands.setSearchQuery(context.elementId, event.target.value)}
          />
          {query && (
            <button
              className="taskmap-extension-search__clear"
              onClick={() => commands.setSearchQuery(context.elementId, "")}
              title="Clear search"
            >
              <IconX size={15} stroke={2} />
            </button>
          )}
        </div>
      </div>
    );
  },
};
