export function ZelligePattern({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      className={className}
    >
      <rect x="70" y="70" width="100" height="100" />
      <rect x="70" y="70" width="100" height="100" transform="rotate(45 120 120)" />
      <circle cx="120" cy="120" r="78" />
    </svg>
  );
}
