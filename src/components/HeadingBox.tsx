import { useEffect, useState } from "react";

const CHAR_MS = 55;

export const HeadingBox = ({ children }: { children: string }) => {
  // Typed-out length rather than the string itself, so a change of `children`
  // resets by comparison during render instead of a synchronous setState in
  // the effect (which would cascade a second render every time).
  const [count, setCount] = useState(0);
  const [typing, setTyping] = useState(children);
  if (typing !== children) {
    setTyping(children);
    setCount(0);
  }
  const shown = children.slice(0, count);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((n) => {
        if (n >= children.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, CHAR_MS);
    return () => clearInterval(id);
  }, [children]);

  return (
    <h1
      className="w-fit border-2 border-border bg-surface px-5 py-4 font-bold shadow-cba"
      style={{ fontSize: "calc((2 - 1) * 1.2vw + 1rem)" }}
    >
      <span aria-label={children}>{shown}</span>
    </h1>
  );
};
