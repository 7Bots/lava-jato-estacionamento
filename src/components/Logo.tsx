export function LogoMark({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bp-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-secondary)" />
        </linearGradient>
      </defs>
      <path
        d="M32 3.5 56.5 17.5v29L32 60.5 7.5 46.5v-29L32 3.5Z"
        stroke="url(#bp-grad)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M25 45V19h9.5a8.5 8.5 0 0 1 0 17H25"
        stroke="url(#bp-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
