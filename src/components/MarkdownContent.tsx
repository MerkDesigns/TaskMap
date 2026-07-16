import { invoke } from "@tauri-apps/api/core";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  children: string;
};

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const SAFE_IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

function getSafeUrl(value: string | undefined, protocols: Set<string>) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return protocols.has(url.protocol.toLowerCase()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function MarkdownContentComponent({ children }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      skipHtml
      urlTransform={(url, key) =>
        getSafeUrl(url, key === "href" ? SAFE_LINK_PROTOCOLS : SAFE_IMAGE_PROTOCOLS) ?? ""
      }
      components={{
        a({ href, children: linkChildren }) {
          const safeHref = getSafeUrl(href, SAFE_LINK_PROTOCOLS);

          return (
            <a
              href={safeHref ?? undefined}
              aria-disabled={!safeHref}
              onPointerDown={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                if (!safeHref) {
                  return;
                }

                invoke("plugin:opener|open_url", { url: safeHref }).catch((error) => {
                  console.error("Failed to open Markdown link", error);
                });
              }}
            >
              {linkChildren}
            </a>
          );
        },
        img({ src, alt }) {
          const safeSrc = getSafeUrl(src, SAFE_IMAGE_PROTOCOLS);
          return safeSrc ? (
            <img src={safeSrc} alt={alt ?? ""} loading="lazy" draggable={false} />
          ) : alt ? (
            <span>{alt}</span>
          ) : null;
        },
        input({ type, checked }) {
          if (type !== "checkbox") {
            return null;
          }

          return <input type="checkbox" checked={checked} readOnly disabled tabIndex={-1} />;
        },
        table({ children: tableChildren }) {
          return (
            <div className="markdown-table-scroll">
              <table>{tableChildren}</table>
            </div>
          );
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

export const MarkdownContent = memo(MarkdownContentComponent);
