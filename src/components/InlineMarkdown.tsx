import type { ReactNode } from "react";

// Inline markdown for release notes. Deliberately not a markdown library:
// release notes are one short line each, and the four marks below are the
// only ones they use. Headings, tables and images would break a 300px
// sidebar column, so they are not supported rather than supported badly.
//
// Supported: **bold**, *italic*, `code`, [text](url).
// Anything else renders as the literal characters the admin typed, which is
// the right failure mode for notes written before markdown existed.

// One alternation, so the marks are matched in a single pass and can't nest
// into each other. Order matters: ** before * so bold wins over italic.
const TOKEN =
  /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;

// Only http(s) links become anchors. A javascript: or data: URL in a note
// would be an injected script, and the notes come from a manifest in a repo
// rather than from the person reading them.
const LINK = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;

export const InlineMarkdown = ({ text }: { text: string }) => {
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    const start = match.index;
    if (start > last) parts.push(text.slice(last, start));
    last = start + token.length;

    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="rounded-sm bg-text/8 px-1 font-mono text-[0.92em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const link = token.match(LINK);
      if (link) {
        parts.push(
          <a
            key={key++}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {link[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
  }

  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
};
