import { useEffect, useState } from "react";

const CHAR_MS = 55;

export const HeadingBox = ({ children }: { children: string }) => {
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(children.slice(0, i));
      if (i >= children.length) clearInterval(id);
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
