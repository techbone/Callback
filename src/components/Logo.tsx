/** The Callback mark: a C with a spell-check squiggle under it. Same shapes as app/icon.svg. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Callback">
      <rect width="32" height="32" rx="7.5" fill="var(--ink)" />
      <path d="M20.6 8.6A7.2 7.2 0 1 0 20.6 19.4" fill="none" stroke="var(--bg)" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M6.5 25.2q2.4-3 4.8 0t4.8 0 4.8 0 4.8 0" fill="none" stroke="var(--red)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
