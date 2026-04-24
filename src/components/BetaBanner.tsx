export const BetaBanner = () => {
  return (
    <div className="flex items-center justify-center gap-3.5 bg-red px-[7vw] py-2 text-white">
      <span className="bg-white px-2.5 py-[2px] text-[10px] font-bold uppercase tracking-[0.14em] text-red">
        Beta
      </span>
      <span className="text-[13px] font-medium">
        Unreleased firmware. For internal testing.
      </span>
    </div>
  );
};
