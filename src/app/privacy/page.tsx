import { siteConfig } from "@/data/site";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Privacy policy",
  "How Rapidlyon handles contact, business, project, discovery, attachment, and review information submitted through this website.",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-card border border-divider bg-surface p-8">
        <p className="text-xs uppercase tracking-label text-muted">Privacy</p>
        <h1 className="mt-4 text-4xl tracking-display-wide text-ink">Privacy policy</h1>
        <div className="mt-8 space-y-6 text-base leading-8 text-body">
          <p>This notice describes information handled by the Rapidlyon website. When you submit a project enquiry or discovery request, the form may collect your name, email address, company or brand, country, time zone, industry, business stage, website address, service choices, project goals, budget and timing information, answers you provide, and files you choose to attach.</p>
          <p>The discovery form also saves a draft of your text answers in local browser storage so you can return to it on the same browser. Attachments are not stored in that draft. You can clear the draft from the form; clearing browser site data also removes it. Avoid entering passwords, payment details, or other sensitive information.</p>
          <p>Submitted enquiries and discovery requests are used to assess and respond to your request. Discovery attachments are stored in a private Supabase Storage bucket and are available to the studio through its protected administration tools. Review submissions are held for moderation; if approved, the submitted name, rating and review text may be published on this site.</p>
          <p>Form submission and review storage require the website&apos;s Supabase service to be configured. Hosting and data-storage providers may process information to operate the service. The studio does not publish a fixed retention period in this notice; contact us to ask about access, correction or deletion of information you submitted.</p>
          <p>For privacy questions or requests, email <a className="underline underline-offset-4" href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>. Before public launch, the business owner must confirm the data controller details, provider/subprocessor list, retention schedule, international transfer arrangements and applicable legal requirements with qualified counsel. This site copy is not a substitute for that approval.</p>
        </div>
      </div>
    </div>
  );
}
