"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, MessageCircle, RotateCcw } from "lucide-react";
import { inquirySchema } from "@/lib/validation";

const serviceChoiceGroups = [
  {
    label: "Core services",
    choices: ["Product Design", "Next.js Development", "SEO"],
  },
  {
    label: "Combined engagement",
    choices: ["Product Design + Next.js Development"],
  },
  {
    label: "Still deciding",
    choices: ["Not sure yet"],
  },
] as const;

const timelineChoices = ["As soon as possible", "Within 1–3 months", "Flexible / exploring"];

type Conversation = {
  service: string;
  projectDescription: string;
  outcome: string;
  timeline: string;
  name: string;
  email: string;
  company: string;
};

const initialConversation: Conversation = {
  service: "",
  projectDescription: "",
  outcome: "",
  timeline: "",
  name: "",
  email: "",
  company: "",
};

const steps = ["Your goal", "A little context", "Your reply details"];

export function ConversationChat() {
  const [conversation, setConversation] = useState(initialConversation);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);

  const update = (field: keyof Conversation, value: string) => {
    setConversation((current) => ({ ...current, [field]: value }));
    setError("");
    setStatus("idle");
  };

  const next = () => {
    if (step === 0 && !conversation.service) {
      setError("Choose an option so we know where to begin.");
      return;
    }
    if (step === 1 && conversation.projectDescription.trim().length < 20) {
      setError("A sentence or two helps us understand what you need.");
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, 2));
  };

  const submit = async () => {
    if (requestInFlight.current) return;

    const description = [
      `How can we help?\n${conversation.projectDescription.trim()}`,
      conversation.outcome.trim() ? `What would help most?\n${conversation.outcome.trim()}` : "",
      conversation.timeline ? `Timeline\n${conversation.timeline}` : "",
    ].filter(Boolean).join("\n\n");
    const payload = inquirySchema.safeParse({
      name: conversation.name,
      email: conversation.email,
      company: conversation.company,
      service: conversation.service,
      projectDescription: description,
      budget: "",
      timeline: conversation.timeline,
    });

    if (!payload.success) {
      setError(payload.error.issues[0]?.message || "Please check your details and try again.");
      setStatus("error");
      return;
    }

    requestInFlight.current = true;
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload.data, companyWebsite: "" }),
      });
      const result = await response.json();
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Your message could not be sent.");
      }
      setStatus("success");
    } catch (submitError) {
      setStatus("error");
      setError(submitError instanceof Error ? submitError.message : "Your message could not be sent.");
    } finally {
      requestInFlight.current = false;
    }
  };

  if (status === "success") {
    return (
      <section className="rounded-card border border-success-line bg-success-soft p-7 sm:p-9" role="status">
        <div className="flex size-12 items-center justify-center rounded-full bg-success-highlight text-success-strong">
          <Check aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-ink">Thanks for starting the conversation.</h2>
        <p className="mt-3 text-sm leading-7 text-success-ink">
          Your note has been received. We’ll review it and reply to {conversation.email}. This was an enquiry, not a booked meeting.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Guided project conversation" className="overflow-hidden rounded-card border border-divider bg-surface shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-divider px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-ink text-accent">
            <MessageCircle size={19} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Rapidlyon project chat</p>
            <p className="text-xs text-muted">A guided note · not live chat</p>
          </div>
        </div>
        <p className="text-xs font-medium text-muted">Step {step + 1} of {steps.length}</p>
      </div>

      <div className="space-y-5 bg-surface-warm px-5 py-6 sm:px-7" aria-live="polite">
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-surface p-4 text-sm leading-6 text-body-strong shadow-sm">
          {step === 0
            ? "Hi! What kind of help are you looking for?"
            : step === 1
              ? conversation.service === "Product Design + Next.js Development"
                ? "The combined Product Design + Next.js Development engagement sounds like a useful place to start. What are you hoping to build or improve?"
                : conversation.service === "Not sure yet"
                  ? "That is okay. What are you hoping to build or improve?"
                  : `Great—${conversation.service} sounds like a useful place to start. What are you hoping to build or improve?`
              : "Thanks, that gives us a starting point. Where can we send a thoughtful reply?"}
        </div>

        {step === 0 ? (
          <div className="space-y-4" role="group" aria-label="Choose a service or engagement">
            {serviceChoiceGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-label text-muted">{group.label}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.choices.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      aria-pressed={conversation.service === choice}
                      onClick={() => update("service", choice)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                        conversation.service === choice
                          ? "border-ink bg-accent-soft text-ink"
                          : "border-divider-strong bg-surface text-body hover:border-black/30"
                      }`}
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <label htmlFor="chat-project-description" className="block text-sm font-medium text-ink">
              What is happening, and who is it for?
              <textarea
                id="chat-project-description"
                value={conversation.projectDescription}
                onChange={(event) => update("projectDescription", event.target.value)}
                rows={4}
                maxLength={5000}
                placeholder="A sentence or two is plenty to begin."
                className="mt-2 w-full rounded-2xl border border-divider-strong bg-surface px-4 py-3 text-sm font-normal leading-6 outline-none placeholder:text-placeholder focus:border-ink"
              />
            </label>
            <label htmlFor="chat-outcome" className="block text-sm font-medium text-ink">
              What would make this work valuable? <span className="font-normal text-muted">(optional)</span>
              <textarea
                id="chat-outcome"
                value={conversation.outcome}
                onChange={(event) => update("outcome", event.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="For example, a clearer journey, a launched website, or a first product version."
                className="mt-2 w-full rounded-2xl border border-divider-strong bg-surface px-4 py-3 text-sm font-normal leading-6 outline-none placeholder:text-placeholder focus:border-ink"
              />
            </label>
            <fieldset>
              <legend className="text-sm font-medium text-ink">When are you hoping to start? <span className="font-normal text-muted">(optional)</span></legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {timelineChoices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={conversation.timeline === choice}
                    onClick={() => update("timeline", conversation.timeline === choice ? "" : choice)}
                    className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                      conversation.timeline === choice
                        ? "border-ink bg-ink text-on-dark"
                        : "border-divider-strong bg-surface text-body hover:border-black/30"
                    }`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="chat-name" className="text-sm font-medium text-ink">
              Your name
              <input id="chat-name" autoComplete="name" value={conversation.name} onChange={(event) => update("name", event.target.value)} className="mt-2 w-full rounded-xl border border-divider-strong bg-surface px-4 py-3 font-normal outline-none focus:border-ink" />
            </label>
            <label htmlFor="chat-email" className="text-sm font-medium text-ink">
              Email for our reply
              <input id="chat-email" type="email" autoComplete="email" value={conversation.email} onChange={(event) => update("email", event.target.value)} className="mt-2 w-full rounded-xl border border-divider-strong bg-surface px-4 py-3 font-normal outline-none focus:border-ink" />
            </label>
            <label htmlFor="chat-company" className="text-sm font-medium text-ink sm:col-span-2">
              Company or project name <span className="font-normal text-muted">(optional)</span>
              <input id="chat-company" autoComplete="organization" value={conversation.company} onChange={(event) => update("company", event.target.value)} className="mt-2 w-full rounded-xl border border-divider-strong bg-surface px-4 py-3 font-normal outline-none focus:border-ink" />
            </label>
            <div className="rounded-2xl border border-divider bg-surface p-4 text-sm leading-6 text-body sm:col-span-2">
              <p><strong className="text-ink">Starting point:</strong> {conversation.service}</p>
              <p className="mt-2">{conversation.projectDescription}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-divider px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          {error ? <p role="alert" className="text-sm text-danger-strong">{error}</p> : (
            <p className="text-sm leading-6 text-muted">Your details are used only to respond. You can also email us directly.</p>
          )}
        </div>
        <div className="flex gap-2">
          {step > 0 ? (
            <button type="button" onClick={() => { setStep((current) => current - 1); setError(""); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-divider-strong px-4 py-2.5 text-sm font-medium text-ink">
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
          ) : null}
          {step < 2 ? (
            <button type="button" onClick={next} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-on-dark">
              Continue <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={status === "loading"} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-on-dark disabled:cursor-wait disabled:opacity-60">
              {status === "loading" ? "Sending…" : "Send my note"} <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
          {status === "error" ? (
            <button type="button" onClick={submit} className="inline-flex items-center justify-center gap-2 rounded-full border border-divider-strong px-4 py-2.5 text-sm font-medium text-ink">
              <RotateCcw size={15} aria-hidden="true" /> Retry
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
