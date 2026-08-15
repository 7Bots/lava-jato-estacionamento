import logoAsset from "@/assets/doca-lund-logo.png.asset.json";

export function Logo({ className = "h-12 w-auto" }: { className?: string }) {
  return <img src={logoAsset.url} alt="BelParking" className={className} />;
}

export const logoUrl = logoAsset.url;
