import clsx from 'clsx';
import { useRef, useState } from 'react';
import { EchoPulse } from '../brand/EchoRipple.js';
import { Popover } from '../ui/Popover.js';
import { IndexingPanel } from './IndexingPanel.js';
import { useLibraryStatus } from './useLibraryStatus.js';

/** Ambient library status in the title bar; opens the indexing panel. */
export function StatusIndicator() {
  const status = useLibraryStatus();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Library status: ${status.label}`}
        className={clsx(
          'flex h-7 items-center gap-2 rounded-md px-2.5 text-xs transition-colors duration-150',
          open ? 'bg-hover text-fg' : 'text-fg-2 hover:bg-hover hover:text-fg'
        )}
      >
        <EchoPulse tone={status.tone} pulsing={status.running} />
        <span className="max-w-[180px] truncate tabular-nums max-[640px]:hidden" aria-live="polite">
          {status.label}
        </span>
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={ref}
        align="end"
        width={320}
        label="Library status"
      >
        <IndexingPanel status={status} onNavigate={() => setOpen(false)} />
      </Popover>
    </>
  );
}
