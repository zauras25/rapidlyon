import {
  Monitor,
  Smartphone,
  PanelsTopLeft,
  Code2,
  SearchCheck,
} from 'lucide-react';

import {
  ServiceTicker,
  type TickerItem,
} from '@/components/ui/service-ticker';

const services: TickerItem[] = [
  {
    title: 'Website UX/UI',
    category: 'UX/UI Design',
    href: '/services/ux-ui-design',
    icon: Monitor,
  },
  {
    title: 'Mobile App UX/UI',
    category: 'App Design',
    href: '/services/ux-ui-design',
    icon: Smartphone,
  },
  {
    title: 'Digital Product Design',
    category: 'Product Design',
    href: '/services/ux-ui-design',
    icon: PanelsTopLeft,
  },
  {
    title: 'Next.js Websites',
    category: 'Responsive Development',
    href: '/services/nextjs-development',
    icon: Code2,
  },
  {
    title: 'SEO & Optimization',
    category: 'Website SEO',
    href: '/services/seo-website-optimization',
    icon: SearchCheck,
  },
];

export function ServicesCarousel() {
  return (
    <ServiceTicker
      heading="What We Design & Build"
      items={services}
    />
  );
}