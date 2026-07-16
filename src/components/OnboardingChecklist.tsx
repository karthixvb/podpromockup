import Link from "next/link";
import type { OnboardingStep } from "@/lib/onboarding";

type Props = {
  steps: OnboardingStep[];
  completed: number;
  total: number;
};

export default function OnboardingChecklist({ steps, completed, total }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const next = steps.find((s) => !s.done);

  return (
    <section className="bg-panel border border-border rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Get set up</h2>
          <p className="text-sm text-muted mt-0.5">
            {completed}/{total} complete · {pct}%
          </p>
        </div>
        {next ? (
          <Link
            href={next.href}
            className="rounded-lg bg-accent hover:bg-accent-hover text-white px-3 py-1.5 text-sm font-medium"
          >
            Continue: {next.label}
          </Link>
        ) : (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-accent/10 text-accent">
            Ready for production
          </span>
        )}
      </div>

      <div className="w-full h-2 rounded-full bg-border overflow-hidden">
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-background"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  step.done
                    ? "bg-accent text-white"
                    : "bg-border text-muted"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{step.label}</span>
                {step.detail ? (
                  <span className="block text-xs text-muted mt-0.5">
                    {step.detail}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
