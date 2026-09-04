import { InlineMarkdown } from "@/components/InlineMarkdown";
import type { NoteBlock } from "@/lib/firmware-catalogue";

interface NoteListProps {
  blocks: NoteBlock[];
  // Tailwind text colour class for top-level lines and paragraphs. Nested
  // bullets derive their own quieter tone, so callers pass one value.
  tone?: string;
  subTone?: string;
}

// The rendered form of a notes field: bullets with one level of nesting,
// and paragraphs of prose between them. Shared by the public release-notes
// panel, both lists in the admin row, and the save form's preview, so a
// change to how a note looks lands in one place.
export const NoteList = ({
  blocks,
  tone = "text-text/60",
  subTone = "text-text/45",
}: NoteListProps) => (
  <div className="flex flex-col gap-1">
    {blocks.map((block, i) =>
      block.kind === "p" ? (
        <p
          key={i}
          // A paragraph after a bullet run gets a little air so it reads as
          // a new thought rather than an unmarked list item.
          className={`text-caption leading-[1.5] ${tone} ${
            i > 0 && blocks[i - 1].kind === "li" ? "mt-1" : ""
          }`}
        >
          <InlineMarkdown text={block.text} />
        </p>
      ) : (
        <div
          key={i}
          // Grid rather than a list-style marker so a wrapped line aligns
          // under the text instead of under the bullet.
          className={`grid grid-cols-[0.6em_1fr] gap-x-1.5 text-caption leading-[1.5] ${
            block.depth === 1 ? `pl-3.5 ${subTone}` : tone
          }`}
        >
          <span aria-hidden="true" className="text-text/30">
            {block.depth === 1 ? "◦" : "•"}
          </span>
          <span>
            <InlineMarkdown text={block.text} />
          </span>
        </div>
      ),
    )}
  </div>
);
