import { workProjectSchema, type WorkProject } from "@/lib/work-project-schema";

export type NavItem = {
  label: string;
  href: string;
};

export type Service = {
  slug: string;
  title: string;
  eyebrow: string;
  short: string;
  description: string;
  audience: string;
  problems: string[];
  deliverables: string[];
  capabilities: { group: string; items: string[] }[];
  process: { title: string; text: string }[];
  faqs: { question: string; answer: string }[];
  relatedProjectSlugs?: string[];
};

export type Project = WorkProject;

export const siteConfig = {
  brand: "Rapidlyon",
  description: "Rapidlyon brings Product Design, Next.js Development, and SEO together to shape, build, and improve digital products and websites.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://rapidlyon.com",
  email: "hello@rapidlyon.com",
  address: "Remote-first studio; project fit and working hours are confirmed during discovery.",
  navigation: [
    { label: "Work", href: "/work" },
    { label: "Services", href: "/services" },
    { label: "Pricing", href: "/pricing" },
    { label: "Resources", href: "/insights" },
    { label: "FAQ", href: "/faq" },
    { label: "Contact", href: "/contact" },
  ] satisfies NavItem[],
};

const sharedServiceProcess = [
  { title: "Discover", text: "Understand the audience, problem, goals, available evidence, and constraints." },
  { title: "Define", text: "Agree the priorities, structure, scope, and decisions needed for the work." },
  { title: "Design", text: "Shape the product and interface direction to fit the agreed needs." },
  { title: "Build", text: "Implement the approved experience with clear review points and scope." },
  { title: "Optimize", text: "Review the live-ready experience and prioritize agreed technical or search improvements." },
];

export const services: Service[] = [
  {
    slug: "ux-ui-design",
    title: "Product Design",
    eyebrow: "Define the product experience",
    short: "Clarify product journeys, information structure, and interface decisions before and during implementation.",
    description: "Product Design brings user needs, product goals, and practical constraints into one clear experience direction. The scope can include structure, flows, wireframes, interface design, and implementation handoff as appropriate.",
    audience: "Teams shaping a new digital product or improving an existing product experience.",
    problems: [
      "The product direction or priority user journeys are still unclear.",
      "People have difficulty finding their way through the current experience.",
      "Design decisions need to be made before implementation begins.",
    ],
    deliverables: [
      "Information architecture and user flows",
      "Wireframes and prototypes when included in scope",
      "Interface designs and responsive states",
      "Design handoff notes for implementation",
    ],
    capabilities: [
      { group: "Product structure", items: ["Product and page hierarchy", "Information architecture", "User flows and interaction states"] },
      { group: "Interface design", items: ["Wireframes where useful", "Responsive UI design", "Reusable interface patterns"] },
      { group: "Delivery", items: ["Prototype direction where agreed", "Design review and iteration", "Developer handoff"] },
    ],
    process: sharedServiceProcess,
    faqs: [
      { question: "Does every Product Design project include user research?", answer: "No. Research methods are included only when they are agreed as part of the project scope and suitable evidence can be gathered." },
      { question: "Can Product Design continue into development?", answer: "Yes. Product Design can be scoped alongside Next.js Development so decisions and implementation can be coordinated." },
    ],
    relatedProjectSlugs: ["trailmix-local-discovery-concept"],
  },
  {
    slug: "nextjs-development",
    title: "Next.js Development",
    eyebrow: "Build the agreed experience",
    short: "Develop responsive digital experiences with Next.js, reusable components, and implementation choices suited to the project.",
    description: "Next.js Development turns an agreed product or website direction into a working web experience. Scope is confirmed around the routes, content, integrations, and technical requirements; not every project needs the same stack or architecture.",
    audience: "Teams building or extending a website or web product that fits Next.js.",
    problems: [
      "An approved design needs a responsive, production-minded implementation.",
      "A growing site needs a clearer component and route structure.",
      "The project needs its content, interface, and agreed integrations brought together.",
    ],
    deliverables: [
      "Next.js implementation for the agreed routes and features",
      "Responsive interface and reusable components",
      "Agreed content or API integrations",
      "Production build and scoped pre-launch checks",
    ],
    capabilities: [
      { group: "Application", items: ["Next.js and React implementation", "Route and page structure", "Server/client boundaries as appropriate"] },
      { group: "Interface", items: ["Responsive layout implementation", "Reusable components", "Accessible interaction patterns"] },
      { group: "Integration & delivery", items: ["Agreed API or content integrations", "Metadata and technical SEO foundations", "Build, QA, and deployment preparation"] },
    ],
    process: sharedServiceProcess,
    faqs: [
      { question: "Is every website built with Next.js?", answer: "No. Next.js is the focused development capability; the appropriate platform and scope are discussed before work is agreed." },
      { question: "Can you work from existing designs?", answer: "Yes. Existing designs and content can be reviewed as part of scope, with any gaps or implementation questions clarified before build." },
    ],
  },
  {
    slug: "seo-website-optimization",
    title: "SEO",
    eyebrow: "Make the site structurally discoverable",
    short: "Build a sound search foundation through technical review, page structure, metadata, and practical content recommendations.",
    description: "SEO focuses on the technical and on-page foundations that help people and search engines understand a site. Work is based on the site and evidence available; rankings, traffic, and leads are not guaranteed.",
    audience: "Organizations that need to review or improve the discoverability and search foundations of an existing or new site.",
    problems: [
      "Important pages or information are difficult to discover or understand.",
      "Metadata, indexability, or internal linking needs review.",
      "Content structure and technical foundations need practical priorities.",
    ],
    deliverables: [
      "Technical SEO and indexability review",
      "Metadata and semantic-structure recommendations",
      "Internal-link and content-structure recommendations",
      "Agreed implementation and validation support",
    ],
    capabilities: [
      { group: "Technical foundations", items: ["Indexability and canonical review", "Sitemap and robots checks"] },
      { group: "On-page structure", items: ["Titles and descriptions", "Heading and semantic structure", "Internal linking"] },
      { group: "Content & experience", items: ["Content/Insights opportunities", "Performance considerations", "Prioritized technical recommendations"] },
    ],
    process: sharedServiceProcess,
    faqs: [
      { question: "Can SEO guarantee search rankings or traffic?", answer: "No. Search outcomes depend on many factors outside a project’s control. The work focuses on verifiable technical and on-page improvements." },
      { question: "Can SEO be included while a site is being built?", answer: "Yes. SEO foundations can be considered alongside Product Design and Next.js Development rather than treated only as post-launch work." },
    ],
  },
];

export const legacyServiceRedirects: Record<string, string> = {
  "web-development": "nextjs-development",
  "saas-mvp": "ux-ui-design",
  "website-redesign": "ux-ui-design",
};

export const featuredProjects: Project[] = [
  workProjectSchema.parse({
    slug: "umer-mobile-parts",
    title: "Umer Mobile Parts",
    discipline: "development",
    projectContext: "personal",
    status: "published",
    isFeatured: true,
    displayOrder: 1,
    projectType: "Deployed e-commerce storefront",
    summary:
      "A deployed wholesale and retail storefront for mobile spare parts, with product search, category browsing, brand navigation, and featured listings.",
    role: "Independent personal project",
    clientOrContext: "Independent personal project for a mobile-parts retailer",
    visibilityLabel: "Deployed personal project",
    services: ["E-commerce", "Website Development"],
    objective: "Create a public storefront where shoppers can enter the mobile-parts catalog through search, part categories, or mobile-brand navigation.",
    context: "The public site presents a wholesale-and-retail storefront for mobile spare parts, with product discovery and retailer messaging.",
    challenge: "Make a broad catalog navigable through product search, part categories, and brand or model listings.",
    development: {
      implementation: {
        summary: "The deployed storefront exposes these product and business pathways.",
        points: [
          "Product search and category navigation are present in the public interface.",
          "Mobile-brand navigation and model labels appear in the storefront.",
          "The homepage includes featured and additional product-listing sections.",
          "Wholesale messaging and customer-support pathways.",
        ],
      },
    },
    seoEvidence: {
      summary: "A review of the deployed homepage found a descriptive page title and meta description, with one primary heading followed by section and product headings.",
      verified: [
        "The document title is “Umer Mobile Parts.”",
        "The meta description describes mobile spare parts, product types, and wholesale supplies.",
        "The homepage uses one H1, followed by H2 section headings and H3 product headings.",
      ],
      evidenceNote: "No canonical URL or Open Graph image was present on the inspected homepage. No search-ranking or measured performance results are available.",
    },
    responsiveEvidence: {
      summary: "A browser viewport review of the public homepage found no horizontal overflow at the tested widths.",
      viewportWidths: [320, 375, 430, 768, 1024, 1280, 1440, 1920],
      evidenceNote: "This checks page fit at these viewport widths only; it does not verify every store flow or constitute user testing.",
    },
    observedJourneys: [
      "The homepage presents product search as an entry point to the catalog.",
      "Part categories and mobile brands are presented as browse entry points.",
      "Product cards present product names, model labels, prices, and availability fields.",
    ],
    visibleExperienceChoices: [
      "Product discovery is exposed through search and category entry points.",
      "Visible catalog sections are organized around part type and mobile brand.",
      "Wholesale messaging is presented alongside retail product discovery.",
    ],
    verifiedOutcomes: [],
    evidenceNote: "During review, the deployed site displayed a catalog-sync error and demo product data. Catalog synchronization and order completion are therefore not claimed as verified. No business or user-outcome data is published.",
    liveUrl: "https://umer-mobile-green-site.vercel.app/",
    gallery: [],
  }),
  workProjectSchema.parse({
    slug: "trailmix-local-discovery-concept",
    title: "TrailMix — local discovery concept",
    discipline: "ux-design",
    projectContext: "concept",
    status: "published",
    isFeatured: true,
    displayOrder: 2,
    projectType: "Speculative UX/UI concept",
    summary:
      "A portfolio concept exploring how a local discovery app could help people find a nearby activity that fits their time, interests, and group.",
    role: "Self-initiated concept · UX/UI design",
    clientOrContext: "Fictional brief created for portfolio demonstration",
    visibilityLabel: "Concept project · not client work",
    services: ["Product discovery", "UX design", "Information architecture", "Wireframes", "UI concept"],
    objective:
      "Explore a clearer path from “what can we do nearby?” to a small set of relevant local activities, with enough detail to decide what to do next.",
    context:
      "This is a speculative concept based on an invented brief. The scenario assumes people may have limited time, mixed interests, and different group needs when choosing something nearby. Those assumptions have not been confirmed through research.",
    challenge:
      "Avoid making discovery feel like another endless feed. The concept focuses on narrowing options through a few practical choices, then showing useful details before asking someone to commit.",
    uxDesign: {
      discovery: {
        summary:
          "Started from a fictional portfolio brief, not client research. The initial assumptions were that people need quick ways to express available time, location, and activity preferences.",
        points: [
          "Defined the concept audience as people looking for a nearby activity, alone or with others.",
          "Recorded time, distance, group needs, and uncertainty about availability as assumptions to validate.",
          "No interviews, analytics review, or field research were conducted for this fictional concept.",
        ],
      },
      define: {
        summary:
          "Framed the experience around helping someone make a confident short-list, rather than browsing an unfiltered catalog.",
        points: [
          "Primary concept task: find and compare a few suitable activities nearby.",
          "Keep the first decision set lightweight: when, how far, and what kind of activity.",
          "Show practical decision details—duration, location, accessibility notes, and booking requirements—before an external action.",
        ],
      },
      sitemapAndIa: {
        summary:
          "Grouped the concept around discovery, activity details, saved ideas, and a simple profile area.",
        points: [
          "Explore: set a time window, area, and interest, then review a focused list or map.",
          "Activity detail: understand the experience, practical requirements, and next step.",
          "Saved: keep a short-list to compare or share with a group.",
          "Account features and booking are illustrative directions only; no backend or live service exists.",
        ],
      },
      wireframes: {
        summary:
          "Outlined the key screens before adding visual styling, with emphasis on progressive choices and useful activity information.",
        points: [
          "Explore entry with a clear location and activity prompt.",
          "Results state with filter controls, concise activity cards, and a map/list choice.",
          "Detail page that surfaces duration, distance, suitability, and booking context.",
          "Empty and no-results states that let a person broaden the search instead of restarting.",
        ],
      },
      uiDesign: {
        summary:
          "Developed a visual direction for an approachable local guide: calm neutral surfaces, a warm accent, clear type hierarchy, and distinct activity categories.",
        points: [
          "Prioritized readable activity cards and scannable practical details.",
          "Used category color as a supporting cue, not the only way to identify an activity.",
          "Considered loading, selected-filter, no-results, and saved states as part of the concept.",
        ],
      },
      designAudit: {
        summary:
          "Reviewed the proposed screens against the concept goals and common interface-quality checks. This was a self-review, not an independent audit.",
        points: [
          "Checked that filters and selected states are distinguishable.",
          "Checked content hierarchy for activity name, location, duration, and action.",
          "Flagged contrast, keyboard behavior, responsive layouts, and real content quality for validation in a future build.",
        ],
      },
      prototypeTesting: {
        summary:
          "No usability testing was conducted. Testing is a proposed next step, not a result of this concept.",
        points: [
          "Next validation step: ask representative people to find an activity for a specific time, distance, and group.",
          "Observe whether they can compare options and identify booking requirements without prompting.",
          "Revise the flow based on observed confusion; no success metrics or usability findings are claimed here.",
        ],
      },
      developerHandoff: {
        summary:
          "Outlined what a future handoff would need; this concept has not been implemented or delivered to a development team.",
        points: [
          "Document responsive behavior, filter states, empty states, and activity-detail content requirements.",
          "Define reusable activity-card and filter components after validating the information model.",
          "Confirm data source, availability, map, and booking integrations before estimating implementation.",
        ],
      },
    },
    observedJourneys: [],
    visibleExperienceChoices: [
      "Concept direction: choose a time window, distance, and activity interest before browsing.",
      "Concept direction: compare activity details before leaving for booking or directions.",
      "Concept direction: save or share a short-list when choosing with other people.",
    ],
    verifiedOutcomes: [],
    evidenceNote:
      "Fictional portfolio concept only—not commissioned client work, a live product, or a validated design. The brief and user needs are assumptions; no user interviews, usability tests, implementation, or outcome metrics are claimed.",
    gallery: [],
  }),
];

export const faqs = [
  {
    question: "What does a typical project engagement look like?",
    answer:
      "We start by understanding the audience, goals, available materials, and constraints. Then we confirm a written scope and move through the agreed design or development work, review, QA where relevant, and handoff. The exact steps depend on the service and package you choose.",
  },
  {
    question: "What Product Design work can you help with?",
    answer:
      "Depending on the agreed scope, Product Design can include discovery, defining priorities, sitemap and information architecture, wireframes, interface design, a clickable prototype, design review, and developer handoff. Research and usability testing are included only when they are explicitly part of the project scope.",
  },
  {
    question: "Can I request design only, development only, or both?",
    answer:
      "Yes. You can choose Product Design, Next.js Development from approved designs, or the combined Product Design + Next.js Development engagement. The Pricing page compares the available starting scopes for these options.",
  },
  {
    question: "How is my project price determined?",
    answer:
      "Prices on the Pricing page are one-time USD starting fees for the listed page, template, and deliverable limits. The final quote depends on the number of pages and unique layouts, readiness of designs and content, required interactions or integrations, and any additional research or features. We confirm the exact scope and fee in writing before work begins.",
  },
  {
    question: "What is included in a package, and what may cost extra?",
    answer:
      "Each package lists its page or template limits, deliverables, and design revision rounds. Work beyond those limits—including unlisted features, extra templates, custom backend systems, accounts, e-commerce, copywriting, or paid third-party services—is not automatically included and must be scoped and approved separately.",
  },
  {
    question: "How do design revision rounds work?",
    answer:
      "A revision round is one consolidated set of feedback on the presented design, followed by updates within the agreed direction. The number of rounds depends on the selected package. A new direction, additional feature, or substantial scope change may need a separate estimate and written approval.",
  },
  {
    question: "Can you build a website from designs my team already has?",
    answer:
      "Yes. Next.js Development can start from approved designs, provided the required screens, responsive behavior, content, and assets are ready or clearly listed in the scope. If important states or requirements are missing, we will identify them before confirming the build estimate.",
  },
  {
    question: "Do your packages automatically include a custom backend, accounts, or e-commerce?",
    answer:
      "No. These features are not automatically included in the listed starting packages. Share what the product needs to do and we can assess the technical requirements, dependencies, and a separate written scope and quote.",
  },
  {
    question: "What if I do not have a finished brief yet?",
    answer:
      "That is okay. You can start with the short guided conversation or email us directly; a sentence or two is enough to begin. If you already know more detail, the longer Project Discovery form lets you share goals, services, requirements, and references.",
  },
  {
    question: "When is a project considered booked, and how do we agree the scope?",
    answer:
      "An enquiry or discovery request is a lead, not an accepted project or binding quote. After reviewing fit and feasibility, we define the objective, deliverables, exclusions, assumptions, milestones and estimated timeline, price, revisions, approvals, dependencies, and client responsibilities in writing. Any change to agreed scope is reviewed for cost and schedule impact and approved before work changes. Work begins only after the agreement and payment terms are accepted; meeting times are confirmed separately.",
  },
  {
    question: "Can you guarantee search rankings or traffic?",
    answer:
      "No. SEO work can address technical foundations, metadata, indexability, performance, accessibility, and content recommendations. Search rankings and traffic depend on external factors and are not guaranteed.",
  },
  {
    question: "Are the UX projects in the Work section client projects?",
    answer:
      "Each project is labeled with its context. TrailMix is a fictional, self-initiated UX concept—not commissioned client work or a validated product. Umer Mobile Parts is shown separately as a live personal development project; its case study does not claim that a UX process was carried out.",
  },
  {
    question: "Do you work with remote teams?",
    answer:
      "Yes. Rapidlyon is remote-first and works with founders and teams in different locations. We can collaborate with your existing product, marketing, and engineering stakeholders around the deliverables agreed for the project.",
  },
];

export const principles = [
  "Start with the user problem, not the trend.",
  "Design with clarity before complexity.",
  "Build digital experiences that stay honest and useful over time.",
  "Keep product decisions grounded in real constraints and business context.",
  "Ship work that is durable, accessible, and easy to evolve.",
];

export const processSteps = [
  { title: "Discover", text: "Understand the client, audience, problem, business model, desired outcomes, and constraints." },
  { title: "Qualify", text: "Review service fit, feasibility, dependencies, budget and timeline compatibility, and delivery capacity. A request is not accepted automatically." },
  { title: "Scope & estimate", text: "Define the objective, deliverables, exclusions, assumptions, milestones, estimated timeline, price, revisions, approvals, and client responsibilities." },
  { title: "Proposal & agreement", text: "Share the proposed work in writing. Agree change-request handling, agreement terms, and payment conditions before project activation." },
  { title: "Design & deliver", text: "Work through the approved design, development, or optimization scope with visible decisions and client communication." },
  { title: "Review & approve", text: "Review deliverables against the agreed scope, collect consolidated feedback, and resolve included revisions." },
  { title: "Launch & hand off", text: "Complete agreed launch tasks, transfer deliverables, and confirm any remaining dependencies." },
  { title: "Improve", text: "Discuss ongoing maintenance or iteration as a separately agreed next scope." },
];

export const insights = [
  {
    slug: "clarity-before-complexity",
    title: "Clarity before complexity: designing digital products people can trust",
    category: "Design thinking",
    readTime: "5 min read",
    excerpt: "A simple strategy for removing friction from product experiences before layering on new features.",
    content: [
      "When a product feels difficult, adding another feature is rarely the first useful move. Start by identifying the task a person came to complete, what they need to know at each step, and where uncertainty interrupts progress.",
      "Sketch the current journey as observable steps rather than assumptions about intent. Look for duplicate decisions, unexplained language, and points where users must remember information from elsewhere. Those are practical places to investigate before proposing a redesign.",
      "A clearer experience makes the next action understandable and gives people enough context to choose it. Keep the interface focused, test the flow with representative users, and treat new functionality as a response to evidence—not a substitute for it.",
    ],
  },
  {
    slug: "websites-that-convert-without-feeling-salesy",
    title: "Websites that convert without feeling salesy",
    category: "Web strategy",
    readTime: "4 min read",
    excerpt: "How to structure value, trust, and opportunity in a way that feels confident instead of crowded.",
    content: [
      "A useful business website helps visitors decide whether an offer fits their needs. State who it is for, what problem it addresses, and what happens next in plain language before asking for a commitment.",
      "Trust comes from answering reasonable questions: what is included, what is still unknown, how the work proceeds, and how to get in touch. Specific, verifiable details are more persuasive than inflated claims or decorative urgency.",
      "Give each page one clear next step and make the path easy to find. Then review the experience with people who do not already know the business; their questions reveal where the message needs clarification.",
    ],
  },
  {
    slug: "designing-for-mvp-clarity",
    title: "Designing for MVP clarity",
    category: "Product",
    readTime: "6 min read",
    excerpt: "What to prioritize when the product is small but the ambition is large.",
    content: [
      "An MVP is a way to test an important product assumption, not a smaller version of every planned feature. Define the intended user, the problem to test, and what observation would change the team's next decision.",
      "Map the smallest end-to-end journey that can answer that question. Include the necessary states—first use, invalid input, waiting, completion, and recovery—so a narrow release still feels coherent and usable.",
      "After release, collect feedback tied to the original assumption and distinguish observed behavior from interpretation. Keep, revise, or remove scope based on what the team learns, and make the next experiment explicit.",
    ],
  },
];

export const seoDefaults = {
  title: "Rapidlyon | We turn ideas into digital products.",
  description: siteConfig.description,
};

export const legalNote =
  "This content is provided for business communication and should be reviewed by legal counsel for final compliance and jurisdiction-specific requirements.";
