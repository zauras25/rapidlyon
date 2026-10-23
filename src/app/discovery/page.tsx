import { DiscoveryForm } from "@/components/forms/discovery-form";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Project discovery",
  "Share your audience, business context, project goals, and requirements for Product Design, Next.js Development, or SEO.",
  "/discovery",
);

export default function DiscoveryPage() {
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <section className="mb-10 rounded-card bg-ink p-7 text-on-dark sm:p-10 lg:p-12">
        <p className="text-xs font-medium uppercase tracking-label text-accent">Project discovery</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-display-tight sm:text-5xl lg:text-6xl">
          Start with the problem. Find the right next step.
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-8 text-on-dark/75 sm:text-lg">
          Tell us about your business, users, and product goals. This guided conversation adapts to the services you select and usually takes around 8–12 minutes. You can skip questions you have not decided yet.
        </p>
        <div className="mt-7 grid gap-4 border-t border-on-dark/15 pt-6 text-sm leading-6 text-on-dark/75 sm:grid-cols-3">
          <p><strong className="text-on-dark">1. Share context</strong><br />Business, services, and requirements.</p>
          <p><strong className="text-on-dark">2. Choose a format</strong><br />Self-guided, interview, or walkthrough.</p>
          <p><strong className="text-on-dark">3. We follow up</strong><br />A request is not a confirmed booking.</p>
        </div>
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <DiscoveryForm calendlyUrl={calendlyUrl} />
        <aside className="rounded-panel border border-divider bg-surface p-6 text-sm leading-6 text-body">
          <h2 className="text-base font-semibold text-ink">A few helpful notes</h2>
          <ul className="mt-4 space-y-3">
            <li>Your text answers are saved locally in this browser. Use “Clear saved draft” to remove them; attachments are not saved until final submission.</li>
            <li>Required questions are marked with an asterisk. Estimates and early ideas are welcome.</li>
            <li>Meeting times are requests, not bookings. We will confirm a time with you by email.</li>
            <li>Form data and attachments are submitted only after you give consent on the review step.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
