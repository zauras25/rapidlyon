"use client";

import { useId, useState } from "react";
import { ArrowRight, Check, Info, Sparkles } from "lucide-react";

import { PricingAssistant } from "@/components/pricing/pricing-assistant";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type PackageMode = "design" | "development" | "bundle";

type AddOn = {
  id: string;
  name: string;
  description: string;
  price: number;
  modes: PackageMode[];
};

const modes: {
  id: PackageMode;
  label: string;
  description: string;
}[] = [
  {
    id: "design",
    label: "Product Design",
    description:
      "Plan the experience, design responsive interfaces, prototype interactions, and prepare developer handoff.",
  },
  {
    id: "development",
    label: "Next.js Development",
    description:
      "Build responsive Next.js pages from approved designs and supplied content, then test and prepare for launch.",
  },
  {
    id: "bundle",
    label: "Product Design + Next.js Development",
    description:
      "Coordinate Product Design and Next.js Development in one engagement with a bundle saving.",
  },
];

const packages = [
  {
    id: "standard",
    name: "Standard",
    minPages: 1,
    maxPages: 5,
    templates: 3,
    revisions: 2,
    prices: { design: 450, development: 630, bundle: 975 },
    savings: 105,
    timelines: {
      design: "2–3 weeks",
      development: "2–4 weeks",
      bundle: "4–6 weeks",
    },
  },
  {
    id: "professional",
    name: "Professional",
    minPages: 6,
    maxPages: 10,
    templates: 6,
    revisions: 3,
    prices: { design: 900, development: 1265, bundle: 1950 },
    savings: 215,
    timelines: {
      design: "3–5 weeks",
      development: "4–6 weeks",
      bundle: "6–9 weeks",
    },
  },
  {
    id: "premium",
    name: "Premium",
    minPages: 11,
    maxPages: 15,
    templates: 8,
    revisions: 4,
    prices: { design: 1625, development: 2350, bundle: 3575 },
    savings: 400,
    timelines: {
      design: "5–7 weeks",
      development: "6–8 weeks",
      bundle: "9–12 weeks",
    },
  },
];

// Illustrative add-on rates: confirm actual commercial prices before publishing.
const addOns: AddOn[] = [
  {
    id: "design-revision",
    name: "Additional design revision round",
    description: "One extra consolidated round of design feedback.",
    price: 100,
    modes: ["design", "bundle"],
  },
  {
    id: "development-revision",
    name: "Additional development change round",
    description: "One additional agreed round of implementation changes.",
    price: 125,
    modes: ["development", "bundle"],
  },
  {
    id: "extra-template",
    name: "Additional page template",
    description: "One unique layout beyond your package allowance.",
    price: 150,
    modes: ["design", "development", "bundle"],
  },
  {
    id: "contact-form",
    name: "Advanced contact form",
    description: "An agreed form with additional fields and validation.",
    price: 125,
    modes: ["development", "bundle"],
  },
  {
    id: "cms",
    name: "CMS integration",
    description: "Connect an agreed content management system.",
    price: 250,
    modes: ["development", "bundle"],
  },
  {
    id: "interaction-prototype",
    name: "Advanced interaction prototype",
    description: "Prototype additional interaction states and flows.",
    price: 175,
    modes: ["design", "bundle"],
  },
  {
    id: "analytics",
    name: "Analytics setup",
    description: "Basic analytics installation and agreed event configuration.",
    price: 100,
    modes: ["development", "bundle"],
  },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function getDeliverables(mode: PackageMode, revisions: number) {
  if (mode === "design") {
    return [
      "Discovery, goals, and page structure",
      "Wireframes and responsive UI designs",
      "Clickable prototype",
      `${revisions} consolidated design revision rounds`,
      "Developer handoff",
    ];
  }

  if (mode === "development") {
    return [
      "Kickoff and scope confirmation",
      "Responsive website implementation",
      "Build from approved designs and supplied content",
      "Quality checks and agreed-scope handoff",
    ];
  }

  return [
    "Discovery, goals, and page structure",
    "Wireframes and responsive UI designs",
    "Clickable prototype",
    `${revisions} consolidated design revision rounds`,
    "Responsive website development",
    "Quality checks and handoff",
  ];
}

export function PricingPackages() {
  const generatedId = useId();
  const id = generatedId.replace(/:/g, "");

  const [selectedMode, setSelectedMode] =
    useState<PackageMode>("design");

  const [pageCount, setPageCount] = useState(5);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  const mode = modes.find((item) => item.id === selectedMode)!;

  const selectedPackage =
    packages.find((item) => pageCount <= item.maxPages)!;

  const basePrice = selectedPackage.prices[selectedMode];

  const availableAddOns = addOns.filter((item) =>
    item.modes.includes(selectedMode),
  );

  const activeAddOns = availableAddOns.filter((item) =>
    selectedAddOns.includes(item.id),
  );

  const addOnTotal = activeAddOns.reduce(
    (total, item) => total + item.price,
    0,
  );

  const totalPrice = basePrice + addOnTotal;

  const getPricingHref = (custom: boolean) => {
    const params = new URLSearchParams({
      intent: "pricing",
      mode: selectedMode,
      pages: String(pageCount),
      estimate: String(totalPrice),
    });
    if (custom) {
      params.set("custom", "true");
    } else {
      params.set("tier", selectedPackage.name);
    }
    activeAddOns.forEach((addOn) => params.append("addon", addOn.name));
    return `/contact?${params.toString()}`;
  };

  const customHref = getPricingHref(true);
  const packageHref = getPricingHref(false);

  const updatePageCount = (value: string) => {
    if (value.trim() === "") return;

    const nextValue = Number(value);

    if (
      Number.isInteger(nextValue) &&
      nextValue >= 1 &&
      nextValue <= 15
    ) {
      setPageCount(nextValue);
    }
  };

  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOns((current) =>
      current.includes(addOnId)
        ? current.filter((item) => item !== addOnId)
        : [...current, addOnId],
    );
  };

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mt-10 space-y-6"
    >
      <Card variant="elevated" className="p-5 sm:p-7 md:p-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-deep">
            Project estimator
          </p>

          <h2
            id={`${id}-heading`}
            className="mt-2 text-2xl font-semibold tracking-display-tight text-ink sm:text-3xl"
          >
            Build your project estimate
          </h2>

          <p className="mt-3 text-sm leading-6 text-body-muted">
            Select a service, choose your page count, and add only the
            extras your project needs. Your estimate updates as you go.
          </p>
        </div>

        <fieldset className="mt-7">
          <legend className="mb-3 text-sm font-semibold text-ink">
            1. What do you need?
          </legend>

          <div className="grid gap-3 md:grid-cols-3">
            {modes.map((item) => {
              const selected = selectedMode === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedMode(item.id)}
                  className={`flex min-h-36 flex-col items-start rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep focus-visible:ring-offset-2 ${
                    selected
                      ? "border-ink bg-surface ring-1 ring-ink"
                      : "border-divider bg-paper hover:border-divider-strong"
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {item.label}
                    </span>

                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                        selected
                          ? "border-ink bg-ink text-on-dark"
                          : "border-divider-strong text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      <Check size={12} />
                    </span>
                  </span>

                  <span className="mt-3 text-sm leading-6 text-body">
                    {item.description}
                  </span>

                  {item.id === "bundle" && (
                    <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-ink">
                      <Sparkles size={13} aria-hidden="true" />
                      Bundle pricing
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="mt-4 text-sm leading-6 text-body-muted">
          {mode.description}
        </p>
      </Card>

      <Card variant="elevated" className="p-5 sm:p-7 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-deep">
              Step 2
            </p>

            <h3 className="mt-1 text-xl font-semibold text-ink">
              How many pages do you expect?
            </h3>

            <p className="mt-2 max-w-xl text-sm leading-6 text-body-muted">
              Your page count selects a fixed package. The price stays
              the same within that package&apos;s page range.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-xl border border-divider-strong bg-paper p-2">
            <label htmlFor={`${id}-page-count`} className="sr-only">
              Number of pages
            </label>

            <input
              id={`${id}-page-count`}
              type="number"
              min={1}
              max={15}
              step={1}
              inputMode="numeric"
              value={pageCount}
              onChange={(event) =>
                updatePageCount(event.target.value)
              }
              aria-describedby={`${id}-page-help`}
              className="w-16 rounded-lg bg-transparent px-1 py-1 text-center text-xl font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent-deep"
            />

            <span className="pr-2 text-sm text-body-muted">
              pages
            </span>
          </div>
        </div>

        <div className="mt-7">
          <label htmlFor={`${id}-page-slider`} className="sr-only">
            Adjust number of pages
          </label>

          <input
            id={`${id}-page-slider`}
            type="range"
            min={1}
            max={15}
            step={1}
            value={pageCount}
            onChange={(event) =>
              updatePageCount(event.target.value)
            }
            aria-valuetext={`${pageCount} ${
              pageCount === 1 ? "page" : "pages"
            }`}
            aria-describedby={`${id}-page-help`}
            className="h-2 w-full cursor-pointer accent-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep focus-visible:ring-offset-4"
          />

          <div
            id={`${id}-page-help`}
            className="mt-3 flex justify-between text-xs text-body-muted"
          >
            <span>1 page</span>
            <span>15 pages</span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {packages.map((item) => {
            const active = item.id === selectedPackage.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setPageCount(item.minPages)}
                className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep focus-visible:ring-offset-2 ${
                  active
                    ? "border-ink bg-surface ring-1 ring-ink"
                    : "border-divider bg-paper hover:border-divider-strong"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-ink">
                    {item.name}
                  </span>

                  {item.id === "professional" && (
                    <span className="rounded-full bg-paper px-2 py-1 text-caption font-semibold text-ink">
                      POPULAR
                    </span>
                  )}
                </span>

                <span className="mt-2 block text-sm text-body-muted">
                  {item.minPages}–{item.maxPages} pages
                </span>

                <span className="mt-3 block text-2xl font-semibold tracking-tight text-ink">
                  {currency.format(item.prices[selectedMode])}
                </span>

                <span className="mt-1 block text-xs text-body-muted">
                  Starting fee · one-time
                </span>

                <span className="mt-3 block text-sm leading-5 text-body">
                  Up to {item.templates} unique templates
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-sm leading-6 text-body-muted">
          Selected:{" "}
          <span className="font-semibold text-ink">
            {selectedPackage.name}
          </span>{" "}
          · {pageCount} {pageCount === 1 ? "page" : "pages"} · up to{" "}
          {selectedPackage.templates} unique templates
        </p>
      </Card>

      <Card variant="elevated" className="p-5 sm:p-7 md:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-deep">
              Included in your package
            </p>

            <h3 className="mt-1 text-xl font-semibold text-ink">
              What you get with {selectedPackage.name}
            </h3>

            <p className="mt-2 text-sm leading-6 text-body-muted">
              These deliverables are covered by your selected package
              price, subject to the final agreed scope.
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-divider bg-paper px-3 py-2 text-xs font-medium text-ink">
            <Check size={14} aria-hidden="true" />
            Included in base price
          </span>
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {getDeliverables(
            selectedMode,
            selectedPackage.revisions,
          ).map((deliverable) => (
            <li
              key={deliverable}
              className="flex items-start gap-3"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
                <Check size={14} aria-hidden="true" />
              </span>

              <span className="text-sm leading-6 text-body">
                {deliverable}
              </span>
            </li>
          ))}

          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
              <Check size={14} aria-hidden="true" />
            </span>

            <span className="text-sm leading-6 text-body">
              Up to {selectedPackage.templates} unique page templates
              across {selectedPackage.maxPages} pages in this package
            </span>
          </li>
        </ul>

        <div className="mt-6 rounded-xl border border-divider bg-paper p-4">
          <div className="flex items-start gap-3">
            <Info
              size={18}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-body-muted"
            />

            <p className="text-sm leading-6 text-body-muted">
              A page is a destination such as Home or Contact. A
              template is a reusable layout that multiple pages can
              share. Extra unique templates, custom functionality,
              integrations, and requirements outside the agreed scope
              may cost extra.
            </p>
          </div>
        </div>
      </Card>

      <Card variant="elevated" className="p-5 sm:p-7 md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-deep">
            Optional extras
          </p>

          <h3 className="mt-1 text-xl font-semibold text-ink">
            Add only what your project needs
          </h3>

          <p className="mt-2 text-sm leading-6 text-body-muted">
            These extras are separate from your fixed package. Select
            or deselect them to update your estimated total instantly.
          </p>
        </div>

        <fieldset className="mt-6">
          <legend className="sr-only">
            Optional paid project add-ons
          </legend>

          <div className="grid gap-3 md:grid-cols-2">
            {availableAddOns.map((addOn) => {
              const checked = selectedAddOns.includes(addOn.id);
              const checkboxId = `${id}-addon-${addOn.id}`;

              return (
                <label
                  key={addOn.id}
                  htmlFor={checkboxId}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-accent-deep focus-within:ring-offset-2 ${
                    checked
                      ? "border-ink bg-surface"
                      : "border-divider bg-paper hover:border-divider-strong"
                  }`}
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAddOn(addOn.id)}
                    className="mt-1 size-4 shrink-0 accent-accent-deep"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-col justify-between gap-1 sm:flex-row sm:items-start">
                      <span className="text-sm font-semibold text-ink">
                        {addOn.name}
                      </span>

                      <span className="shrink-0 text-sm font-semibold text-ink">
                        +{currency.format(addOn.price)}
                      </span>
                    </span>

                    <span className="mt-2 block text-sm leading-6 text-body-muted">
                      {addOn.description}
                    </span>

                    <span className="mt-3 block text-xs font-medium text-body-muted">
                      {checked
                        ? "Added to estimate"
                        : "Optional · not included"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <p className="mt-4 text-sm leading-6 text-body-muted">
          Add-on rates are indicative starting estimates. Final fees depend
          on the detailed requirements and are confirmed in writing. SEO,
          paid subscriptions, and work not listed here are scoped separately.
        </p>
      </Card>

      <section
        aria-labelledby={`${id}-summary-heading`}
        aria-live="polite"
        aria-atomic="true"
        className="rounded-2xl bg-ink p-5 text-paper sm:p-7 md:p-8"
      >
        <div className="grid gap-7 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">
              Estimated investment
            </p>

            <h3
              id={`${id}-summary-heading`}
              className="mt-2 text-2xl font-semibold tracking-display-tight"
            >
              {selectedPackage.name} · {mode.label}
            </h3>

            <p className="mt-2 text-sm leading-6 text-on-dark/75">
              {pageCount} {pageCount === 1 ? "page" : "pages"} · up
              to {selectedPackage.templates} unique templates
            </p>

            <div className="mt-6 space-y-3 border-t border-on-dark/20 pt-5">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-on-dark/75">
                  Fixed package fee
                </span>
                <span className="font-medium">
                  {currency.format(basePrice)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-on-dark/75">
                  Selected add-ons ({activeAddOns.length})
                </span>
                <span className="font-medium">
                  {currency.format(addOnTotal)}
                </span>
              </div>

              {activeAddOns.length > 0 && (
                <ul className="space-y-2 pl-1">
                  {activeAddOns.map((addOn) => (
                    <li
                      key={addOn.id}
                      className="flex items-start justify-between gap-4 text-xs text-on-dark/75"
                    >
                      <span>{addOn.name}</span>
                      <span className="shrink-0">
                        {currency.format(addOn.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-end justify-between gap-4 border-t border-on-dark/20 pt-4">
                <div>
                  <p className="text-sm font-semibold">
                    Estimated total
                  </p>
                  <p className="mt-1 text-xs text-on-dark/65">
                    USD · one-time
                  </p>
                </div>

                <p className="text-3xl font-semibold tracking-display-tight sm:text-4xl">
                  {currency.format(totalPrice)}
                </p>
              </div>

              {selectedMode === "bundle" && (
                <p className="text-sm leading-6 text-accent-highlight">
                  The base package includes a{" "}
                  {currency.format(selectedPackage.savings)} saving
                  compared with the separate services. Add-ons are
                  additional.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-5 rounded-xl border border-on-dark/20 bg-on-dark/5 p-5">
            <div>
              <p className="text-sm text-on-dark/75">
                Estimated delivery
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {selectedPackage.timelines[selectedMode]}
              </p>

              <p className="mt-2 text-sm leading-6 text-on-dark/65">
                Planning range, not a guaranteed deadline. Add-ons
                and project dependencies may change the timeline.
              </p>
            </div>

            <div className="space-y-3">
              <ButtonLink href={packageHref} className="w-full">
                Discuss this estimate
                <ArrowRight size={16} aria-hidden="true" />
              </ButtonLink>

              <ButtonLink
                href={customHref}
                variant="secondary"
                className="w-full"
              >
                Request a custom scope
                <ArrowRight size={16} aria-hidden="true" />
              </ButtonLink>

              <p className="text-sm leading-6 text-on-dark/65">
                Your selection is a starting estimate. We confirm the
                final deliverables, revisions, timeline, and fee in
                writing before work begins.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-divider bg-paper p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">
              Does your project need more than a package?
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-body-muted">
              Choose custom scoping for more than 15 pages, additional
              templates, complex user journeys, custom backend
              functionality, e-commerce, accounts, or unusual
              integrations. You do not need a complete brief to start.
            </p>
          </div>

          <ButtonLink
            href={customHref}
            variant="secondary"
            className="shrink-0"
          >
            Explore custom scope
            <ArrowRight size={16} aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>

      <PricingAssistant
        service={mode.label}
        mode={selectedMode}
        pages={pageCount}
        tier={selectedPackage.name}
        price={currency.format(totalPrice)}
        timeline={selectedPackage.timelines[selectedMode]}
        templates={selectedPackage.templates}
        revisions={selectedPackage.revisions}
        savings={currency.format(selectedPackage.savings)}
        contactHref={packageHref}
      />
    </section>
  );
}
