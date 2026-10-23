import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { services, siteConfig } from "@/data/site";

const currentYear = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="border-t border-divider bg-ink text-paper">
      <div className="ds-shell grid gap-10 py-12 lg:grid-cols-[1.4fr_0.8fr_0.8fr_1.2fr]">
        <div>
          <div className="inline-flex rounded-control bg-paper px-3 py-2"><Image src="/brand/rapidlyon-uploaded-logo.svg" alt={siteConfig.brand} width={1400} height={450} className="w-36 sm:w-40" /></div>
          <p className="mt-4 max-w-sm text-sm leading-7 text-paper/65">
            {siteConfig.description}
          </p>
        </div>

        <div>
          <p className="ds-eyebrow !text-accent">Navigate</p>
          <ul className="mt-4 space-y-3 text-sm text-paper-raised">
            <li><Link href="/work" className="transition-colors hover:text-on-dark">Work</Link></li>
            <li><Link href="/services" className="transition-colors hover:text-on-dark">Services</Link></li>
            <li><Link href="/pricing" className="transition-colors hover:text-on-dark">Pricing & project options</Link></li>
            <li><Link href="/about" className="transition-colors hover:text-on-dark">About</Link></li>
            <li><Link href="/process" className="transition-colors hover:text-on-dark">Process</Link></li>
            <li><Link href="/insights" className="transition-colors hover:text-on-dark">Resources</Link></li>
            <li><Link href="/faq" className="transition-colors hover:text-on-dark">FAQ</Link></li>
            <li><Link href="/contact" className="transition-colors hover:text-on-dark">Contact</Link></li>
          </ul>
        </div>

        <div>
          <p className="ds-eyebrow !text-accent">Core services</p>
          <ul className="mt-4 space-y-3 text-sm text-paper-raised">
            {services.map((service) => (
              <li key={service.slug}><Link href={`/services/${service.slug}`} className="transition-colors hover:text-on-dark">{service.title}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <p className="ds-eyebrow !text-accent">Contact</p>
          <ul className="mt-4 space-y-3 text-sm text-paper-raised">
            <li><a href={`mailto:${siteConfig.email}`} className="transition-colors hover:text-on-dark">{siteConfig.email}</a></li>
            <li>{siteConfig.address}</li>
            <li className="pt-2">
              <Link href="/contact?intent=conversation" className="inline-flex items-center gap-2 text-accent transition-colors hover:text-accent-bright">
                Talk to us <ArrowUpRight size={16} />
              </Link>
            </li>
            <li>
              <Link href="/discovery" className="inline-flex items-center gap-2 text-accent transition-colors hover:text-accent-bright">
                Start a project <ArrowUpRight size={16} />
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-on-dark/10">
        <div className="ds-shell flex flex-col gap-4 py-5 text-sm text-paper/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} {siteConfig.brand}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-on-dark">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-on-dark">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
