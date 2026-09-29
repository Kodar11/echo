import clsx from "clsx";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  size?: "sm" | "md";
}

const sizes = {
  sm: {
    track: "h-5 w-9",
    knob: "h-4 w-4",
    checked: "translate-x-[18px]",
    unchecked: "translate-x-0.5",
  },
  md: {
    track: "h-6 w-11",
    knob: "h-5 w-5",
    checked: "translate-x-[22px]",
    unchecked: "translate-x-0.5",
  },
} as const;

export function Toggle({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  size = "sm",
}: ToggleProps) {
  const s = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => !disabled && onChange(!checked)}
      className={clsx(
        "relative inline-flex shrink-0 items-center rounded-full",
        "border-2 shadow-sm transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2",
        "active:scale-95",
        s.track,
        checked
          ? "border-(--accent) bg-(--accent)"
          : "border-(--border-strong) bg-(--panel)",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:border-(--accent)"
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          "absolute top-1/2 -translate-y-1/2 rounded-full",
          "bg-(--surface) border border-(--border) shadow-md",
          "transition-transform duration-200 ease-out",
          s.knob,
          checked ? s.checked : s.unchecked
        )}
      />
    </button>
  );
}