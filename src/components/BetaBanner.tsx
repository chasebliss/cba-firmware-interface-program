export const BetaBanner = () => {
  return (
    <div className="flex items-center justify-center gap-3 bg-black px-[7vw] py-2.5 text-sm font-medium text-cream">
      <span className="bg-red px-2 py-[2px] text-[11px] font-bold uppercase tracking-widest text-black">
        Beta
      </span>
      <span>Unreleased firmware. For internal testing only.</span>
    </div>
  );
};
