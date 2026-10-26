import { Suspense } from "react";
import { ContactEnquiry } from "@/components/forms/contact-enquiry";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata(
  "Contact",
  "Choose how to start a conversation with Rapidlyon: email directly or send a context-aware project enquiry.",
  "/contact",
);

export default function ContactPage() {
  return (
    <div className="rp-page rp-contact bg-paper">
      <Suspense
        fallback={
          <div role="status" className="rounded-card border border-divider bg-surface p-8 text-sm text-body-muted">
            Preparing the right enquiry form…
          </div>
        }
      >
        <ContactEnquiry />
      </Suspense>
    </div>
  );
}
