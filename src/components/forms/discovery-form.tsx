"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileUp, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  discoveryDraftSchema,
  discoveryServiceCategories,
  discoverySubmissionSchema,
  type DiscoverySubmission,
} from "@/lib/discovery";

const draftKey = "rapidlyon-discovery-draft-v1";
const stepTitles = [
  "About your business",
  "What do you need?",
  "Your goals",
  "Project context",
  "How would you like to start?",
  "Review & submit",
];
const initialForm = {
  fullName: "",
  email: "",
  company: "",
  website: "",
  country: "",
  timeZone: "",
  industry: "",
  businessStage: "",
  businessModel: "",
  services: [] as string[],
  answers: {} as Record<string, string | string[]>,
  projectOverview: "",
  objectives: "",
  mustHaveFeatures: "",
  niceToHaveFeatures: "",
  constraints: "",
  budget: "",
  timeline: "",
  productUrl: "",
  competitorReferences: "",
  discoveryMethod: "",
  preferredTimes: "",
  consent: false,
};

type DiscoveryFormData = typeof initialForm;
type FormErrors = Record<string, string>;
type Question = { key: string; label: string; hint?: string; options?: string[] };

const businessCountries = [
  "United Kingdom",
  "United States",
  "Canada",
  "Australia",
  "Pakistan",
  "United Arab Emirates",
  "Other",
];

const serviceQuestions: Record<string, Question[]> = {
  website: [
    { key: "websiteGoals", label: "What should the website help your business achieve?" },
    { key: "websiteAudience", label: "Who is the primary audience?" },
    { key: "websitePages", label: "Which pages or sections do you expect?", options: ["Home", "About", "Services", "Pricing", "Case studies", "Blog / resources", "Contact", "Other"] },
    { key: "websiteFeatures", label: "Which features may be needed?", options: ["Lead capture", "Payments", "Accounts", "Search", "Booking", "Multilingual", "Analytics", "Other"] },
    { key: "websiteCms", label: "Do you have a preferred CMS or integrations?", hint: "For example, a CMS, CRM, payment provider, or analytics tool." },
    { key: "websiteExisting", label: "Is there an existing website?", hint: "Share its URL or describe what should change." },
    { key: "websiteReferences", label: "Which websites or design references do you like?" },
    { key: "websiteTechnical", label: "Any technical, accessibility, or hosting requirements?" },
  ],
  ux: [
    { key: "designType", label: "What kind of product or design work are you exploring?", options: ["Product discovery or UX research", "SaaS / MVP product design", "Mobile app design", "Existing product redesign", "Not sure yet"] },
    { key: "uxChallenges", label: "What feels difficult or unclear in the current user experience?" },
    { key: "uxUsers", label: "Who are the target users and what are they trying to do?" },
    { key: "uxResearch", label: "What user research or evidence already exists?" },
    { key: "uxJourneys", label: "Which user journeys or workflows matter most?" },
    { key: "uxDeliverables", label: "Which design deliverables would be useful?", options: ["Research plan", "User flows", "Wireframes", "UI design", "Design system", "Prototype", "Usability testing"] },
    { key: "uxTesting", label: "Would you like prototyping or usability testing?", options: ["Interactive prototype", "Moderated usability testing", "Unmoderated testing", "Not sure yet"] },
  ],
  mobile: [
    { key: "mobilePlatforms", label: "Which platforms are in scope?", options: ["iOS", "Android", "Both", "Not decided"] },
    { key: "mobileConcept", label: "What is the app concept and its main objective?" },
    { key: "mobileRoles", label: "Who will use the app? Include key user roles." },
    { key: "mobileFeatures", label: "Which features are essential for the first release?" },
    { key: "mobileExisting", label: "Do you have existing designs, a prototype, or an app?", hint: "Share links or a brief description." },
    { key: "mobileDeliverables", label: "Which design deliverables do you need?", options: ["User flows", "Wireframes", "iOS UI", "Android UI", "Prototype", "Design system", "Developer handoff"] },
  ],
  strategy: [
    { key: "strategyProblem", label: "What business problem should the product solve?" },
    { key: "strategyVision", label: "What is your product vision?" },
    { key: "strategyStage", label: "What stage is the product at?", options: ["Idea", "Research", "Prototype", "MVP", "Launched product", "Growth / scale"] },
    { key: "strategyMarket", label: "Which market and audience are you targeting?" },
    { key: "strategyChallenges", label: "What are the most important challenges or unknowns?" },
    { key: "strategyOutcomes", label: "What outcomes would make this engagement valuable?" },
  ],
  seo: [
    { key: "seoWebsite", label: "Which website or pages should be reviewed?", hint: "Share a URL if available." },
    { key: "seoGoals", label: "What should people be able to find or do more easily?" },
    { key: "seoConcerns", label: "Have you noticed specific search, metadata, performance, or accessibility issues?" },
    { key: "seoPriorWork", label: "What SEO or optimization work has already been done?" },
  ],
};

function answerGroups(services: string[], answers: Record<string, string | string[]>) {
  const groups: { title: string; questions: Question[] }[] = [];
  if (services.some((service) => ["Next.js Development", "Website Development", "Website design", "Website development"].includes(service))) {
    groups.push({ title: "Website", questions: serviceQuestions.website });
  }
  const designSelected = services.includes("Product Design") || services.includes("UX/UI & Product Design") || services.some((service) => [
    "UX research and UX/UI design",
    "Mobile app design",
    "Product strategy and consulting",
    "Existing product redesign",
  ].includes(service));
  if (designSelected) {
    groups.push({ title: "UX and product experience", questions: serviceQuestions.ux });
  }
  const designTypes = Array.isArray(answers.designType) ? answers.designType : [];
  if (designTypes.includes("Mobile app design") || services.includes("Mobile app design")) {
    groups.push({ title: "Mobile app", questions: serviceQuestions.mobile });
  }
  if (designTypes.includes("SaaS / MVP product design") || services.includes("Product strategy and consulting")) {
    groups.push({ title: "Product strategy", questions: serviceQuestions.strategy });
  }
  if (services.includes("SEO") || services.includes("SEO & Website Optimization")) {
    groups.push({ title: "SEO", questions: serviceQuestions.seo });
  }
  if (services.includes("Other / not sure yet") || services.includes("Other digital product requirements")) {
    groups.push({
      title: "Other requirements",
      questions: [{ key: "otherRequirements", label: "What other digital product requirements should we know about?" }],
    });
  }
  return groups;
}

function normalizeDraftServices(services: string[]) {
  const legacyCategories: Record<string, string> = {
    "UX research and UX/UI design": "Product Design",
    "UX/UI & Product Design": "Product Design",
    "Website Development": "Next.js Development",
    "Website design": "Next.js Development",
    "Website development": "Next.js Development",
    "SEO & Website Optimization": "SEO",
    "Mobile app design": "Product Design",
    "Product strategy and consulting": "Product Design",
    "Existing product redesign": "Product Design",
    "Other digital product requirements": "Other / not sure yet",
  };
  return Array.from(new Set(services.map((service) => legacyCategories[service] || service)));
}

function isFilled(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
}

function Field({
  name,
  label,
  value,
  onChange,
  error,
  optional = false,
  type = "text",
  placeholder,
  disabled = false,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
  optional?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const id = `discovery-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
        {label} {optional ? <span className="font-normal text-muted">(optional)</span> : <span aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={!optional}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full rounded-xl border border-divider-strong bg-surface px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-accent/60"
      />
      {error ? <p id={`${id}-error`} className="mt-1 text-sm text-danger-strong">{error}</p> : null}
    </div>
  );
}

function TextArea({
  name,
  label,
  value,
  onChange,
  error,
  optional = true,
  hint,
  rows = 4,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
  optional?: boolean;
  hint?: string;
  rows?: number;
}) {
  const id = `discovery-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-ink">
        {label} {optional ? <span className="font-normal text-muted">(optional)</span> : <span aria-hidden="true">*</span>}
      </label>
      {hint ? <p className="mb-2 text-sm leading-6 text-body-muted">{hint}</p> : null}
      <textarea
        id={id}
        name={name}
        required={!optional}
        rows={rows}
        maxLength={5000}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full rounded-xl border border-divider-strong bg-surface px-4 py-3 outline-none transition focus:border-ink focus:ring-2 focus:ring-accent/60"
      />
      {error ? <p id={`${id}-error`} className="mt-1 text-sm text-danger-strong">{error}</p> : null}
    </div>
  );
}

export function DiscoveryForm({ calendlyUrl = "" }: { calendlyUrl?: string }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<DiscoveryFormData>(initialForm);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [notice, setNotice] = useState("");
  const [draftMessage, setDraftMessage] = useState("Your progress will be saved on this device as you fill it out.");
  const [draftReady, setDraftReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submissionKey, setSubmissionKey] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [fileNotice, setFileNotice] = useState("");
  const [accountStatus, setAccountStatus] = useState<"loading" | "signed_in" | "signed_out" | "unverified" | "error">("loading");
  const [accountEmail, setAccountEmail] = useState("");

  useEffect(() => {
    let current = true;
    let unsubscribe = () => {};

    const applySession = (session: Awaited<ReturnType<ReturnType<typeof getSupabaseClient>["auth"]["getSession"]>>["data"]["session"]) => {
      if (!current) return;
      const email = session?.user.email?.trim() ?? "";
      setAccountEmail(email);
      if (!session || !email) {
        setAccountStatus("signed_out");
        return;
      }
      setAccountStatus(session.user.email_confirmed_at ? "signed_in" : "unverified");
      setForm((currentForm) => currentForm.email === email ? currentForm : { ...currentForm, email });
    };

    void Promise.resolve()
      .then(() => getSupabaseClient())
      .then((supabase) => {
        if (!current) return;
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          applySession(session);
        });
        unsubscribe = () => subscription.unsubscribe();
        return supabase.auth.getSession().then(({ data, error }) => {
          if (!current) return;
          if (error) {
            setAccountStatus("error");
            return;
          }
          applySession(data.session);
        });
      })
      .catch(() => {
        if (current) setAccountStatus("error");
      });

    return () => {
      current = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) {
        const parsed = discoveryDraftSchema.safeParse(JSON.parse(saved));
        if (parsed.success) {
          const { idempotencyKey: restoredKey, ...restoredForm } = parsed.data;
          // Restore browser-only draft data after hydration to avoid server/client mismatch.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setForm({ ...initialForm, ...restoredForm, services: normalizeDraftServices(parsed.data.services ?? []), answers: parsed.data.answers ?? {} });
          setSubmissionKey(restoredKey ?? "");
          setDraftMessage("Your saved progress was restored from this browser.");
        } else {
          setDraftMessage("The saved draft could not be restored. You can start a new request.");
        }
      }
    } catch {
      setDraftMessage("Draft saving is unavailable in this browser. You can still submit this form.");
    } finally {
      // Do not let the initial autosave overwrite a draft before it is restored.
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady || status === "success") return;
    try {
      if (JSON.stringify(form) === JSON.stringify(initialForm) && !submissionKey) {
        window.localStorage.removeItem(draftKey);
      } else {
        const draft = submissionKey ? { ...form, idempotencyKey: submissionKey } : form;
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      }
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftMessage("Draft saving is unavailable in this browser. Your answers remain on this page.");
    }
  }, [draftReady, form, status, submissionKey]);

  const groups = useMemo(() => answerGroups(form.services, form.answers), [form.services, form.answers]);
  const currentStepTitle = stepTitles[step];

  const changeField = (name: string, value: string) => {
    setSubmissionKey("");
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setNotice("");
  };

  const toggleChoice = (name: string, option: string, checked: boolean) => {
    setSubmissionKey("");
    setForm((current) => {
      const existing = Array.isArray(current.answers[name]) ? current.answers[name] as string[] : [];
      return {
        ...current,
        answers: {
          ...current.answers,
          [name]: checked ? [...existing, option] : existing.filter((item) => item !== option),
        },
      };
    });
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  const clearDraft = () => {
    if (status === "submitting") return;

    setForm(initialForm);
    setFiles([]);
    setErrors({});
    setNotice("");
    setFileNotice("");
    setStep(0);
    setStatus("idle");
    setSubmissionKey("");
    setHoneypot("");

    try {
      window.localStorage.removeItem(draftKey);
      setDraftMessage("Saved draft cleared from this browser.");
    } catch {
      setDraftMessage("The browser could not clear the saved draft. Clear this site's browser data to remove it.");
    }
  };

  const validateStep = () => {
    const nextErrors: FormErrors = {};
    if (step === 0) {
      if (form.fullName.trim().length < 2) nextErrors.fullName = "Enter your full name.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = "Enter a valid business email.";
      if (!form.company.trim()) nextErrors.company = "Enter your company or brand name.";
      if (!form.country.trim()) nextErrors.country = "Select your country.";
      if (!form.timeZone.trim()) nextErrors.timeZone = "Select or enter your time zone.";
      if (!form.industry.trim()) nextErrors.industry = "Select your industry.";
      if (!form.businessStage.trim()) nextErrors.businessStage = "Select your business stage.";
    }
    if (step === 1 && form.services.length === 0) nextErrors.services = "Choose at least one service.";
    if (step === 3 && form.projectOverview.trim().length < 20) nextErrors.projectOverview = "Please share at least 20 characters about your project.";
    if (step === 4 && !form.discoveryMethod) nextErrors.discoveryMethod = "Choose a discovery method.";
    if (step === 5 && !form.consent) nextErrors.consent = "Consent is required to submit your discovery request.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice("Please complete the highlighted required fields.");
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setNotice("");
    setStep((current) => Math.min(current + 1, stepTitles.length - 1));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep()) return;

    const idempotencyKey = submissionKey || crypto.randomUUID();
    setSubmissionKey(idempotencyKey);
    const data = { ...form, idempotencyKey } as DiscoverySubmission;
    const parsed = discoverySubmissionSchema.safeParse(data);
    if (!parsed.success) {
      const nextErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      setStatus("error");
      setNotice(parsed.error.issues[0]?.message || "Please review the required fields.");
      return;
    }

    setStatus("submitting");
    setNotice("Submitting your discovery request…");

    try {
      const { data: { session }, error: sessionError } = await getSupabaseClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token || !session.user.email_confirmed_at) {
        throw new Error("Sign in to a verified client account before submitting your request.");
      }
      if (session.user.email?.trim().toLowerCase() !== parsed.data.email.trim().toLowerCase()) {
        throw new Error("Use the same email address as your verified client account.");
      }

      const payload = new FormData();
      payload.set("submission", JSON.stringify(parsed.data));
      payload.set("companyWebsite", honeypot);
      files.forEach((file) => payload.append("attachments", file));
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: payload,
      });
      const result = await response.json();
      if (!response.ok || result?.success !== true) {
        throw new Error(result?.message || "Your discovery request could not be submitted.");
      }

      setStatus("success");
      setNotice(result.message || "Your discovery request has been received.");
      setFiles([]);
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        setNotice(`${result.message || "Your discovery request has been received."} Your saved browser draft could not be cleared; remove it using Clear saved draft or clear this site's browser data.`);
      }
    } catch (error) {
      setStatus("error");
      setNotice(error instanceof Error ? error.message : "Your discovery request could not be submitted.");
    }
  };

  if (status === "success") {
    return (
      <section className="rounded-card border border-success-line bg-success-soft p-8" role="status">
        <div className="flex size-12 items-center justify-center rounded-full bg-success-highlight text-success-strong"><Check aria-hidden="true" /></div>
        <h2 className="mt-5 text-3xl font-semibold text-ink">Thank you. Your discovery request is saved.</h2>
        <p className="mt-3 max-w-2xl leading-7 text-success-ink">{notice}</p>
        <p className="mt-3 max-w-2xl leading-7 text-success-ink">We’ll review your details and follow up using the email address you provided. This request is not a confirmed booking or a quote.</p>
        <Link href="/client" className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-dark">
          View request status in your client workspace
        </Link>
        {form.discoveryMethod !== "Self-guided discovery" && calendlyUrl ? (
          <a href={calendlyUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-dark">
            Choose a meeting time
          </a>
        ) : form.discoveryMethod !== "Self-guided discovery" ? (
          <p className="mt-5 text-sm text-success-ink">Your preferred meeting details have been included in the request; a time has not been booked automatically.</p>
        ) : null}
        <Link href="/" className="mt-6 block text-sm font-medium text-ink underline underline-offset-4">Return to the website</Link>
      </section>
    );
  }

  if (accountStatus !== "signed_in") {
    return (
      <section className="rounded-card border border-divider bg-surface p-6 shadow-card sm:p-8">
        <h2 className="text-2xl font-semibold text-ink">
          {accountStatus === "loading" ? "Checking your account…" : "Sign in before starting your request"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-body-muted">
          {accountStatus === "loading"
            ? "Your discovery form will be available once account access is checked."
            : accountStatus === "unverified"
              ? `Verify ${accountEmail} before submitting a discovery request.`
              : accountStatus === "error"
                ? "Account access could not be checked. Refresh the page or contact the studio if this continues."
                : "Create a client account or sign in with your verified email. You can then submit a request and track its status from your workspace."}
        </p>
        {accountStatus === "signed_out" ? (
          <Link href="/client/login?next=%2Fdiscovery" className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-medium text-on-dark">
            Sign in or create account
          </Link>
        ) : null}
      </section>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-card border border-divider bg-surface p-5 shadow-card sm:p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-ink">Step {step + 1} of {stepTitles.length}: {currentStepTitle}</p>
          <div className="flex items-center gap-3 text-sm text-body-muted">
            <p>{draftMessage}</p>
            <button type="button" disabled={status === "submitting"} onClick={clearDraft} className="shrink-0 font-medium text-ink underline underline-offset-2 disabled:opacity-50">
              Clear saved draft
            </button>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-divider" role="progressbar" aria-label="Discovery form progress" aria-valuemin={1} aria-valuemax={stepTitles.length} aria-valuenow={step + 1}>
          <div className="h-full rounded-full bg-accent-strong transition-all" style={{ width: `${((step + 1) / stepTitles.length) * 100}%` }} />
        </div>
        <ol className="mt-4 hidden grid-cols-6 gap-2 sm:grid">
          {stepTitles.map((title, index) => (
            <li key={title} className={`text-xs ${index === step ? "font-semibold text-ink" : "text-muted"}`}>
              <span className="mr-1">{index + 1}.</span>{title}
            </li>
          ))}
        </ol>
      </div>

      {step === 0 ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">Tell us about your business</h2>
            <p className="mt-2 text-sm leading-6 text-body-muted">Required fields help us understand who to contact and where your project fits.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="fullName" label="Full name" value={form.fullName} onChange={changeField} error={errors.fullName} />
            <Field name="email" label="Verified account email" type="email" value={accountEmail} onChange={changeField} error={errors.email} disabled />
            <Field name="company" label="Company or brand" value={form.company} onChange={changeField} error={errors.company} />
            <Field name="website" label="Company website" optional placeholder="https://" value={form.website} onChange={changeField} error={errors.website} />
            <div>
              <label htmlFor="discovery-country" className="mb-2 block text-sm font-medium">Country <span aria-hidden="true">*</span></label>
              <select id="discovery-country" required value={form.country} onChange={(event) => changeField("country", event.target.value)} aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? "discovery-country-error" : undefined} className="w-full rounded-xl border border-divider-strong bg-surface px-4 py-3 outline-none focus:border-ink">
                <option value="">Choose a country</option>
                {businessCountries.map((country) => <option key={country}>{country}</option>)}
              </select>
              {errors.country ? <p id="discovery-country-error" className="mt-1 text-sm text-danger-strong">{errors.country}</p> : null}
            </div>
            <Field name="timeZone" label="Time zone" placeholder="e.g. Europe/London or UTC−5" value={form.timeZone} onChange={changeField} error={errors.timeZone} />
            <div>
              <label htmlFor="discovery-industry" className="mb-2 block text-sm font-medium">Industry <span aria-hidden="true">*</span></label>
              <select id="discovery-industry" required value={form.industry} onChange={(event) => changeField("industry", event.target.value)} aria-invalid={Boolean(errors.industry)} aria-describedby={errors.industry ? "discovery-industry-error" : undefined} className="w-full rounded-xl border border-divider-strong bg-surface px-4 py-3 outline-none focus:border-ink">
                <option value="">Choose an industry</option>
                {["Technology / SaaS", "E-commerce / Retail", "Healthcare", "Finance", "Education", "Professional services", "Media / Entertainment", "Other"].map((industry) => <option key={industry}>{industry}</option>)}
              </select>
              {errors.industry ? <p id="discovery-industry-error" className="mt-1 text-sm text-danger-strong">{errors.industry}</p> : null}
            </div>
            <div>
              <label htmlFor="discovery-stage" className="mb-2 block text-sm font-medium">Business stage <span aria-hidden="true">*</span></label>
              <select id="discovery-stage" required value={form.businessStage} onChange={(event) => changeField("businessStage", event.target.value)} aria-invalid={Boolean(errors.businessStage)} aria-describedby={errors.businessStage ? "discovery-stage-error" : undefined} className="w-full rounded-xl border border-divider-strong bg-surface px-4 py-3 outline-none focus:border-ink">
                <option value="">Choose a stage</option>
                {["Exploring an idea", "Pre-launch / startup", "Established business", "Growing product", "Enterprise / organisation", "Other"].map((stage) => <option key={stage}>{stage}</option>)}
              </select>
              {errors.businessStage ? <p id="discovery-stage-error" className="mt-1 text-sm text-danger-strong">{errors.businessStage}</p> : null}
            </div>
          </div>
          <TextArea name="businessModel" label="How does the business create value or earn revenue?" value={form.businessModel} onChange={changeField} hint="Optional. For example, subscriptions, product sales, services, or a marketplace." rows={3} />
        </div>
      ) : null}

      {step === 1 ? (
        <fieldset>
          <legend className="text-2xl font-semibold">Which services would be useful?</legend>
          <p className="mt-2 text-sm leading-6 text-body-muted">Choose all that apply. Your selection shapes the next questions.</p>
          {errors.services ? <p role="alert" className="mt-3 text-sm text-danger-strong">{errors.services}</p> : null}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {discoveryServiceCategories.map((service) => {
              const selected = form.services.includes(service);
              return (
                <label key={service} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${selected ? "border-ink bg-accent-pale" : "border-divider-strong hover:border-black/25"}`}>
                  <input type="checkbox" checked={selected} onChange={(event) => {
                    setSubmissionKey("");
                    setForm((current) => ({
                      ...current,
                      services: event.target.checked ? [...current.services, service] : current.services.filter((item) => item !== service),
                    }));
                    setErrors((current) => ({ ...current, services: "" }));
                  }} className="mt-1 size-4 accent-ink" />
                  <span className="text-sm font-medium leading-6">{service}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-semibold">A few questions about your selected services</h2>
            <p className="mt-2 text-sm leading-6 text-body-muted">These are optional. Skip anything you have not decided yet.</p>
          </div>
          {groups.length === 0 ? <p className="rounded-xl bg-paper p-4 text-sm">Select services in the previous step to get tailored questions.</p> : null}
          {groups.map((group) => (
            <fieldset key={group.title} className="space-y-5 border-t border-divider-strong pt-6">
              <legend className="px-1 text-lg font-semibold">{group.title}</legend>
              {group.questions.map((question) => (
                <div key={question.key}>
                  {question.options ? (
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">{question.label} <span className="font-normal text-muted">(optional, choose any)</span></legend>
                      <div className="flex flex-wrap gap-2">
                        {question.options.map((option) => {
                          const selected = Array.isArray(form.answers[question.key]) && (form.answers[question.key] as string[]).includes(option);
                          return (
                            <label key={option} className={`cursor-pointer rounded-full border px-3 py-2 text-sm ${selected ? "border-ink bg-accent-soft" : "border-divider-strong bg-surface"}`}>
                              <input className="sr-only" type="checkbox" checked={Boolean(selected)} onChange={(event) => toggleChoice(question.key, option, event.target.checked)} />
                              {option}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ) : (
                    <TextArea name={question.key} label={question.label} hint={question.hint} optional value={typeof form.answers[question.key] === "string" ? form.answers[question.key] as string : ""} onChange={(name, value) => {
                      setSubmissionKey("");
                      setForm((current) => ({ ...current, answers: { ...current.answers, [name]: value } }));
                    }} />
                  )}
                </div>
              ))}
            </fieldset>
          ))}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">Project details</h2>
            <p className="mt-2 text-sm leading-6 text-body-muted">Only the project overview is required. Share estimates where you can; “not sure yet” is fine.</p>
          </div>
          <TextArea name="projectOverview" label="Project overview" optional={false} value={form.projectOverview} onChange={changeField} error={errors.projectOverview} hint="What are you building or improving, who is it for, and what prompted the project?" rows={5} />
          <TextArea name="objectives" label="Business objectives" value={form.objectives} onChange={changeField} hint="What would meaningful progress look like?" />
          <TextArea name="mustHaveFeatures" label="Must-have features" value={form.mustHaveFeatures} onChange={changeField} />
          <TextArea name="niceToHaveFeatures" label="Nice-to-have features" value={form.niceToHaveFeatures} onChange={changeField} />
          <TextArea name="constraints" label="Constraints, dependencies, or additional requirements" value={form.constraints} onChange={changeField} hint="For example, existing systems, launch dependencies, accessibility needs, or approvals." />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="discovery-budget" className="mb-2 block text-sm font-medium">Estimated budget <span className="font-normal text-muted">(optional)</span></label>
              <select id="discovery-budget" value={form.budget} onChange={(event) => changeField("budget", event.target.value)} className="w-full rounded-xl border border-divider-strong bg-surface px-4 py-3 outline-none focus:border-ink">
                <option value="">Not sure yet</option>
                {["Under $5,000", "$5,000–$15,000", "$15,000–$30,000", "$30,000–$60,000", "$60,000+", "Prefer to discuss"].map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
            <Field name="timeline" label="Desired timeline" optional placeholder="e.g. Target launch in Q3" value={form.timeline} onChange={changeField} />
          </div>
          <Field name="productUrl" label="Existing product or website URL" optional placeholder="https://" value={form.productUrl} onChange={changeField} />
          <TextArea name="competitorReferences" label="Competitor or inspiration references" value={form.competitorReferences} onChange={changeField} />
          <div>
            <label htmlFor="discovery-attachments" className="mb-2 block text-sm font-medium">Attachments <span className="font-normal text-muted">(optional)</span></label>
            <p className="mb-3 text-sm leading-6 text-body-muted">Attach up to 3 PDF, JPG, PNG, or WebP files, 5 MB each. Files are uploaded to private storage with your submission. Attachments are not saved in your browser draft.</p>
            <label htmlFor="discovery-attachments" className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/15 px-4 py-2.5 text-sm font-medium hover:border-black/35">
              <FileUp size={16} aria-hidden="true" /> Choose files
            </label>
            <input id="discovery-attachments" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              setSubmissionKey("");
              setFileNotice(selected.length > 3 ? "Only the first 3 files were kept; remove or replace files as needed." : "");
              setFiles(selected.slice(0, 3));
              event.target.value = "";
            }} />
            {fileNotice ? <p className="mt-2 text-sm text-warning-deep">{fileNotice}</p> : null}
            {files.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2 text-sm">
                    <span className="truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button type="button" aria-label={`Remove ${file.name}`} onClick={() => {
                      setSubmissionKey("");
                      setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
                    }} className="shrink-0 text-muted hover:text-danger-strong"><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <fieldset>
          <legend className="text-2xl font-semibold">How would you like to work through discovery?</legend>
          <p className="mt-2 text-sm leading-6 text-body-muted">A request is not a confirmed booking. We will coordinate the next step by email.</p>
          <div className="mt-6 space-y-3">
            {[
              { title: "Self-Guided Discovery", value: "Self-guided discovery", detail: "Complete this questionnaire at your own pace. We will review it and follow up." },
              { title: "Discovery Interview", value: "Discovery interview", detail: "Request a two-way conversation about your business, goals, and requirements." },
              { title: "Live Demo or Product Walkthrough", value: "Live demo or product walkthrough", detail: "Request a walkthrough of an existing website, app, product, or prototype." },
            ].map((method) => (
              <label key={method.value} className={`block cursor-pointer rounded-2xl border p-5 ${form.discoveryMethod === method.value ? "border-ink bg-accent-pale" : "border-divider-strong"}`}>
                <span className="flex items-start gap-3">
                  <input type="radio" name="discoveryMethod" value={method.value} checked={form.discoveryMethod === method.value} onChange={(event) => changeField("discoveryMethod", event.target.value)} className="mt-1 accent-ink" />
                  <span><span className="font-semibold">{method.title}</span><span className="mt-1 block text-sm leading-6 text-body-muted">{method.detail}</span></span>
                </span>
              </label>
            ))}
          </div>
          {errors.discoveryMethod ? <p role="alert" className="mt-3 text-sm text-danger-strong">{errors.discoveryMethod}</p> : null}
          {form.discoveryMethod !== "Self-guided discovery" ? (
            <div className="mt-6">
              <TextArea name="preferredTimes" label="Preferred days / times and time zone" hint={`Your time zone: ${form.timeZone || "not specified"}. Please include a few options that work for you.`} value={form.preferredTimes} onChange={changeField} />
              {calendlyUrl ? <p className="mt-3 text-sm text-body-muted">After your request is submitted, you can also choose a time using our scheduling link.</p> : null}
            </div>
          ) : null}
        </fieldset>
      ) : null}

      {step === 5 ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">Review your discovery request</h2>
            <p className="mt-2 text-sm leading-6 text-body-muted">Use Edit to return to any section before you submit. This request is a lead, not an accepted project or binding quote.</p>
          </div>
          {[
            { title: "Business information", step: 0, entries: [["Name", form.fullName], ["Email", form.email], ["Company", form.company], ["Website", form.website], ["Country / time zone", `${form.country} · ${form.timeZone}`], ["Industry / stage", `${form.industry} · ${form.businessStage}`], ["Business model", form.businessModel]] },
            { title: "Services", step: 1, entries: [["Selected services", form.services.join(", ")]] },
            { title: "Project questions", step: 2, entries: Object.entries(form.answers).map(([key, value]) => [key.replace(/([A-Z])/g, " $1"), Array.isArray(value) ? value.join(", ") : value]) },
            { title: "Project details", step: 3, entries: [["Overview", form.projectOverview], ["Objectives", form.objectives], ["Must-have", form.mustHaveFeatures], ["Nice-to-have", form.niceToHaveFeatures], ["Constraints / dependencies", form.constraints], ["Budget / timeline", `${form.budget || "Not specified"} · ${form.timeline || "Not specified"}`], ["Existing URL", form.productUrl], ["References", form.competitorReferences], ["Attachments", files.map((file) => file.name).join(", ") || "None"]] },
            { title: "Discovery method", step: 4, entries: [["Method", form.discoveryMethod], ["Preferred times", form.preferredTimes]] },
          ].map((section) => (
            <section key={section.title} className="rounded-2xl border border-divider-strong p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{section.title}</h3>
                <button type="button" onClick={() => setStep(section.step)} className="text-sm font-medium underline underline-offset-4">Edit</button>
              </div>
              <dl className="mt-4 space-y-3">
                {section.entries.filter((entry) => isFilled(entry[1] as string | string[])).map(([label, value]) => (
                  <div key={label} className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
                    <dt className="font-medium text-body-muted">{label}</dt>
                    <dd className="whitespace-pre-wrap break-words">{Array.isArray(value) ? value.join(", ") : value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <label className="flex items-start gap-3 rounded-xl bg-paper p-4 text-sm leading-6">
            <input type="checkbox" checked={form.consent} onChange={(event) => {
              setSubmissionKey("");
              setForm((current) => ({ ...current, consent: event.target.checked }));
              setErrors((current) => ({ ...current, consent: "" }));
            }} className="mt-1 size-4 accent-ink" />
            <span>I agree that Rapidlyon may use these details and any attachments to assess and respond to my project request, as described in the <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>. <span aria-hidden="true">*</span></span>
          </label>
          {errors.consent ? <p role="alert" className="text-sm text-danger-strong">{errors.consent}</p> : null}
          <p className="text-sm leading-6 text-body-muted">After submission, the team will review fit and feasibility and follow up by email. A written scope and agreement are required before work begins; meeting requests are not bookings.</p>
        </div>
      ) : null}

      {notice ? (
        <p className={`mt-6 rounded-xl px-4 py-3 text-sm ${status === "error" || (Object.keys(errors).length > 0) ? "border border-danger-line bg-danger-soft text-danger-deep" : "border border-divider bg-paper text-ink"}`} role={status === "error" || Object.keys(errors).length > 0 ? "alert" : "status"} aria-live={status === "error" || Object.keys(errors).length > 0 ? "assertive" : "polite"}>
          {notice}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-divider-strong pt-6 sm:flex-row">
        <button type="button" disabled={step === 0 || status === "submitting"} onClick={() => { setNotice(""); setStep((current) => Math.max(0, current - 1)); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-black/15 px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40">
          <ArrowLeft size={16} aria-hidden="true" /> Back
        </button>
        {step < stepTitles.length - 1 ? (
          <button type="button" onClick={nextStep} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-on-dark hover:bg-charcoal">
            Continue <ArrowRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <button type="submit" disabled={status === "submitting"} className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-on-dark hover:bg-charcoal disabled:cursor-wait disabled:opacity-60">
            {status === "submitting" ? "Submitting…" : "Submit discovery request"}
          </button>
        )}
      </div>
      <label className="sr-only" aria-hidden="true">
        Leave this field empty
        <input tabIndex={-1} autoComplete="off" name="companyWebsite" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
      </label>
    </form>
  );
}
