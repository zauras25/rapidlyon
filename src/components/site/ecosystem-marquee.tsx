'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';

type Tool = {
  name: string;
  logo: string;
};

const subscribeToReducedMotion = (onChange: () => void) => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const groups: { title: string; tools: Tool[] }[] = [
  {
    title: 'Design',
    tools: [
      { name: 'Figma', logo: 'figma' },
      { name: 'FigJam', logo: 'figjam' },
      { name: 'Flowchart', logo: 'flowchart' },
      { name: 'Miro', logo: 'miro' },
    ],
  },
  {
    title: 'Development',
    tools: [
      { name: 'Next.js', logo: 'nextdotjs' },
      { name: 'React', logo: 'react' },
      { name: 'TypeScript', logo: 'typescript' },
      { name: 'GitHub', logo: 'github' },
      { name: 'Vercel', logo: 'vercel' },
      { name: 'Supabase', logo: 'supabase' },
    ],
  },
  {
    title: 'SEO & Analytics',
    tools: [
      { name: 'Search Console', logo: 'googlesearchconsole' },
      { name: 'Google Analytics', logo: 'googleanalytics' },
      { name: 'Tag Manager', logo: 'googletagmanager' },
    ],
  },
];

function LogoArtwork({ tool }: { tool: Tool }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="rapid-logo-fallback">{tool.name}</span>;
  }

  return (
    <Image
      src={`/brand-logos/${tool.logo}.svg`}
      alt={tool.name}
      width={44}
      height={44}
      loading="lazy"
      unoptimized
      onError={() => setFailed(true)}
    />
  );
}

function ToolCarousel({
  title,
  tools,
  initialIndex,
}: {
  title: string;
  tools: Tool[];
  initialIndex: number;
}) {
  const [index, setIndex] = useState(initialIndex % tools.length);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    prefersReducedMotion,
    () => false
  );

  useEffect(() => {
    if (paused || reduceMotion) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % tools.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, tools.length]);

  const move = (direction: number) => {
    setIndex((current) =>
      (current + direction + tools.length) % tools.length
    );
  };

  const tool = tools[index];

  return (
    <div
      className="rapid-logo-group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false);
        }
      }}
    >
      <h3 className="rapid-logo-heading">{title}</h3>

      <div className="rapid-logo-carousel">
        <button
          type="button"
          className="rapid-logo-arrow"
          aria-label={`Previous ${title} technology`}
          onClick={() => move(-1)}
        >
          &#8592;
        </button>

        <div className="rapid-logo-view" aria-live="off">
          <div className="rapid-logo-slide" key={tool.name}>
            <div className="rapid-logo-symbol">
              <LogoArtwork key={tool.logo} tool={tool} />
            </div>
            <span className="rapid-logo-name">{tool.name}</span>
          </div>
        </div>

        <button
          type="button"
          className="rapid-logo-arrow"
          aria-label={`Next ${title} technology`}
          onClick={() => move(1)}
        >
          &#8594;
        </button>
      </div>

      <div className="rapid-logo-indicators" aria-hidden="true">
        {tools.map((item, position) => (
          <span
            className={
              'rapid-logo-indicator' +
              (position === index ? ' is-active' : '')
            }
            key={item.name}
          />
        ))}
      </div>
    </div>
  );
}

export function EcosystemMarquee() {
  return (
    <section className="rapid-logo-section" aria-label="Technology ecosystem">
      <div className="shell rapid-logo-layout">
        {groups.map((group, index) => (
          <ToolCarousel
            key={group.title}
            title={group.title}
            tools={group.tools}
            initialIndex={index}
          />
        ))}
      </div>
    </section>
  );
}