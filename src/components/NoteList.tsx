import { InlineMarkdown } from "@/components/InlineMarkdown";
import type { NoteItem } from "@/lib/firmware-catalogue";

interface NoteListProps {
  items: NoteItem[];
  // Tailwind text colour class for top-level lines. Sub-points derive their
  // own quieter tone from it, so callers pass one value rather than two.
  tone?: string;
  subTone?: string;
}

// The rendered form of a notes field: one bulleted line per change, with one
// level of nesting. Shared by the public release-notes panel and both lists
// in the admin row, so a change to how a note looks lands in one place.
export const NoteList = ({
  items,
  tone = "text-text/60",
  subTone = "text-text/45",
}: NoteListProps) => (
  <ul className="flex flex-col gap-1">
    {items.map((item, i) => (
      <li
        key={i}
        // Grid rather than a list-style marker so a wrapped line aligns under
        // the text instead of under the bullet.
        className={`grid grid-cols-[0.6em_1fr] gap-x-1.5 text-caption leading-[1.5] ${
          item.depth === 1 ? `pl-3.5 ${subTone}` : tone
        }`}
      >
        <span aria-hidden="true" className="text-text/30">
          {item.depth === 1 ? "◦" : "•"}
        </span>
        <span>
          <InlineMarkdown text={item.text} />
        </span>
      </li>
    ))}
  </ul>
);
