import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Dakhli">
      <rect width="48" height="48" rx="12" fill="#1A6E51" />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M12 13 L21 13 C29 13 34 19 34 25 C34 31 29 37 21 37 L12 37 Z M18 19 L18 31 L21 31 C25 31 28 28 28 25 C28 21 25 19 21 19 Z"
      />
      <path
        fill="none"
        stroke="#fff"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M31 17 L39 9 M35 9 L39 9 L39 13"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-8 w-8" />
      <span className="font-display text-xl font-bold tracking-tight">Dakhli</span>
    </span>
  );
}
