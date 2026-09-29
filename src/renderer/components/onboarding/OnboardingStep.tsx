import { useEffect, useId, useRef, type ReactNode } from 'react';

interface OnboardingStepProps {
  /** Brand moment above the title (step one only). */
  lead?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** The step's small demonstration. */
  visual?: ReactNode;
  actions: ReactNode;
  footnote?: ReactNode;
}

/**
 * Shared layout for one onboarding step: title, one line of copy, a visual
 * and the step's actions, centered. The title takes focus when the step
 * appears so screen readers announce it and Enter / arrows keep working.
 */
export function OnboardingStep({ lead, title, description, visual, actions, footnote }: OnboardingStepProps) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section aria-labelledby={titleId} className="flex w-full max-w-[680px] flex-col items-center text-center">
      {lead}
      <h1
        ref={headingRef}
        id={titleId}
        tabIndex={-1}
        className="text-balance font-display text-2xl font-semibold tracking-[-0.02em] text-fg focus-visible:outline-none [@media(max-height:600px)]:text-xl"
      >
        {title}
      </h1>
      <p className="mt-2 max-w-[480px] text-balance text-lg text-fg-2 [@media(max-height:600px)]:text-base">{description}</p>
      {visual && <div className="mt-7 w-full [@media(max-height:600px)]:mt-5">{visual}</div>}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2 [@media(max-height:600px)]:mt-5">{actions}</div>
      {footnote && <div className="mt-4 [@media(max-height:600px)]:mt-3">{footnote}</div>}
    </section>
  );
}
