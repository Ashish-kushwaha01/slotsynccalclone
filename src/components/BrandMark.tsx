import { Link } from "@tanstack/react-router";

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5">
      <img
        src="/SlotSync_Logo.png"
        alt="Valence"
        width={size}
        height={size}
        className="rounded-md"
      />
      <span className="font-display text-xl font-semibold tracking-tight text-foreground">
        Valence
      </span>
    </Link>
  );
}


