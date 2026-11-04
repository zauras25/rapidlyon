import Link from 'next/link';
import type { ComponentType } from 'react';

export type TickerItem = {
  title: string;
  category: string;
  href: string;
  icon: ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
};

type ServiceTickerProps = {
  heading: string;
  items: TickerItem[];
  ariaLabel?: string;
};

export function ServiceTicker({
  heading,
  items,
  ariaLabel = 'Explore our services',
}: ServiceTickerProps) {
  if (!items.length) return null;

  const renderItems = (duplicate: boolean) => (
    <div
      className="ds-ticker-set"
      aria-hidden={duplicate ? true : undefined}
    >
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.title}
            href={item.href}
            className="ds-ticker-item"
            tabIndex={duplicate ? -1 : undefined}
          >
            <Icon
              size={22}
              strokeWidth={1.75}
              className="ds-ticker-icon"
            />

            <span className="ds-ticker-copy">
              <span className="ds-ticker-title">
                {item.title}
              </span>
              <span className="ds-ticker-meta">
                {item.category}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <section className="ds-ticker" aria-label={ariaLabel}>
      <div className="shell ds-ticker-layout">
        <h2 className="ds-ticker-heading">{heading}</h2>

        <div className="ds-ticker-viewport">
          <div className="ds-ticker-track">
            {renderItems(false)}
            {renderItems(true)}
          </div>
        </div>
      </div>
    </section>
  );
}