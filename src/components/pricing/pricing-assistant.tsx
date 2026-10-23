"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import { ArrowRight, MessageCircle, Send } from "lucide-react";

type PricingAssistantProps = {
  service: string;
  mode: "design" | "development" | "bundle";
  pages: number;
  tier: string;
  price: string;
  timeline: string;
  templates: number;
  revisions: number;
  savings: string;
  contactHref: string;
};

type Message = {
  role: "assistant" | "user";
  text: string;
};

const suggestedQuestions = [
  "What does this estimate include?",
  "How do page prices work?",
  "What could cost extra?",
];

function getAnswer(
  question: string,
  context: PricingAssistantProps,
): string {
  const normalized = question.toLowerCase().trim();

  const {
    service,
    mode,
    pages,
    tier,
    price,
    timeline,
    templates,
    revisions,
    savings,
  } = context;

  // Check exclusions before general package or inclusion keywords.
  if (
    /\b(extra|excluded|exclude|not included|backend|accounts?|e-?commerce|shop|copywriting|content writing|integrations?|third.party|custom|additional)\b/.test(
      normalized,
    )
  ) {
    return (
      "Custom backend systems, user accounts, e-commerce, copywriting, " +
      "paid third-party services, unlisted integrations, and work beyond " +
      "the package limits are not automatically included. These requirements " +
      "can be reviewed and quoted separately."
    );
  }

  if (/\b(hello|hi|hey|salam|assalam)\b/.test(normalized)) {
    return (
      "Hi! I can explain your current estimate, included deliverables, " +
      "package limits, delivery range, and custom-scope requirements. " +
      "What would you like to know?"
    );
  }

  if (
    /\b(template|templates|layout|layouts)\b/.test(normalized)
  ) {
    return (
      `A page is a destination such as Home or Contact. A template is ` +
      `a reusable layout that can serve multiple pages with a similar ` +
      `structure. Your ${tier} estimate covers up to ${templates} unique ` +
      `templates across ${pages} ${pages === 1 ? "page" : "pages"}. ` +
      "Additional templates or complex layouts may require custom scoping."
    );
  }

  if (
    /\b(page|pages|bracket|tier|package|packages|limit|quantity)\b/.test(
      normalized,
    )
  ) {
    return (
      "Pricing is grouped into fixed page brackets: Standard covers " +
      "1–5 pages, Professional 6–10, and Premium 11–15. The price stays " +
      "the same within each bracket. " +
      `Your current selection is ${pages} ${pages === 1 ? "page" : "pages"} ` +
      `in the ${tier} package, which covers up to ${templates} unique ` +
      "templates. Projects beyond these limits need a custom scope."
    );
  }

  if (
    /\b(price|cost|fee|estimate|rate|budget|charge|pricing)\b/.test(
      normalized,
    ) ||
    /\b(kitna|qeemat|budget)\b/.test(normalized)
  ) {
    return (
      `Your current ${tier} ${service} estimate is ${price} USD ` +
      `one-time for ${pages} ${pages === 1 ? "page" : "pages"}. ` +
      "This is a starting estimate, not a final quote. The final fee " +
      "is confirmed in writing after the project scope is reviewed." +
      (mode === "bundle"
        ? ` The combined package reflects a ${savings} saving compared ` +
          "with the separate services."
        : "")
    );
  }

  if (
    /\b(timeline|delivery|duration|weeks|deadline|time)\b/.test(
      normalized,
    ) ||
    /\b(kitna waqt|kab tak)\b/.test(normalized)
  ) {
    return (
      `For your current ${tier} ${service} estimate, the planning ` +
      `range is ${timeline}. This is not a guaranteed deadline. ` +
      "Final timing depends on scope, content readiness, feedback, " +
      "and approvals."
    );
  }

  if (
    /\b(start|process|discovery|brief|begin|next step|how do i|how to)\b/.test(
      normalized,
    ) ||
    /\b(kaise|kahan)\b/.test(normalized)
  ) {
    return (
      "To get started, share your goals, audience, expected pages, " +
      "and any materials you already have. We can review your needs, " +
      "clarify deliverables, and confirm the timeline and fee in writing. " +
      "You do not need a finished brief to begin."
    );
  }

  if (
    /\b(include|included|deliverable|deliverables|revision|revisions|iteration|wireframe|prototype|design|ux|handoff|what do i get)\b/.test(
      normalized,
    )
  ) {
    if (mode === "development") {
      return (
        `Your ${tier} Next.js Development scope includes kickoff and scope ` +
          "confirmation, responsive Next.js implementation from approved designs " +
        "and supplied content, quality checks, and handoff within the " +
        `agreed scope. It covers up to ${templates} unique templates. ` +
        "Design and final content should be ready or explicitly included " +
        "in the agreed scope."
      );
    }

    if (mode === "bundle") {
      return (
        `Your ${tier} Product Design + Next.js Development scope includes discovery, ` +
        "page structure, wireframes, responsive UI, a clickable prototype, " +
        `${revisions} consolidated design revision rounds, responsive ` +
        `development, QA, and handoff. It covers up to ${templates} ` +
        "unique templates."
      );
    }

    return (
      `Your ${tier} Product Design scope includes discovery, ` +
      "goals and page structure, wireframes, responsive UI, a clickable " +
      `prototype, ${revisions} consolidated design revision rounds, ` +
      `and developer handoff. It covers up to ${templates} unique templates.`
    );
  }

  return (
    "I can explain your current estimate, package limits, included work, " +
    "delivery range, and custom-scope requirements. For anything outside " +
    "these details, contact the team for a project-specific answer."
  );
}

export function PricingAssistant(props: PricingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const inputId = useId();
  const panelId = useId();

  const contextKey = [
    props.mode,
    props.pages,
    props.tier,
    props.price,
    props.timeline,
    props.templates,
    props.revisions,
    props.savings,
  ].join("|");

  useEffect(() => {
    setMessages([]);
    setQuestion("");
  }, [contextKey]);

  const submitQuestion = (submittedQuestion = question) => {
    const trimmedQuestion = submittedQuestion.trim();

    if (!trimmedQuestion) return;

    const answer = getAnswer(trimmedQuestion, props);

    setMessages((current) => [
      ...current,
      { role: "user", text: trimmedQuestion },
      { role: "assistant", text: answer },
    ]);

    setQuestion("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitQuestion();
  };

  return (
    <section className="mt-8 overflow-hidden rounded-panel border border-divider-strong bg-paper">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-surface sm:px-6"
      >
        <span className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-accent">
            <MessageCircle size={19} aria-hidden="true" />
          </span>

          <span>
            <span className="block text-sm font-semibold text-ink">
              Questions about your estimate?
            </span>
            <span className="mt-1 block text-sm leading-6 text-body-muted">
              Get quick answers about pricing, scope, and delivery.
            </span>
          </span>
        </span>

        <span
          aria-hidden="true"
          className="text-xl text-body"
        >
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen ? (
        <div
          id={panelId}
          className="border-t border-divider-strong"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 sm:px-6">
            <p className="text-xs font-medium text-body-muted">
              Automated pricing guide · Not a live agent
            </p>

            <p className="text-xs font-medium text-ink">
              {props.tier} · {props.pages}{" "}
              {props.pages === 1 ? "page" : "pages"}
            </p>
          </div>

          <div
            aria-live="polite"
            aria-label="Pricing assistant conversation"
            className="max-h-96 space-y-3 overflow-y-auto px-5 py-4 sm:px-6"
          >
            <p className="max-w-[95%] rounded-2xl rounded-tl-sm bg-surface p-4 text-sm leading-6 text-body-strong sm:max-w-[85%]">
              Hi! I can help explain your {props.service} estimate,
              package limits, and what may need a custom quote.
              What would you like to know?
            </p>

            {messages.map((message, index) => (
              <p
                key={`${index}-${message.role}`}
                className={`max-w-[95%] rounded-2xl p-4 text-sm leading-6 sm:max-w-[85%] ${
                  message.role === "user"
                    ? "ml-auto rounded-tr-sm bg-ink text-on-dark"
                    : "rounded-tl-sm bg-surface text-body-strong"
                }`}
              >
                {message.text}
              </p>
            ))}
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-wrap gap-2 px-5 pb-4 sm:px-6">
              {suggestedQuestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submitQuestion(suggestion)}
                  className="rounded-full border border-divider-strong bg-surface px-3 py-2 text-left text-xs font-medium text-body-strong transition hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="flex gap-2 border-t border-divider-strong p-4 sm:px-6"
          >
            <label htmlFor={inputId} className="sr-only">
              Ask about pricing or project scope
            </label>

            <input
              id={inputId}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={500}
              placeholder="Ask about price, pages, delivery, or scope…"
              className="min-w-0 flex-1 rounded-xl border border-divider-strong bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-placeholder focus:border-accent-deep focus-visible:ring-2 focus-visible:ring-accent-deep"
            />

            <button
              type="submit"
              disabled={!question.trim()}
              aria-label="Send question"
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-ink text-on-dark transition hover:bg-ink-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={17} aria-hidden="true" />
            </button>
          </form>

          <div className="flex flex-col gap-2 px-5 pb-5 text-sm leading-6 text-body-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span>
              Answers reflect your current estimate. Final scope is confirmed
              with the team.
            </span>

            <Link
              href={props.contactHref}
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-ink underline underline-offset-2"
            >
              Discuss your project
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}