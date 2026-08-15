import logoAsset from "@/assets/doca-lund-logo.png.asset.json";

export function Logo({ className = "h-12 w-auto" }: { className?: string }) {
  return <img src={logoAsset.url} alt="Doca Lund Estacionamento" className={className} />;
}

export const logoUrl = logoAsset.url;
