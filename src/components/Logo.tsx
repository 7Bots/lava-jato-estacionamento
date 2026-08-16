import bpLogo from "../assets/belparking-bp-logo.png";

export function LogoMark({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <img
      src={bpLogo}
      alt="BelParking"
      className={className}
      width={1154}
      height={675}
      loading="eager"
      decoding="async"
    />
  );
}

export function Logo({
  className = "h-12 w-auto",
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return <LogoMark className={className} />;
}
