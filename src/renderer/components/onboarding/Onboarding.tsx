import clsx from 'clsx';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { focusSearch } from '../../stores/navStore.js';
import { useSettingsStore } from '../../stores/settingsStore.js';
import { IS_MAC } from '../ui/Kbd.js';
import { Button } from '../ui/Button.js';
import { OnboardingLibrary } from './OnboardingLibrary.js';
import { OnboardingSearch } from './OnboardingSearch.js';
import { OnboardingWelcome } from './OnboardingWelcome.js';

const STEP_COUNT = 3;
const STEP_NAMES = ['Meet Echo', 'Choose your library', 'Search the way you think'];

/**
 * First-launch introduction: what Echo is, a library to search, and a glimpse
 * of the query language. Shown until it is completed or skipped; closing the
 * window part-way through brings it back next launch.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [{ step, direction }, setPosition] = useState<{ step: number; direction: 'next' | 'prev' | null }>({
    step: 0,
    direction: null,
  });
  const finished = useRef(false);

  /** Moves by `delta` steps, staying within the flow. */
  const move = useCallback((delta: number) => {
    setPosition((current) => {
      const step = Math.min(STEP_COUNT - 1, Math.max(0, current.step + delta));
      return step === current.step ? current : { step, direction: delta > 0 ? 'next' : 'prev' };
    });
  }, []);

  /** Completing and skipping both end onboarding for good. */
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    useSettingsStore
      .getState()
      .setSetting('onboardingCompleted', true)
      .catch((err) => console.error('Failed to save onboarding state:', err));
    onDone();
    focusSearch();
  }, [onDone]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const onControl = !!target?.closest('button, a, input, textarea, select, [role="switch"]');
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          finish();
          break;
        case 'Enter':
          // Focused buttons activate themselves; otherwise Enter means "the obvious next thing".
          if (onControl) return;
          e.preventDefault();
          document.querySelector<HTMLButtonElement>('[data-onboarding-primary]:not(:disabled)')?.click();
          break;
        case 'ArrowRight':
        case 'ArrowLeft':
          if (target?.matches('input, textarea')) return;
          e.preventDefault();
          move(e.key === 'ArrowRight' ? 1 : -1);
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finish, move]);

  const next = () => move(1);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Keeps the window draggable; native caption buttons draw over the right (or left) edge. */}
      <div className={clsx('app-drag h-11 shrink-0', IS_MAC ? 'pl-[84px]' : 'pr-[148px]')} />

      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex min-h-full items-center justify-center px-6 pb-4">
          <div
            key={step}
            className={clsx(
              'flex w-full justify-center',
              direction === 'next' ? 'animate-step-next' : direction === 'prev' ? 'animate-step-prev' : 'animate-rise-in'
            )}
          >
            {step === 0 && <OnboardingWelcome onContinue={next} />}
            {step === 1 && <OnboardingLibrary onContinue={next} />}
            {step === 2 && <OnboardingSearch onFinish={finish} />}
          </div>
        </div>
      </div>

      <nav aria-label="Onboarding" className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center px-5">
        <div>
          {step > 0 && (
            <Button variant="ghost" icon={<ArrowLeft size={14} />} onClick={() => move(-1)}>
              Back
            </Button>
          )}
        </div>
        <StepDots step={step} />
        <div className="flex justify-end">
          {step < STEP_COUNT - 1 && (
            <Button variant="ghost" className="text-fg-3" onClick={finish}>
              Skip
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only" aria-live="polite">
        Step {step + 1} of {STEP_COUNT}: {STEP_NAMES[step]}
      </span>
      {Array.from({ length: STEP_COUNT }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={clsx(
            'h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out',
            i === step ? 'w-4 bg-accent' : 'w-1.5 bg-line-strong'
          )}
        />
      ))}
    </div>
  );
}
