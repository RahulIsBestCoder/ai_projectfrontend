import React from 'react';

type ThemedLoaderProps = {
  label?: string;
  compact?: boolean;
  className?: string;
};

/** Shared magenta AI processing indicator. */
export const ThemedLoader: React.FC<ThemedLoaderProps> = ({
  label = 'Loading',
  compact = false,
  className = '',
}) => (
  <div
    className={`${compact ? 'inline-flex items-center gap-1.5' : 'flex flex-col items-center justify-center gap-2'} ${className}`}
    role="status"
    aria-live="polite"
  >
    <span className={`themed-loader ${compact ? 'themed-loader--compact' : ''}`} aria-hidden="true">✦</span>
    {label && <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-fuchsia-700">{label}</span>}
    <span className="sr-only">Loading</span>
  </div>
);
