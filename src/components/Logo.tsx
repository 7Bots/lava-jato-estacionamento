import bpLogo from "../assets/belparking-bp-logo.png";

export function LogoMark({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <img
      src={bpLogo}
      alt="BelParking"
      className={className}
      width={1024}
      height={1024}
      loading="eager"
      decoding="async"
    />
  );
}

export function Logo({
  className = "h-12 w-auto",
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={className} />
      {showWordmark && (
        <span className="text-display bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-2xl tracking-[0.12em] text-transparent">
          BELPARKING
        </span>
      )}
    </span>
  );
}
