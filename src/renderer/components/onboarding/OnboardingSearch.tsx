import clsx from 'clsx';
import { Search } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { Button } from '../ui/Button.js';
import { Kbd, MOD_KEY } from '../ui/Kbd.js';
import { usePrefersReducedMotion } from './motion.js';
import { OnboardingStep } from './OnboardingStep.js';

/** Real Echo syntax, from plain words to a combined query. */
const EXAMPLES = [
  { query: 'database architecture', hint: 'Words, anywhere in a file' },
  { query: '"database architecture"', hint: 'This exact phrase' },
  { query: 'type:pdf folder:projects', hint: 'PDFs in Projects' },
  { query: 'database AND sqlite', hint: 'Both, in the same file' },
];

const CYCLE_MS = 2400;

export function OnboardingSearch({ onFinish }: { onFinish: () => void }) {
  return (
    <OnboardingStep
      title="Search naturally. Go deeper when you need to."
      description="Start with what you remember. Echo also understands phrases, filters and advanced queries."
      visual={<QueryExamples />}
      actions={
        <Button size="lg" variant="primary" className="min-w-[160px]" onClick={onFinish} data-onboarding-primary>
          Start using Echo
        </Button>
      }
      footnote={
        <p className="flex items-center justify-center gap-1.5 text-xs text-fg-3">
          Press <Kbd keys={[MOD_KEY, 'K']} /> <span className="sr-only">{MOD_KEY} K</span> anytime to search.
        </p>
      }
    />
  );
}

/** Example queries; the highlight walks down the list, like results being browsed. */
function QueryExamples() {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduced || paused) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % EXAMPLES.length), CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [reduced, paused]);

  return (
    <ul
      aria-label="Example searches"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="mx-auto flex w-full max-w-[480px] flex-col gap-px rounded-lg border border-line bg-surface p-1.5 text-left"
    >
      {EXAMPLES.map((example, index) => {
        const selected = index === active;
        return (
          <li
            key={example.query}
            onMouseEnter={() => setActive(index)}
            className={clsx(
              'relative flex h-10 items-center gap-3 rounded-md px-3 [@media(max-height:600px)]:h-9 transition-colors duration-150',
              selected ? 'bg-selection' : 'hover:bg-hover'
            )}
          >
            <span
              aria-hidden="true"
              className={clsx(
                'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent transition-[opacity,transform] duration-150',
                selected ? 'opacity-100' : 'scale-y-50 opacity-0'
              )}
            />
            <Search
              size={14}
              aria-hidden="true"
              className={clsx('shrink-0 transition-colors duration-150', selected ? 'text-accent-text' : 'text-fg-3')}
            />
            <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fg">
              <QuerySyntax query={example.query} />
            </code>
            <span className="shrink-0 text-xs text-fg-3 max-[560px]:hidden">{example.hint}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Tints the parts of a query Echo treats specially: filter keys, operators, quotes. */
function QuerySyntax({ query }: { query: string }) {
  const parts = query.split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) => {
        const filter = part.match(/^([a-z]+:)(.*)$/);
        if (filter) {
          return (
            <Fragment key={i}>
              <span className="text-accent-text">{filter[1]}</span>
              {filter[2]}
            </Fragment>
          );
        }
        if (/^(AND|OR|NOT)$/.test(part)) {
          return (
            <span key={i} className="font-semibold text-accent-text">
              {part}
            </span>
          );
        }
        return (
          <Fragment key={i}>
            {part.split(/(")/).map((piece, j) =>
              piece === '"' ? (
                <span key={j} className="text-accent-text">
                  "
                </span>
              ) : (
                piece
              )
            )}
          </Fragment>
        );
      })}
    </>
  );
}
