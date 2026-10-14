/**
 * A filled folder that opens while its button is hovered: both shapes are drawn and the CSS in
 * folder.css shows one, so hovering only swaps visibility.
 */
export function FolderGlyph({ size = 19 }: { readonly size?: number }) {
  return (
    <svg
      className="taskmap-folder-glyph"
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="currentColor"
      aria-hidden
    >
      <path
        className="taskmap-folder-glyph__closed"
        d="M26 26H4c-1.105 0-2-.895-2-2V12c0-.552.448-1 1-1h24c.552 0 1 .448 1 1v12C28 25.105 27.105 26 26 26zM26 6H11.2l-.617-1.029C10.222 4.369 9.571 4 8.868 4H4C2.895 4 2 4.895 2 6v3h11 15V8C28 6.895 27.105 6 26 6z"
      />
      <path
        className="taskmap-folder-glyph__open"
        d="M2 21V6c0-1.105.895-2 2-2h4.868c.703 0 1.354.369 1.715.971L11.2 6H24c1.105 0 2 .895 2 2v2H8.1c-1.31 0-2.47.85-2.86 2.1zM6.94 13.4C7.2 12.57 7.98 12 8.85 12h19.3c.68 0 1.17.66.96 1.31l-3.19 10.3C25.66 24.94 24.44 26 23.05 26H3.6c-.68 0-1.17-.66-.96-1.31z"
      />
    </svg>
  );
}
