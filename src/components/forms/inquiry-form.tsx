"use client";

import { useMemo, useRef, useState } from "react";
import { services, type Project, type Service } from "@/data/site";
import { inquirySchema, type InquiryFormValues } from "@/lib/validation";

const initialValues: InquiryFormValues = {
  name: "",
  email: "",
  company: "",
  service: "",
  projectDescription: "",
  budget: "",
  timeline: "",
};

export type InquiryIntent = "general" | "conversation" | "service" | "pricing" | "project";
type InquiryMode = "design" | "development" | "bundle";
type ContextQuestion = { name: string; label: string; placeholder: string };

type InquiryFormProps = {
  intent?: InquiryIntent;
  service?: Service;
  serviceValue?: string;
  project?: Project;
  mode?: InquiryMode;
  tier?: string;
  pageCount?: number;
  customScope?: boolean;
  selectedAddOns?: string[];
  estimatorTotal?: number;
};

function getContextQuestions(
  intent: InquiryIntent,
  service?: Service,
  project?: Project,
  customScope = false,
): ContextQuestion[] {
  if (intent === "service") {
    if (service?.slug === "ux-ui-design") {
      return [
        { name: "userProblem", label: "Which user problem or journey needs attention?", placeholder: "Tell us what users need to do and where the current experience falls short." },
        { name: "designDeliverables", label: "Which design outputs would help your team move forward?", placeholder: "For example: research, flows, wireframes, UI design, prototype, or handoff." },
      ];
    }
    if (service?.slug === "nextjs-development") {
      return [
        { name: "buildScope", label: "Which pages, flows, or features need to be built?", placeholder: "List the main pages, user journeys, or functionality in scope." },
        { name: "readyMaterials", label: "What is already ready for development?", placeholder: "For example: approved designs, content, brand assets, or integrations." },
      ];
    }
    return [
      { name: "currentChallenge", label: "What is happening today that led you to seek this service?", placeholder: "Share the current situation, challenge, or opportunity." },
      { name: "desiredOutcome", label: "What would a useful outcome look like?", placeholder: "Tell us what should be clearer, easier, or possible after the work." },
    ];
  }

  if (intent === "pricing") {
    if (customScope) {
      return [
        { name: "customRequirements", label: "What does your project need that the listed packages do not cover?", placeholder: "Describe the outcome, features, or constraints that make your scope custom." },
        { name: "customScopeDetails", label: "Which pages, journeys, integrations, or technical requirements are involved?", placeholder: "Share an approximate page count and any important workflows, systems, or integrations." },
      ];
    }
    return [
      { name: "packageScope", label: "What would you like included in this package?", placeholder: "Share the pages, templates, design or build work you have in mind." },
      { name: "scopeQuestions", label: "What should we clarify before confirming the scope?", placeholder: "Mention features, integrations, content readiness, or anything that may affect the estimate." },
    ];
  }

  if (intent === "project") {
    return [
      { name: "yourProject", label: "What are you planning, and who is it for?", placeholder: "Describe your product or website and its intended audience." },
      { name: "referenceDetails", label: `What aspects of ${project?.title || "this project"} are relevant to your idea?`, placeholder: "For example: a similar workflow, catalog, feature, or customer experience." },
    ];
  }

  return [];
}

export function InquiryForm({
  intent = "general",
  service,
  serviceValue,
  project,
  mode,
  tier,
  pageCount,
  customScope = false,
  selectedAddOns = [],
  estimatorTotal,
}: InquiryFormProps) {
  const contextQuestions = getContextQuestions(intent, service, project, customScope);
  const modeLabel = mode === "design"
    ? "Product Design"
    : mode === "development"
      ? "Next.js Development"
      : mode === "bundle"
        ? "Product Design + Next.js Development"
        : "To be confirmed";
  const engagementLabel = mode === "bundle"
    ? `${modeLabel} (combined engagement)`
    : modeLabel;
  const contextTitle = intent === "service"
    ? `${service?.title || "Service"} enquiry`
    : intent === "pricing"
      ? customScope
        ? "Custom project scope enquiry"
        : `${tier ? `${tier} package` : "Project scope"} enquiry`
      : intent === "project"
        ? `Enquiry about ${project?.title || "a similar project"}`
        : "Quick project enquiry";
  const contextDescription = intent === "service"
    ? "A few service-specific details help us understand the right next step."
    : intent === "pricing"
      ? customScope
        ? "Share the requirements that fall outside the listed packages so we can understand the right discovery and scoping step."
        : `Share what you need from the ${tier ? `${tier} ` : ""}${mode === "design" ? "Product Design" : mode === "development" ? "Next.js Development" : mode === "bundle" ? "Product Design + Next.js Development" : "project"} scope.`
      : intent === "project"
        ? "The questions below use this case study as context, without assuming your project is the same."
        : "A few details are enough to start. For a larger brief, you can use the guided project discovery form.";
  const [values, setValues] = useState<InquiryFormValues>(() => ({
    ...initialValues,
    service: serviceValue || "",
  }));
  const [contextValues, setContextValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof InquiryFormValues, string>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const requestInFlight = useRef(false);

  const isReady = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { value } = event.target;
    const name = event.target.name as keyof InquiryFormValues;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
    setStatus("idle");
    setMessage("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestInFlight.current) return;
    const contextDescription = contextQuestions
      .map((question) => {
        const answer = contextValues[question.name]?.trim();
        return answer ? `${question.label}\n${answer}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
    const userDetails = [contextDescription, values.projectDescription.trim()]
      .filter(Boolean)
      .join("\n\n");
    const requiredDetails = contextQuestions.length
      ? contextValues[contextQuestions[0].name]?.trim() || ""
      : values.projectDescription.trim();
    if (requiredDetails.length < 20) {
      setErrors({ projectDescription: contextQuestions.length
        ? "Please answer this service-specific question in a sentence or two."
        : "Please share at least a little detail so we can respond usefully." });
      setStatus("error");
      setMessage("Please add a little more detail before sending your enquiry.");
      return;
    }
    const pricingReferences = intent === "pricing"
      ? [
          customScope
            ? `Custom project scope · ${modeLabel}`
            : `Package interest: ${tier || "Not selected"} · ${modeLabel}`,
          pageCount ? `Estimated page count: ${pageCount}` : "",
          selectedAddOns.length
            ? `Selected add-ons (indicative): ${selectedAddOns.join(", ")}`
            : "",
          estimatorTotal !== undefined
            ? `Pricing estimator total: USD $${new Intl.NumberFormat("en-US").format(estimatorTotal)} (indicative, not a quote)`
            : "",
        ].filter(Boolean).join("\n")
      : "";
    const reference = intent === "project" && project
      ? `Project reference: ${project.title}`
      : intent === "pricing"
        ? pricingReferences
        : intent === "service" && service
          ? `Service interest: ${service.title}`
          : "";
    const result = inquirySchema.safeParse({
      ...values,
      projectDescription: [reference, userDetails].filter(Boolean).join("\n\n"),
    });

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof InquiryFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof InquiryFormValues;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setStatus("error");
      setMessage("Please fix the highlighted fields before sending your inquiry.");
      return;
    }

    requestInFlight.current = true;
    setStatus("loading");
    setMessage("Sending your project details...");

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.data, companyWebsite: honeypot }),
      });

      const payload = await response.json();

      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.message || "Submission failed.");
      }

      setStatus("success");
      setMessage(
        payload?.message ||
          "Thanks! Your inquiry is ready for review. We’ll follow up soon.",
      );
      setValues({ ...initialValues, service: serviceValue || "" });
      setContextValues({});
      setErrors({});
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while sending the inquiry.",
      );
        } finally {
          requestInFlight.current = false;
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6 rounded-card border border-divider bg-surface p-5 shadow-card md:p-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-display-tight text-ink">{contextTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-body-muted">{contextDescription}</p>
      </div>
      {intent === "pricing" && (tier || customScope || pageCount) ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-body-strong">
          {customScope ? (
            <span><strong className="text-ink">Scope:</strong> Custom requirements</span>
          ) : tier ? (
            <span><strong className="text-ink">Package:</strong> {tier}</span>
          ) : null}
          <span><strong className="text-ink">{mode === "bundle" ? "Engagement:" : "Service:"}</strong> {engagementLabel}</span>
          {pageCount ? <span><strong className="text-ink">Estimated pages:</strong> {pageCount}</span> : null}
          {selectedAddOns.length ? <span><strong className="text-ink">Add-ons:</strong> {selectedAddOns.join(", ")}</span> : null}
          {estimatorTotal !== undefined ? <span><strong className="text-ink">Estimator total:</strong> USD ${new Intl.NumberFormat("en-US").format(estimatorTotal)} · not a quote</span> : null}
        </div>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-ink">Name <span aria-hidden="true">*</span></label>
          <input id="name" name="name" autoComplete="name" required aria-required="true" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} value={values.name} onChange={handleChange} className="w-full rounded-xl border border-divider-strong bg-surface-soft px-4 py-3 outline-none transition focus:border-ink" />
          {errors.name ? <p id="name-error" className="mt-1 text-sm text-danger">{errors.name}</p> : null}
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-ink">Email <span aria-hidden="true">*</span></label>
          <input id="email" type="email" name="email" autoComplete="email" required aria-required="true" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} value={values.email} onChange={handleChange} className="w-full rounded-xl border border-divider-strong bg-surface-soft px-4 py-3 outline-none transition focus:border-ink" />
          {errors.email ? <p id="email-error" className="mt-1 text-sm text-danger">{errors.email}</p> : null}
        </div>

        <div>
          <label htmlFor="company" className="mb-2 block text-sm font-medium text-ink">Company (optional)</label>
          <input id="company" name="company" autoComplete="organization" value={values.company} onChange={handleChange} className="w-full rounded-xl border border-divider-strong bg-surface-soft px-4 py-3 outline-none transition focus:border-ink" />
        </div>

        <div>
          {serviceValue ? (
            <>
              <p className="mb-2 block text-sm font-medium text-ink">Requested service or engagement</p>
              <p className="rounded-xl border border-divider-strong bg-surface-soft px-4 py-3 text-sm text-body-strong">
                {serviceValue === "Product Design + Next.js Development"
                  ? `${serviceValue} (combined engagement)`
                  : serviceValue}
              </p>
            </>
          ) : (
            <>
              <label htmlFor="service" className="mb-2 block text-sm font-medium text-ink">Requested service or engagement <span aria-hidden="true">*</span></label>
              <select id="service" name="service" required aria-required="true" aria-invalid={Boolean(errors.service)} aria-describedby={errors.service ? "service-error" : undefined} value={values.service} onChange={handleChange} className="w-full rounded-xl border border-divider-strong bg-surface-soft px-4 py-3 outline-none transition focus:border-ink">
                <option value="">Select a service or engagement</option>
                <optgroup label="Core services">
                  {services.map((serviceOption) => <option key={serviceOption.slug} value={serviceOption.title}>{serviceOption.title}</option>)}
                </optgroup>
                <optgroup label="Combined engagement">
                  <option value="Product Design + Next.js Development">Product Design + Next.js Development</option>
                </optgroup>
                <option value="Not sure yet">Not sure yet</option>
              </select>
              {errors.service ? <p id="service-error" className="mt-1 text-sm text-danger">{errors.service}</p> : null}
            </>
          )}
        </div>
      </div>

      {contextQuestions.length ? (
        <div className="space-y-5">
          {contextQuestions.map((question) => (
            <div key={question.name}>
              <label htmlFor={question.name} className="mb-2 block text-sm font-medium text-ink">{question.label}</label>
              <textarea
                id={question.name}
                name={question.name}
                value={contextValues[question.name] || ""}
                onChange={(event) => {
                  setContextValues((current) => ({ ...current, [question.name]: event.target.value }));
                  setErrors((current) => {
                    const next = { ...current };
                    delete next.projectDescription;
                    return next;
                  });
                  setStatus("idle");
                  setMessage("");
                }}
                rows={3}
                placeholder={question.placeholder}
                className="w-full rounded-xl border border-divider-strong bg-surface-soft px-4 py-3 outline-none transition placeholder:text-placeholder focus:border-ink"
              />
              {question === contextQuestions[0] && errors.projectDescription ? (
                <p id="projectDescription-error" className="mt-1 text-sm text-danger">{errors.projectDescription}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div>
        <label htmlFor="projectDescription" className="mb-2 block text-sm font-medium text-ink">
          {contextQuestions.length ? "Anything else we should know? (optional)" : "What would you like help with?"} {contextQuestions.length ? null : <span aria-hidden="true">*</span>}
        </label>
        <textarea id="projectDescription" name="projectDescription" required={!contextQuestions.length} aria-required={!contextQuestions.length} value={values.projectDescription} onChange={handleChange} rows={contextQuestions.length ? 3 : 6} className="w-full rounded-xl border border-divider-strong bg-surface-soft px-4 py-3 outline-none transition focus:border-ink" />
        {errors.projectDescription && !contextQuestions.length ? <p id="projectDescription-error" className="mt-1 text-sm text-danger">{errors.projectDescription}</p> : null}
      </div>

      {intent === "general" ? (
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="budget" className="mb-2 block text-sm font-medium text-ink">Budget range (optional)</label>
            <input id="budget" name="budget" value={values.budget} onChange={handleChange} className="w-full rounded-xl border border-divider-strong bg-surface-soft px-4 py-3 outline-none transition focus:border-ink" />
          </div>

          <div>
            <label htmlFor="timeline" className="mb-2 block text-sm font-medium text-ink">Timeline (optional)</label>
            <input id="timeline" name="timeline" value={values.timeline} onChange={handleChange} className="w-full rounded-xl border border-divider-strong bg-surface-soft px-4 py-3 outline-none transition focus:border-ink" />
          </div>
        </div>
      ) : null}

      {message ? (
        <p
          role={status === "error" ? "alert" : "status"}
          aria-live={status === "error" ? "assertive" : "polite"}
          className={
            status === "success"
              ? "rounded-xl border border-success-line bg-success-soft px-4 py-3 text-sm text-success"
              : status === "error"
                ? "rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-strong"
                : "rounded-xl border border-divider bg-paper px-4 py-3 text-sm text-ink"
          }
        >
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "loading" || !isReady}
        className="inline-flex w-full items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Sending..." : "Send inquiry"}
      </button>
      <label className="sr-only" aria-hidden="true">
        Leave this field empty
        <input tabIndex={-1} autoComplete="off" name="companyWebsite" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
      </label>
    </form>
  );
}
