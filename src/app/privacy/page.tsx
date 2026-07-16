import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        <Link href="/login" className="text-sm text-accent font-medium">
          ← Back
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted">Last updated: July 16, 2026</p>
        <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
          <p>
            We collect account email, hashed passwords, connected shop domains,
            access tokens, and operational data (templates, batches, sync logs)
            needed to run POD Pro.
          </p>
          <p>
            Image files may be stored in your configured object storage. Shopify
            tokens are used only to manage products and publications for shops
            you connect.
          </p>
          <p>
            We do not sell personal data. Contact support to request account
            deletion. Replace this page with counsel-reviewed terms before App
            Store listing.
          </p>
        </div>
      </div>
    </div>
  );
}
