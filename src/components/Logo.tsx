import markAsset from "@/assets/belparking-mark.png.asset.json";

export function Logo({
  className = "h-12 w-auto",
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src={markAsset.url}
        alt="BelParking"
        className={`${className} drop-shadow-[0_0_18px_var(--glow-primary)]`}
      />
      {showWordmark && (
        <span className="text-display bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-2xl tracking-[0.12em] text-transparent">
          BELPARKING
        </span>
      )}
    </span>
  );
}

export const logoUrl = markAsset.url;
