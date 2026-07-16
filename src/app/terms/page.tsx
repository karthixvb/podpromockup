import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <Link href="/login" className="text-sm text-accent font-medium">
          ← Back
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted">Last updated: July 16, 2026</p>
        <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
          <p>
            POD Pro is a multi-store print-on-demand operations tool. By creating
            an account you agree to use the service lawfully, keep Shopify access
            credentials secure, and accept responsibility for products published
            to your stores.
          </p>
          <p>
            The service is provided as-is. We may update features, scopes, and
            pricing. Continued use after changes constitutes acceptance.
          </p>
          <p>
            You retain ownership of your designs and store data. You grant us
            permission to process images and product data solely to provide the
            service.
          </p>
        </div>
      </div>
    </div>
  );
}
