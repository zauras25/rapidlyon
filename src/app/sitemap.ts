import type { MetadataRoute } from "next";
import { insights, services, siteConfig } from "@/data/site";
import { getPublishedWorkProjects } from "@/lib/work-project-storage";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getPublishedWorkProjects();
  const routes = [
    { path: "/", priority: 1 },
    { path: "/work", priority: 0.8 },
    ...projects.map((project) => ({ path: `/work/${project.slug}`, priority: 0.7 })),
    { path: "/services", priority: 0.9 },
    ...services.map((service) => ({ path: `/services/${service.slug}`, priority: 0.8 })),
    { path: "/pricing", priority: 0.8 },
    { path: "/process", priority: 0.6 },
    { path: "/about", priority: 0.6 },
    { path: "/contact", priority: 0.7 },
    { path: "/discovery", priority: 0.8 },
    { path: "/insights", priority: 0.7 },
    ...insights.map((post) => ({ path: `/insights/${post.slug}`, priority: 0.6 })),
    { path: "/faq", priority: 0.5 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];

  return routes.map(({ path, priority }) => ({
    url: new URL(path, siteConfig.url).toString(),
    changeFrequency: path.startsWith("/insights/") ? "monthly" : "yearly",
    priority,
  }));
}
