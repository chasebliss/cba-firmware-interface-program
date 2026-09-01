import { BinaryHero } from "@/components/BinaryHero";
import { Nav } from "@/components/Nav";

interface AdminHeaderProps {
  flashing?: boolean;
}

export const AdminHeader = ({ flashing = false }: AdminHeaderProps) => {
  return (
    <>
      <Nav
        variant="dark"
        rightLabel="Admin"
        backLink={{ href: "/beta", label: "To Beta" }}
      />
      <div className="border-b border-border/10 bg-surface px-[7vw]">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 py-5 md:flex-row md:items-center md:justify-between md:gap-8 md:py-[22px]">
          <h1
            className="text-center font-bold tracking-[-0.02em] md:text-left"
            style={{ fontSize: "clamp(1.6rem, 2.2vw, 2.15rem)" }}
          >
            Admin Programmer.
          </h1>
          <BinaryHero width={300} flashing={flashing} className="max-w-full" />
        </div>
      </div>
    </>
  );
};
