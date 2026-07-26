import logoAsset from "@/assets/slotsync-logo.png.asset.json";
import { Link } from "@tanstack/react-router";

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5">
      <img
        src={logoAsset.url}
        alt="SlotSync"
        width={size}
        height={size}
        className="rounded-md"
      />
      <span className="font-display text-xl font-semibold tracking-tight text-foreground">
        SlotSync
      </span>
    </Link>
  );
}
