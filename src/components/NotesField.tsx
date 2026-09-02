import { useEffect, useRef, useState, type ReactNode } from "react";
import { NoteList } from "@/components/NoteList";
import { noteBlocks } from "@/lib/firmware-catalogue";

const MARKDOWN_GUIDE = "https://commonmark.org/help/";

interface NotesFieldProps {
  // Names the field for assistive tech only. The visible name is the tab
  // above, so rendering it here too read as the label repeating itself.
  label: string;
  // Qualifier shown in place of that label: "optional", "never shown
  // publicly". The second is the one that must stay visible.
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  // Internal notes get a dashed border so the two fields never read as one.
  variant?: "public" | "internal";
  // Extra help under the syntax line, e.g. where the text will appear.
  children?: ReactNode;
}

// A notes textarea that grows with what is typed, the syntax it understands
// tucked behind a Syntax button, and a preview toggle that renders through
// the same NoteList the site uses. The preview exists so nobody has to save to find
// out whether a line became a bullet or a paragraph. It is a toggle rather
// than an always-on pane: the pane doubled the field's height and Jake
// preferred the quieter form.
//
// field-sizing-content does the growing: no scrollbar, no resize grip, no
// clipped lines. It is a Chromium feature, and this app is Chromium-only by
// hard constraint (WebUSB), so there is nothing to fall back to.
//
export const NotesField = ({
  label,
  hint,
  value,
  onChange,
  placeholder,
  variant = "public",
  children,
}: NotesFieldProps) => {
  const [preview, setPreview] = useState(false);
  // The syntax rules were three lines of permanent grey text under every
  // notes field, which is a lot of chrome for something you read once. Behind
  // a button they stay one click away without crowding the form.
  const [syntax, setSyntax] = useState(false);
  const blocks = noteBlocks(value);
  const syntaxRef = useRef<HTMLDivElement>(null);

  // Dismiss on outside click and on Escape, the two things anyone tries
  // first. Native title= would have been simpler but cannot carry the
  // formatted code samples this help is made of.
  useEffect(() => {
    if (!syntax) return;
    const onDown = (e: MouseEvent) => {
      if (!syntaxRef.current?.contains(e.target as Node)) setSyntax(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSyntax(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [syntax]);
  const border =
    variant === "internal"
      ? "border-dashed border-border/60"
      : "border-solid border-border";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="text-caption text-text/45">{hint}</p>
        <div className="flex shrink-0 items-baseline gap-3.5">
          <div ref={syntaxRef} className="relative">
            <button
              type="button"
              onClick={() => setSyntax((v) => !v)}
              aria-expanded={syntax}
              className={`cursor-pointer border-none bg-transparent p-0 text-meta font-bold uppercase tracking-[0.08em] underline underline-offset-[3px] ${
                syntax ? "text-text" : "text-text/55"
              }`}
            >
              Syntax
            </button>
            {syntax && (
              <div
                role="dialog"
                aria-label={`${label} syntax`}
                className="animate-tab-fade absolute right-0 top-full z-20 mt-2 w-[300px] border-2 border-border bg-surface px-3.5 py-3 text-left shadow-cba"
              >
                <p className="text-caption leading-[1.6] text-text/60">
                  Start a line with <span className="font-mono">-</span> for a
                  bullet, indent two spaces to nest one. Plain lines are
                  paragraphs; leave a blank line between them.
                </p>
                <p className="mt-2 text-caption leading-[1.6] text-text/60">
                  <span className="font-mono">**bold**</span>,{" "}
                  <span className="font-mono">*italic*</span>,{" "}
                  <span className="font-mono">`code`</span> and{" "}
                  <span className="font-mono">[text](url)</span> render.{" "}
                  <a
                    href={MARKDOWN_GUIDE}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline underline-offset-[3px]"
                  >
                    Markdown guide
                  </a>
                  .
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            aria-pressed={preview}
            disabled={blocks.length === 0}
            className="cursor-pointer border-none bg-transparent p-0 text-meta font-bold uppercase tracking-[0.08em] text-text/55 underline underline-offset-[3px] disabled:cursor-default disabled:no-underline disabled:opacity-40"
          >
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
      </div>
      {preview && blocks.length > 0 ? (
        <div className={`min-h-[6em] border-2 ${border} bg-surface px-3.5 py-3`}>
          <NoteList blocks={blocks} tone="text-text/80" subTone="text-text/60" />
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          aria-label={label}
          spellCheck
          className={`field-sizing-content w-full resize-none border-2 ${border} bg-surface px-3.5 py-3 text-body-sm font-medium leading-[1.6] outline-none transition-colors duration-200 placeholder:text-text/30 focus:border-text`}
        />
      )}
      {children}
    </div>
  );
};
