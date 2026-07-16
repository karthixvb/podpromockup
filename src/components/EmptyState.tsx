import Link from "next/link";

type Props = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export default function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
}: Props) {
  return (
    <div className="bg-panel border border-border rounded-lg px-6 py-10 text-center space-y-3">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
        {description}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="rounded-lg bg-accent hover:bg-accent-hover text-white px-4 py-2 text-sm font-medium"
          >
            {actionLabel}
          </Link>
        ) : null}
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-background"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
