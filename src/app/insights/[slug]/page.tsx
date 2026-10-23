import Link from "next/link";
import { notFound } from "next/navigation";
import { insights } from "@/data/site";
import { createPageMetadata } from "@/lib/metadata";
import { PageHero } from "@/components/ui/page-hero";

export function generateStaticParams() {
  return insights.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const post = insights.find((item) => item.slug === slug);

    if (!post) {
      return { title: "Resource not found", robots: { index: false, follow: false } };
    }

    return createPageMetadata(post.title, post.excerpt, `/insights/${slug}`);
  });
}

export default async function InsightDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = insights.find((item) => item.slug === slug);

  if (!post) {
    notFound();
  }

  return (
    <div className="bg-paper">
      <PageHero eyebrow={post.category} title={post.title} description={post.excerpt}>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-body-muted">
          <span>{post.readTime}</span>
          <Link href="/insights" className="font-semibold text-ink underline decoration-divider-strong underline-offset-4 hover:decoration-ink">Back to resources</Link>
        </div>
      </PageHero>
      <div className="ds-shell pb-20 sm:pb-24">
        <article className="mx-auto max-w-4xl rounded-card border border-divider bg-surface p-7 shadow-soft-floating sm:p-10">
          <div className="space-y-6 text-base leading-8 text-body">
            {post.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </article>
      </div>
    </div>
  );
}
