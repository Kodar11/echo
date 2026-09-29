import clsx from 'clsx';
import { Search } from 'lucide-react';
import { EchoMark } from '../brand/EchoMark.js';
import { EchoRipple } from '../brand/EchoRipple.js';
import { FileIcon } from '../FileIcon.js';
import { Button } from '../ui/Button.js';
import { useTypewriter } from './motion.js';
import { OnboardingStep } from './OnboardingStep.js';

const DEMO_QUERY = 'database architecture';

const DEMO_RESULTS = [
  {
    path: 'system-design-notes.md',
    crumbs: ['Notes', 'Engineering'],
    meta: '14 KB · Mar 12',
    before: '…we moved the ',
    after: ' to one SQLite file per workspace, so backups stay…',
  },
  {
    path: 'Q3 platform review.pdf',
    crumbs: ['Documents', 'Reviews'],
    meta: '2.1 MB · Sep 3',
    before: '…the ',
    after: ' review found two hot paths in the sync service…',
  },
];

export function OnboardingWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <OnboardingStep
      lead={
        <div className="relative mb-5 flex h-14 w-14 items-center justify-center [@media(max-height:640px)]:hidden">
          <EchoRipple className="absolute left-1/2 top-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2" />
          <EchoMark size={48} className="relative" />
        </div>
      }
      title="Search everything you remember."
      description="Echo searches the contents of your files — not just their names."
      visual={<SearchDemo />}
      actions={
        <Button size="lg" variant="primary" className="min-w-[140px]" onClick={onContinue} data-onboarding-primary>
          Continue
        </Button>
      }
    />
  );
}

/** A still life of the search page: a query being typed and the files it finds. */
function SearchDemo() {
  const { typed, done } = useTypewriter(DEMO_QUERY);

  return (
    <div className="mx-auto w-full max-w-[520px] text-left" role="img" aria-label={`Searching for “${DEMO_QUERY}” finds files that mention it.`}>
      <div aria-hidden="true">
        <div className="flex h-11 items-center rounded-lg border border-accent bg-surface shadow-bar-focus">
          <span className="flex w-11 shrink-0 items-center justify-center text-accent-text">
            <Search size={17} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1 truncate whitespace-pre text-base text-fg">
            {typed}
            <span
              className="motion-ambient ml-px inline-block h-[18px] w-px translate-y-[3px] bg-fg"
              style={{ animation: done ? 'caret-blink 1.1s steps(1) infinite' : undefined }}
            />
          </span>
        </div>

        {/* The last row fades out, hinting at more results; short windows show one row, unfaded. */}
        <div
          className={clsx(
            'transition-opacity duration-200 [mask-image:linear-gradient(to_bottom,#000_72%,transparent)]',
            '[@media(max-height:600px)]:[mask-image:none]',
            done ? 'opacity-100' : 'opacity-0'
          )}
        >
          <p className="flex h-8 items-center px-3 pt-1 text-xs tabular-nums text-fg-3">
            12 results<span className="opacity-70">&nbsp;· 9 ms</span>
          </p>
          <div className="flex flex-col gap-px">
            {DEMO_RESULTS.map((result, index) => (
              <div
                key={result.path}
                className={clsx(
                  'relative flex gap-3 rounded-md px-3 py-2.5',
                  index === 0 && 'bg-selection',
                  index > 0 && '[@media(max-height:600px)]:hidden',
                  done && 'animate-rise-in'
                )}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {index === 0 && (
                  <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-accent" />
                )}
                <div className="pt-0.5">
                  <FileIcon filePath={result.path} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-fg">{result.path}</p>
                  <p className="mt-0.5 truncate text-xs text-fg-3">
                    {result.crumbs.map((crumb, i) => (
                      <span key={crumb}>
                        {i > 0 && <span className="px-1 opacity-60">›</span>}
                        {crumb}
                      </span>
                    ))}
                    <span className="px-1.5 opacity-60">·</span>
                    {result.meta}
                  </p>
                  <p className="mt-1.5 truncate text-sm text-fg-2">
                    {result.before}
                    <mark className="hl-phrase">{DEMO_QUERY}</mark>
                    {result.after}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
