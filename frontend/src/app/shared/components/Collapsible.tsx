'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * A section/table panel that can be collapsed by clicking its header.
 *
 * Convention across the app: when several `<Collapsible>`s are stacked in a
 * screen, the first one is mounted with `defaultOpen` and the rest start
 * collapsed. State is local (per mount) — it is not persisted.
 */
export const Collapsible: React.FC<{
  title: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ElementType;
  /** Header-right slot (buttons, selects, badges). Clicks here don't toggle. */
  right?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Extra classes for the outer <section>. */
  className?: string;
  /** Body padding when open (default `p-4`). Pass '' for flush content. */
  bodyClassName?: string;
}> = ({
  title,
  defaultOpen = false,
  icon: Icon,
  right,
  subtitle,
  children,
  className = '',
  bodyClassName = 'p-4',
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`bg-white border border-slate-300 ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 min-w-0 text-[11px] font-black uppercase tracking-widest text-slate-900"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 text-indigo-600 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`}
          />
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
          <span className="truncate">{title}</span>
          {subtitle && (
            <span className="text-[10px] font-mono text-slate-400 normal-case tracking-normal truncate">
              {subtitle}
            </span>
          )}
        </button>
        {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
      </div>
      <div className={open ? bodyClassName : undefined} hidden={!open}>
        {children}
      </div>
    </section>
  );
};
