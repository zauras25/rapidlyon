'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getEngagementOption } from '@/data/engagement-options';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, CheckCircle2, PenTool, Search, Code2 } from 'lucide-react';

const inquiryReasons = [
  { value: 'project', label: 'I have a project or new idea' },
  { value: 'existing', label: 'I need help with unfinished or existing work' },
  { value: 'pricing', label: 'I have a pricing or service question' },
  { value: 'urgent', label: 'I have an urgent problem' },
  { value: 'other', label: 'Something else' },
] as const;

type InquiryReason = (typeof inquiryReasons)[number]['value'];
type ReplyMethod = 'email' | 'whatsapp';
type ServiceKey = 'design' | 'dev' | 'seo';

const ageOptions = ['18–24', '25–34', '35–44', '45–54', '55+', 'Prefer not to say'];
const genderOptions = ['Woman', 'Man', 'Non-binary', 'Self-describe', 'Prefer not to say'];
const roleOptions = [
  { value: 'owner', label: 'Business owner / Founder' },
  { value: 'employee', label: 'Employee / Coordinator' },
  { value: 'agency', label: 'Agency / Consultant' },
  { value: 'individual', label: 'Individual / Personal project' },
];
const approvalOptions = [
  { value: 'self', label: 'I have approval authority' },
  { value: 'manager', label: 'Manager / Business owner' },
  { value: 'client', label: 'External client' },
  { value: 'team', label: 'Multiple stakeholders' },
  { value: 'unknown', label: 'Not decided yet' },
];
const availabilityOptions = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'evenings', label: 'Evenings' },
  { value: 'weekends', label: 'Weekends only' },
  { value: 'async', label: 'Limited time / Prefer async' },
];
const timeZoneOptions = [
  { value: 'Asia/Karachi', label: 'Pakistan (PKT)' },
  { value: 'Asia/Dubai', label: 'UAE (GST)' },
  { value: 'Europe/London', label: 'United Kingdom' },
  { value: 'America/New_York', label: 'US Eastern' },
  { value: 'other', label: 'Other / Confirm later' },
];

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  const required = label.trimEnd().endsWith('*');
  const text = required ? label.trimEnd().slice(0, -1).trimEnd() : label;
  return (
    <label className={'form-field ' + className}>
      <span>
        {text}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Status({ message, error = false }: { message: string; error?: boolean }) {
  return message ? (
    <div className={'form-result' + (error ? ' error' : '')} role={error ? 'alert' : 'status'}>
      {message}
    </div>
  ) : null;
}

export function InquiryForm() {
  const router = useRouter();
  const [reason, setReason] = useState<InquiryReason>('project');
  const [replyMethod, setReplyMethod] = useState<ReplyMethod>('email');
  const [timeSensitive, setTimeSensitive] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptStatusUrl, setReceiptStatusUrl] = useState('');
  const [submittedBefore, setSubmittedBefore] = useState(false);
  const inquiryKey = useRef<string | null>(null);

  const detailPlaceholder = useMemo(() => {
    if (reason === 'existing') return 'My Figma project is half complete and I need help finishing it...';
    if (reason === 'pricing') return 'I would like to know what your services cost...';
    if (reason === 'urgent') return 'My site is having an urgent issue...';
    return 'What do you need help with?';
  }, [reason]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittedBefore) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get('name') || '').trim();
    const email = String(form.get('email') || '').trim();
    const messageText = String(form.get('message') || '').trim();
    const wp = String(form.get('whatsapp') || '').trim();

    if (name.length < 2 || !email || !messageText) {
      setError('Please complete your name, email and message before submitting.');
      const field = name.length < 2 ? 'name' : !email ? 'email' : 'message';
      formElement.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`)?.focus();
      return;
    }

    if (replyMethod === 'whatsapp' && !wp) {
      setError('Please add your WhatsApp number so we can reply there.');
      return;
    }

    if (sending) return;
    setSending(true);
    setError('');
    if (!inquiryKey.current) inquiryKey.current = crypto.randomUUID();
    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: inquiryKey.current,
          name, email,
          reason,
          preferredReplyMethod: replyMethod,
          whatsappNumber: replyMethod === 'whatsapp' ? wp : '',
          timeSensitive,
          service: 'Not sure yet',
          projectDescription: messageText,
          companyWebsite: '',
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'We could not send your inquiry.');
      setClientName(name);
      setClientEmail(email);
      setClientMessage(messageText);
      setReceiptMessage(result.message || 'Your inquiry was received.');
      setReceiptReference(result.reference || '');
      setReceiptStatusUrl(typeof result.statusUrl === 'string' ? result.statusUrl : '');
      setSubmittedBefore(true);
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit the inquiry. Please try again.');
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <div className="form-panel">
        <p className="eyebrow">GENERAL INQUIRY / GET IN TOUCH</p>
        <h3 style={{ fontSize: '1.8rem', marginBottom: 10 }}>Your inquiry is ready</h3>
        <p className="form-hint" style={{ marginBottom: 22 }}>
          Thank you, {clientName}. {receiptMessage}
        </p>
        <Status message={error} error />
        <div className="content-card" style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {receiptReference && <div><strong>Reference</strong><div>{receiptReference}</div></div>}
            <div><strong>Client name</strong><div>{clientName}</div></div>
            <div><strong>Client email</strong><div>{clientEmail}</div></div>
            <div><strong>Client message</strong><div>{clientMessage}</div></div>
          </div>
        </div>
        {receiptStatusUrl && <a className="btn btn-outline btn-sm" href={receiptStatusUrl} rel="noreferrer">Check request status</a>}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-dark"
            onClick={() => {
              // Keep contact details out of browser history, server logs and referrer headers.
              try {
                sessionStorage.setItem('rapidlyon_inquiry_to_discovery', JSON.stringify({
                  name: clientName, email: clientEmail, message: clientMessage,
                  replyMethod, whatsapp: whatsappNumber, urgent: timeSensitive,
                }));
              } catch {
                setError('Your browser blocked the secure prefill transfer. Use Go to Discovery and enter your details there.');
                return;
              }
              router.push('/discovery');
            }}
          >
            Continue to discovery <ArrowRight size={17} />
          </button>
          <button type="button" className="btn btn-outline" onClick={() => { setSubmittedBefore(true); setSubmitted(false); }}>
            Edit inquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="form-panel" onSubmit={handleSubmit}>
      <p className="eyebrow">GENERAL INQUIRY / GET IN TOUCH</p>
      <h3 style={{ fontSize: '1.9rem', marginBottom: 12 }}>Every great project starts with a conversation.</h3>
      <p className="form-hint" style={{ marginBottom: 24 }}>
        Have an idea, an unfinished project, a question about pricing or an urgent website problem? Tell us in your own words.
      </p>
      {submittedBefore && (
        <p className="form-result" role="status">
          This inquiry has already been sent. You can review your answers, but edits here will not change the submitted request. Contact RapidlyOn with your reference to update it.
        </p>
      )}

      <div className="form-grid">
        <Field label="Your full name *">
          <input name="name" autoComplete="name" placeholder="What should we call you?" defaultValue={clientName} minLength={2} maxLength={120} required />
        </Field>

        <Field label="Email address *">
          <input type="email" name="email" autoComplete="email" placeholder="you@company.com" defaultValue={clientEmail} maxLength={254} required />
        </Field>

        <div className="full" style={{ display: 'grid', gap: 10 }}>
          <span style={{ fontWeight: 700 }}>What brings you here?</span>
          <div className="radio-list" role="radiogroup" aria-label="What brings you here?">
            {inquiryReasons.map((item) => (
              <label key={item.value} className="check-row" style={{ margin: 0 }}>
                <input
                  type="radio"
                  name="reason"
                  value={item.value}
                  checked={reason === item.value}
                  onChange={() => setReason(item.value)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <Field label="Tell us a little more *" className="full">
          <textarea name="message" rows={4} placeholder={detailPlaceholder} defaultValue={clientMessage} maxLength={5000} required />
          <span className="form-hint">English ya Urdu mein likh sakte hain. Technical details zaroori nahi.</span>
        </Field>

        <div className="full" style={{ display: 'grid', gap: 10 }}>
          <span style={{ fontWeight: 700 }}>Preferred reply method</span>
          <div className="radio-list" role="radiogroup" aria-label="Preferred reply method">
            <label className="check-row" style={{ margin: 0 }}>
              <input
                type="radio"
                name="replyMethod"
                value="email"
                checked={replyMethod === 'email'}
                onChange={() => setReplyMethod('email')}
              />
              <span>Email</span>
            </label>
            <label className="check-row" style={{ margin: 0 }}>
              <input
                type="radio"
                name="replyMethod"
                value="whatsapp"
                checked={replyMethod === 'whatsapp'}
                onChange={() => setReplyMethod('whatsapp')}
              />
              <span>WhatsApp</span>
            </label>
          </div>
        </div>

        {replyMethod === 'whatsapp' && (
          <Field label="WhatsApp number *">
            <input
              name="whatsapp"
              type="tel"
              value={whatsappNumber}
              onChange={(event) => setWhatsappNumber(event.currentTarget.value)}
              placeholder="+92 3XX XXXXXXX"
              minLength={5}
              maxLength={40}
              required
            />
          </Field>
        )}

        <div className="full" style={{ display: 'grid', gap: 10 }}>
          <label className="check-row" style={{ margin: 0 }}>
            <input type="checkbox" checked={timeSensitive} onChange={(event) => setTimeSensitive(event.currentTarget.checked)} />
            <span>This is time-sensitive</span>
          </label>
          {timeSensitive && (
            <div className="content-card" style={{ padding: 16 }}>
              <strong>Urgent request</strong>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                We&apos;ll assess the urgency and required response. Immediate service or delivery is not guaranteed.
              </p>
            </div>
          )}
        </div>
      </div>


      <div style={{ marginTop: 18 }}>
        <Status message={error} error />
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <p className="form-hint">No commitment required. We&apos;ll use these details to respond to your inquiry. Please don&apos;t share passwords.</p>
        <button className="btn btn-dark" type="submit" disabled={sending || submittedBefore} style={{ justifySelf: 'flex-start' }}>
          {sending ? 'Sending…' : 'Send inquiry'} <ArrowRight size={17} />
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <p className="form-hint">
          Already ready to discuss a project? <a href="/discovery">Go to Discovery</a>
        </p>
      </div>
    </form>
  );
}

export function DiscoveryForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<ServiceKey[]>(['design']);
  const [values, setValues] = useState<Record<string, string>>({
    name: '',
    email: '',
    business: '',
    age: '',
    gender: '',
    genderDescription: '',
    role: 'owner',
    approval: '',
    digitalExperience: 'new',
    collaboration: 'guided',
    availability: 'flexible',
    timezone: 'Asia/Karachi',
    country: '',
    projectBusiness: '',
    industry: '',
    projectSituation: 'idea',
    existingAssetLink: '',
    desiredOutcome: '',
    audience: '',
    designSituation: 'new',
    designSummary: '',
    designImprovement: '',
    designActivity: '',
    designReference: '',
    devState: 'figma',
    devRequirements: '',
    devReference: '',
    seoStatus: 'live',
    seoObjective: 'ranking',
    seoUrl: '',
    seoAudience: '',
    communication: 'email',
    contactNumber: '',
    urgency: 'normal',
    urgencyReason: '',
    timeframe: 'flexible',
    budgetStatus: 'unknown',
    budgetAmount: '',
    constraints: '',
  });
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [receiptMessage, setReceiptMessage] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptStatusUrl, setReceiptStatusUrl] = useState('');
  const [submittedBefore, setSubmittedBefore] = useState(false);
  const submissionKey = useRef<string | null>(null);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationInvalid, setInvitationInvalid] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState('');

  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(() => {
    if (!mounted) return;
    const params = new URLSearchParams(window.location.search);
    try {
      const saved = sessionStorage.getItem('rapidlyon_inquiry_to_discovery');
      if (saved) {
        const prior: unknown = JSON.parse(saved);
        sessionStorage.removeItem('rapidlyon_inquiry_to_discovery');
        if (typeof prior === 'object' && prior !== null) {
          const prefill = prior as Record<string, unknown>;
          setValues(v => ({
            ...v,
            name: typeof prefill.name === 'string' ? prefill.name : v.name,
            email: typeof prefill.email === 'string' ? prefill.email : v.email,
            desiredOutcome: typeof prefill.message === 'string' ? prefill.message : v.desiredOutcome,
            communication: prefill.replyMethod === 'whatsapp' ? 'whatsapp' : v.communication,
            contactNumber: typeof prefill.whatsapp === 'string' ? prefill.whatsapp : v.contactNumber,
            urgency: prefill.urgent === true ? 'urgent' : v.urgency,
          }));
        }
      }
    } catch {
      setValidationMessage('Inquiry details could not be transferred. Please enter the information again.');
    }
    // Keep service and package links used by the existing public site working.
    const pkg = params.get('package');
    let packageSelected = false;
    if (pkg) {
      const option = getEngagementOption(pkg);
      if (option) {
        setSelectedPackageId(option.id);
        const mapped = option.services.map(service => service === 'Product Design' ? 'design' : service === 'Next.js Development' ? 'dev' : service === 'SEO' ? 'seo' : null).filter((v): v is ServiceKey => Boolean(v));
        if (mapped.length) {
          setSelectedServices(mapped);
          packageSelected = true;
        }
      }
    }
    if (!packageSelected) {
      const requestedServices = [
        ...params.getAll('service'),
        ...(params.get('services') || '').split(',').filter(Boolean),
      ];
      const serviceValues: Record<string, ServiceKey> = {
        design: 'design',
        'product-design': 'design',
        'ux-ui-design': 'design',
        'ux-ui-product-design': 'design',
        dev: 'dev',
        development: 'dev',
        'nextjs-development': 'dev',
        'next-js-development': 'dev',
        'website-development': 'dev',
        seo: 'seo',
        'seo-website-optimization': 'seo',
      };
      const mappedServices = [...new Set(requestedServices.map(value => serviceValues[value.trim().toLowerCase().replace(/[./\s]+/g, '-')]).filter((value): value is ServiceKey => Boolean(value)))];
      if (mappedServices.length) setSelectedServices(mappedServices);
    }
    // Invitation routes are retained: verify and bind to its lead, not a new inquiry.
    const token = params.get('invite');
    if (token) {
      const cleaned = new URL(window.location.href);
      cleaned.searchParams.delete('invite');
      window.history.replaceState(null, '', cleaned.pathname + cleaned.search + cleaned.hash);
      fetch('/api/discovery/invite?token=' + encodeURIComponent(token), { cache: 'no-store' })
        .then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.message || 'Invitation not available.'); return data; })
        .then(data => { if (mounted) { setInvitationInvalid(false); setInvitationToken(token); setValues(v => ({...v, name:data.name || v.name, email:data.email || v.email, business:data.company || v.business})); } })
        .catch(error => { if (mounted) { setInvitationInvalid(true); setValidationMessage(error instanceof Error ? error.message : 'Invitation could not be verified.'); } });
    }
    }, 0);
    return () => { mounted = false; window.clearTimeout(timer); };
  }, []);

  const stepCount = 5;
  const update = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const selectedServiceText = selectedServices.length > 0 ? selectedServices.map((s) => ({ design: 'Product Design', dev: 'Development', seo: 'SEO' }[s])).join(', ') : 'No service selected';

  const showSelfDescribe = values.gender === 'Self-describe';
  const showApproval = values.role === 'employee' || values.role === 'agency';
  const showAssetRef = ['partial', 'live', 'problem'].includes(values.projectSituation);
  const showDesignReference = ['partial', 'improve', 'redesign'].includes(values.designSituation);
  const showDevReference = ['partial', 'figma', 'live'].includes(values.devState);
  const showSeoUrl = values.seoStatus !== 'new';
  const showContactNumber = ['whatsapp', 'voice'].includes(values.communication);
  const showBudgetAmount = values.budgetStatus === 'defined';
  const showUrgencyReason = values.urgency === 'urgent';

  function toggleService(service: ServiceKey) {
    setSelectedServices((prev) => {
      if (prev.includes(service)) return prev.length === 1 ? prev : prev.filter((item) => item !== service);
      return [...prev, service];
    });
  }

  function nextStep() {
    setCurrentStep((step) => Math.min(step + 1, stepCount));
  }

  function previousStep() {
    setCurrentStep((step) => Math.max(step - 1, 1));
  }

  const stepTitle = ['Your profile', 'Your project', 'Services', 'Planning', 'Review'][currentStep - 1];

  const descriptionForDesiredOutcome = values.digitalExperience === 'new'
    ? 'For example: I want customers to view my services, book appointments and contact me easily.'
    : 'Describe the business outcomes or problems you\'d like to solve.';

  function renderStepHeader() {
    return (
      <div style={{ marginBottom: 20 }}>
        <p className="eyebrow">PROJECT DISCOVERY</p>
        <h3 style={{ fontSize: '2rem', margin: '0 0 8px' }}>Let&apos;s understand your project.</h3>
        <p className="form-hint">A few focused questions to understand your situation. You don&apos;t need to know every technical detail.</p>
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Step {currentStep} of 5</div>
          <div className="form-hint" style={{ marginBottom: 10 }}>{stepTitle}</div>
          <div role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={5} aria-label={`Step ${currentStep} of 5: ${stepTitle}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
            {Array.from({ length: 5 }).map((_, index) => {
              const active = index + 1 === currentStep;
              const done = index + 1 < currentStep;
              return (
                <span
                  key={index}
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: done || active ? 'var(--color-primary, #45641F)' : 'var(--color-border, #e6ebdd)',
                    boxShadow: active ? '0 0 0 2px rgba(69,100,31,0.12)' : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderStep1() {
    return (
      <div>
        <h4 style={{ margin: '0 0 8px' }}>A little about you</h4>
        <p className="form-hint" style={{ marginBottom: 18 }}>Help us understand who you are and how you&apos;d prefer to work together.</p>

        <div className="form-grid">
          <Field label="Full name *">
            <input value={values.name} onChange={(e) => update('name', e.target.value)} placeholder="Full name" autoComplete="name" minLength={2} maxLength={120} required />
          </Field>
          <Field label="Email address *">
            <input type="email" value={values.email} onChange={(e) => update('email', e.target.value)} placeholder="you@company.com" autoComplete="email" maxLength={254} required />
          </Field>
          <Field label="Business or organization">
            <input value={values.business} onChange={(e) => update('business', e.target.value)} placeholder="Business name, if applicable" maxLength={160} />
          </Field>
          <Field label="Age range (optional)">
            <select value={values.age} onChange={(e) => update('age', e.target.value)}>
              <option value="">Select</option>
              {ageOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Field label="Gender (optional)">
            <select value={values.gender} onChange={(e) => update('gender', e.target.value)}>
              <option value="">Select</option>
              {genderOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          {showSelfDescribe && (
            <Field label="How would you describe your gender? (optional)">
              <input placeholder="Your description" value={values.genderDescription} onChange={(e) => update('genderDescription', e.target.value)} maxLength={5000} />
            </Field>
          )}
          <Field label="Your role in this project">
            <select value={values.role} onChange={(e) => update('role', e.target.value)}>
              {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          {showApproval && (
            <Field label="Who approves project decisions?">
              <select value={values.approval} onChange={(e) => update('approval', e.target.value)}>
                <option value="">Select</option>
                {approvalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
          )}
          <div className="full" style={{ display: 'grid', gap: 10 }}>
            <span style={{ fontWeight: 700 }}>How familiar are you with digital projects?</span>
            <div className="radio-list" role="radiogroup" aria-label="How familiar are you with digital projects?">
              {['new', 'basic', 'experienced'].map((option) => (
                <label key={option} className="check-row" style={{ margin: 0 }}>
                  <input
                    type="radio"
                    name="digitalExperience"
                    checked={values.digitalExperience === option}
                    onChange={() => update('digitalExperience', option)}
                  />
                  <span>{option === 'new' ? 'I\'m new — please guide me' : option === 'basic' ? 'I understand the basics' : 'I\'ve worked on similar projects'}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="full" style={{ display: 'grid', gap: 10 }}>
            <span style={{ fontWeight: 700 }}>How would you prefer to collaborate?</span>
            <div className="radio-list" role="radiogroup" aria-label="How would you prefer to collaborate?">
              {['guided', 'collaborative', 'delegated'].map((option) => (
                <label key={option} className="check-row" style={{ margin: 0 }}>
                  <input
                    type="radio"
                    name="collaboration"
                    checked={values.collaboration === option}
                    onChange={() => update('collaboration', option)}
                  />
                  <span>{option === 'guided' ? 'Guide me through important decisions' : option === 'collaborative' ? 'Regular reviews and collaboration' : 'Written updates and milestone approvals'}</span>
                </label>
              ))}
            </div>
          </div>
          <Field label="When are you usually available?">
            <select value={values.availability} onChange={(e) => update('availability', e.target.value)}>
              {availabilityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label="Country">
            <input value={values.country} onChange={(e) => update('country', e.target.value)} placeholder="Where are you based?" autoComplete="country-name" maxLength={100} />
          </Field>
          <Field label="Time zone">
            <select value={values.timezone} onChange={(e) => update('timezone', e.target.value)}>
              {timeZoneOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
        </div>

        <p className="form-hint" style={{ marginTop: 18 }}>
          Age and gender are optional demographic details. They won&apos;t determine your service eligibility, priority or pricing.
        </p>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div>
        <h4 style={{ margin: '0 0 8px' }}>Tell us about your project</h4>
        <p className="form-hint" style={{ marginBottom: 18 }}>Start with the business problem, not technical specifications.</p>

        <div className="form-grid">
          <Field label="What does your business do?" className="full">
            <textarea rows={3} value={values.projectBusiness} onChange={(e) => update('projectBusiness', e.target.value)} placeholder="Tell us about your business, customers and how you operate." maxLength={2000} />
          </Field>
          <Field label="Industry or business type">
            <input value={values.industry} onChange={(e) => update('industry', e.target.value)} placeholder="Retail, healthcare, education, SaaS, etc." maxLength={120} />
          </Field>
          <div className="full" style={{ display: 'grid', gap: 10 }}>
            <span style={{ fontWeight: 700 }}>What&apos;s the current situation?</span>
            <div className="radio-list" role="radiogroup" aria-label="What's the current situation?">
              {['idea', 'partial', 'live', 'problem', 'unsure'].map((option) => (
                <label key={option} className="check-row" style={{ margin: 0 }}>
                  <input
                    type="radio"
                    name="projectSituation"
                    checked={values.projectSituation === option}
                    onChange={() => update('projectSituation', option)}
                  />
                  <span>{option === 'idea' ? 'Starting something new' : option === 'partial' ? 'Work is partially completed' : option === 'live' ? 'Already have a live website or app' : option === 'problem' ? 'Something is broken or underperforming' : 'I\'m not sure what I need yet'}</span>
                </label>
              ))}
            </div>
          </div>
          {showAssetRef && (
            <Field label="Existing website, design or project link" className="full">
              <input value={values.existingAssetLink} onChange={(e) => update('existingAssetLink', e.target.value)} placeholder="Public or view-only link" maxLength={500} />
            </Field>
          )}
          <Field label="What do you want to achieve?" className="full">
            <textarea rows={3} value={values.desiredOutcome} onChange={(e) => update('desiredOutcome', e.target.value)} placeholder={descriptionForDesiredOutcome} maxLength={5000} />
          </Field>
          <Field label="Who will use your website or product?" className="full">
            <textarea rows={2} value={values.audience} onChange={(e) => update('audience', e.target.value)} placeholder="Customers, students, staff, partners, visitors..." maxLength={5000} />
          </Field>
        </div>
      </div>
    );
  }

  function renderStep3() {
    return (
      <div>
        <h4 style={{ margin: '0 0 8px' }}>What support do you need?</h4>
        <p className="form-hint" style={{ marginBottom: 18 }}>Select one, two or all three. Only relevant questions will appear.</p>

        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {[
            { key: 'design', title: 'Product Design', description: 'New products, UX/UI, Figma and redesign', icon: <PenTool size={18} /> },
            { key: 'dev', title: 'Development', description: 'Websites, applications, code and integrations', icon: <Code2 size={18} /> },
            { key: 'seo', title: 'SEO', description: 'Visibility, rankings and technical SEO', icon: <Search size={18} /> },
          ].map((service) => {
            const active = selectedServices.includes(service.key as ServiceKey);
            return (
              <button
                type="button"
                key={service.key}
                className="content-card"
                aria-pressed={active}
                onClick={() => toggleService(service.key as ServiceKey)}
                style={{
                  textAlign: 'left',
                  padding: 18,
                  border: active ? '1px solid var(--color-primary, #45641F)' : '1px solid var(--color-border, #dfe7d6)',
                  background: active ? 'rgba(148, 206, 40, 0.08)' : 'var(--color-surface, #fff)',
                  color: 'var(--color-text, inherit)',
                  boxShadow: active ? '0 0 0 1px rgba(69,100,31,0.12)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong>{service.title}</strong>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {service.icon}
                    {active && <CheckCircle2 size={18} aria-label="Selected" />}
                  </span>
                </div>
                <div>{service.description}</div>
                <div style={{ marginTop: 12, fontWeight: 700 }}>{active ? 'Selected' : 'Select service'}</div>
              </button>
            );
          })}
        </div>

        {selectedServices.length > 1 && (
          <div className="content-card" style={{ marginTop: 18, padding: 16 }}>
            <strong>Multiple services selected</strong>
            <p style={{ marginTop: 8, marginBottom: 0 }}>
              Shared information will be reused. Our team will assess each service separately and coordinate dependencies.
            </p>
          </div>
        )}

        {selectedServices.includes('design') && (
          <div className="content-card" style={{ marginTop: 22, padding: 20 }}>
            <h5 style={{ marginTop: 0 }}>Product Design</h5>
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>What&apos;s your design situation?</div>
                <div className="radio-list" role="radiogroup" aria-label="What's your design situation?">
                  {['new', 'partial', 'redesign', 'improve'].map((option) => (
                    <label key={option} className="check-row" style={{ margin: 0 }}>
                      <input type="radio" name="designSituation" checked={values.designSituation === option} onChange={() => update('designSituation', option)} />
                      <span>{option === 'new' ? 'New idea — no designs yet' : option === 'partial' ? 'Figma or design partially complete' : option === 'redesign' ? 'Existing website or app needs redesign' : 'Existing designs need improvements'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {['partial', 'improve'].includes(values.designSituation) && (
                <Field label="What is complete, and what remains?">
                  <textarea rows={3} value={values.designSummary} onChange={(e) => update('designSummary', e.target.value)} placeholder="Existing screens, missing pages, components, responsiveness..." maxLength={5000} />
                </Field>
              )}

              {values.designSituation === 'redesign' && (
                <Field label="What should improve?">
                  <textarea rows={3} value={values.designImprovement} onChange={(e) => update('designImprovement', e.target.value)} placeholder="Usability, visual quality, conversion, workflow issues..." maxLength={5000} />
                </Field>
              )}

              {values.designSituation === 'new' && (
                <Field label="What should people be able to do?">
                  <textarea rows={3} value={values.designActivity} onChange={(e) => update('designActivity', e.target.value)} placeholder="Key user activities and features..." maxLength={5000} />
                </Field>
              )}

              {showDesignReference && (
                <Field label="Design link, if not already shared">
                  <input value={values.designReference} onChange={(e) => update('designReference', e.target.value)} placeholder="Optional view-only Figma or website URL" maxLength={1000} />
                </Field>
              )}
            </div>
          </div>
        )}

        {selectedServices.includes('dev') && (
          <div className="content-card" style={{ marginTop: 22, padding: 20 }}>
            <h5 style={{ marginTop: 0 }}>Development</h5>
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>What do you already have?</div>
                <div className="radio-list" role="radiogroup" aria-label="What do you already have?">
                  {['figma', 'partial', 'live', 'new', 'unsure'].map((option) => (
                    <label key={option} className="check-row" style={{ margin: 0 }}>
                      <input type="radio" name="devState" checked={values.devState === option} onChange={() => update('devState', option)} />
                      <span>{option === 'figma' ? 'Completed Figma designs' : option === 'partial' ? 'Partially written code / unfinished project' : option === 'live' ? 'Existing live website or app' : option === 'new' ? 'Starting development from scratch' : 'Not sure about the technical situation'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Field label="What should the product do?">
                <textarea rows={3} value={values.devRequirements} onChange={(e) => update('devRequirements', e.target.value)} placeholder="Features, accounts, booking, payments, integrations, existing issues..." maxLength={5000} />
              </Field>

              {showDevReference && (
                <Field label="Additional reference, if different">
                  <input value={values.devReference} onChange={(e) => update('devReference', e.target.value)} placeholder="View-only design, repository or public site link" maxLength={1000} />
                </Field>
              )}
            </div>
          </div>
        )}

        {selectedServices.includes('seo') && (
          <div className="content-card" style={{ marginTop: 22, padding: 20 }}>
            <h5 style={{ marginTop: 0 }}>SEO</h5>
            <div style={{ display: 'grid', gap: 18 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>What&apos;s your website&apos;s status?</div>
                <div className="radio-list" role="radiogroup" aria-label="What's your website's status?">
                  {['live', 'new', 'migration', 'unknown'].map((option) => (
                    <label key={option} className="check-row" style={{ margin: 0 }}>
                      <input type="radio" name="seoStatus" checked={values.seoStatus === option} onChange={() => update('seoStatus', option)} />
                      <span>{option === 'live' ? 'Already live' : option === 'new' ? 'Not launched yet' : option === 'migration' ? 'Being redesigned or migrated' : 'Not sure'}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Field label="What&apos;s your main SEO objective or problem?">
                <select value={values.seoObjective} onChange={(e) => update('seoObjective', e.target.value)}>
                  {['ranking', 'traffic', 'indexing', 'local', 'technical', 'new', 'unknown'].map((option) => (
                    <option key={option} value={option}>{option === 'ranking' ? 'Poor search rankings' : option === 'traffic' ? 'Low organic traffic or leads' : option === 'indexing' ? 'Not showing in Google' : option === 'local' ? 'Local search / Maps' : option === 'technical' ? 'Technical SEO issues' : option === 'new' ? 'SEO for a new website' : 'Need professional diagnosis'}</option>
                  ))}
                </select>
              </Field>

              {showSeoUrl && (
                <Field label="Website URL">
                  <input value={values.seoUrl} onChange={(e) => update('seoUrl', e.target.value)} placeholder="https://example.com" maxLength={500} />
                </Field>
              )}

              <Field label="Which audience or market matters most?">
                <input value={values.seoAudience} onChange={(e) => update('seoAudience', e.target.value)} placeholder="e.g. Lahore, Pakistan, US, international" />
              </Field>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStep4() {
    return (
      <div>
        <h4 style={{ margin: '0 0 8px' }}>Let&apos;s plan around your needs</h4>
        <p className="form-hint" style={{ marginBottom: 18 }}>These are preferences and constraints — not a confirmed meeting or project schedule.</p>

        <div className="content-card" style={{ padding: 16, marginBottom: 20 }}>
          <strong>Your availability</strong>
          <div style={{ marginTop: 8 }}>{({ flexible: 'Flexible', weekdays: 'Weekdays', evenings: 'Evenings', weekends: 'Weekends only', async: 'Limited live availability' } as Record<string, string>)[values.availability]}</div>
          <button type="button" className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setCurrentStep(1)}>
            Change availability
          </button>
        </div>

        <div className="form-grid">
          <Field label="Preferred way to communicate">
            <select value={values.communication} onChange={(e) => update('communication', e.target.value)}>
              {['email', 'whatsapp', 'voice', 'video', 'flexible'].map((option) => (
                <option key={option} value={option}>{option === 'email' ? 'Email / Written messages' : option === 'whatsapp' ? 'WhatsApp' : option === 'voice' ? 'Voice call' : option === 'video' ? 'Video call' : 'No preference'}</option>
              ))}
            </select>
          </Field>

          {showContactNumber && (
            <Field label="Contact number">
              <input type="tel" value={values.contactNumber} onChange={(e) => update('contactNumber', e.target.value)} placeholder="Number with country code" maxLength={40} />
            </Field>
          )}

          <div className="full" style={{ display: 'grid', gap: 10 }}>
            <span style={{ fontWeight: 700 }}>How urgent is your project?</span>
            <div className="radio-list" role="radiogroup" aria-label="How urgent is your project?">
              {['normal', 'urgent', 'exploring'].map((option) => (
                <label key={option} className="check-row" style={{ margin: 0 }}>
                  <input type="radio" name="urgency" checked={values.urgency === option} onChange={() => update('urgency', option)} />
                  <span>{option === 'normal' ? 'Normal — proper planning matters' : option === 'urgent' ? 'Urgent — I have a deadline or active issue' : 'Just exploring, no rush'}</span>
                </label>
              ))}
            </div>
          </div>

          {showUrgencyReason && (
            <Field label="What is driving the urgency?" className="full">
              <textarea rows={2} value={values.urgencyReason} onChange={(e) => update('urgencyReason', e.target.value)} placeholder="Launch date, outage, customer impact, business deadline..." maxLength={5000} />
            </Field>
          )}

          <Field label="Desired timeframe">
            <select value={values.timeframe} onChange={(e) => update('timeframe', e.target.value)}>
              {['immediate', 'month', 'quarter', 'flexible'].map((option) => (
                <option key={option} value={option}>{option === 'immediate' ? 'As soon as feasible' : option === 'month' ? 'Within 1 month' : option === 'quarter' ? 'Within 2–3 months' : 'Flexible / Not sure'}</option>
              ))}
            </select>
          </Field>

          <div className="full" style={{ display: 'grid', gap: 10 }}>
            <span style={{ fontWeight: 700 }}>Do you have a budget in mind?</span>
            <div className="radio-list" role="radiogroup" aria-label="Do you have a budget in mind?">
              {['unknown', 'defined', 'approval', 'scope'].map((option) => (
                <label key={option} className="check-row" style={{ margin: 0 }}>
                  <input type="radio" name="budgetStatus" checked={values.budgetStatus === option} onChange={() => update('budgetStatus', option)} />
                  <span>{option === 'unknown' ? 'I\'m not sure — guide me' : option === 'defined' ? 'Yes, I have an approximate budget' : option === 'approval' ? 'Someone else needs to approve it' : 'I\'d like to understand the scope first'}</span>
                </label>
              ))}
            </div>
          </div>

          {showBudgetAmount && (
            <Field label="Approximate amount and currency" className="full">
              <input value={values.budgetAmount} onChange={(e) => update('budgetAmount', e.target.value)} placeholder="e.g. PKR 200,000 or USD 1,500" maxLength={100} />
            </Field>
          )}

          <Field label="Any other important constraints?" className="full">
            <textarea rows={3} value={values.constraints} onChange={(e) => update('constraints', e.target.value)} placeholder="Other vendors, access limitations, confidential information, language preferences, approvals..." maxLength={5000} />
          </Field>
        </div>
      </div>
    );
  }

  function renderStep5() {
    return (
      <div>
        <h4 style={{ margin: '0 0 8px' }}>Review your discovery</h4>
        <p className="form-hint" style={{ marginBottom: 18 }}>Make sure we&apos;ve understood the basics correctly.</p>

        <div style={{ display: 'grid', gap: 18 }}>
          <div className="content-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong>Your profile</strong>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setCurrentStep(1)}>Edit</button>
            </div>
            <ul style={{ margin: '14px 0 0 18px', padding: 0 }}>
              <li>Name: {values.name || 'Name not provided'}</li>
              <li>Email: {values.email || 'Email not provided'}</li>
              <li>Business or individual status: {values.business || 'Individual / business not specified'}</li>
              <li>Role: {roleOptions.find((item) => item.value === values.role)?.label || 'Not provided'}</li>
              <li>Working style: {({ guided: 'Guide me through important decisions', collaborative: 'Regular reviews and collaboration', delegated: 'Written updates and milestone approvals' } as Record<string, string>)[values.collaboration]}</li>
              <li>Availability: {({ flexible: 'Flexible', weekdays: 'Weekdays', evenings: 'Evenings', weekends: 'Weekends only', async: 'Limited live availability' } as Record<string, string>)[values.availability]}</li>
              <li>Age: {values.age || 'Age not provided'}</li>
              <li>Gender: {values.gender ? `${values.gender}${values.gender === 'Self-describe' && values.genderDescription ? `: ${values.genderDescription}` : ''}` : 'Gender not provided'}</li>
            </ul>
          </div>

          <div className="content-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong>Project</strong>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setCurrentStep(2)}>Edit</button>
            </div>
            <ul style={{ margin: '14px 0 0 18px', padding: 0 }}>
              <li>Project goal: {values.desiredOutcome || 'Project goal not described yet'}</li>
              <li>Current stage: {({ idea: 'Starting something new', partial: 'Work is partially completed', live: 'Already have a live website or app', problem: 'Something is broken or underperforming', unsure: 'I\'m not sure what I need yet' } as Record<string, string>)[values.projectSituation] || 'Not provided'}</li>
            </ul>
          </div>

          <div className="content-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong>Selected services</strong>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setCurrentStep(3)}>Edit</button>
            </div>
            <div style={{ marginTop: 12 }}>
              {selectedServices.length ? selectedServices.map((service) => (
                <span key={service} className="chip" style={{ marginRight: 8, marginBottom: 8, display: 'inline-block' }}>
                  {service === 'design' ? 'Product Design' : service === 'dev' ? 'Development' : 'SEO'}
                </span>
              )) : 'No services selected'}
            </div>
          </div>

          <div className="content-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong>Planning</strong>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setCurrentStep(4)}>Edit</button>
            </div>
            <ul style={{ margin: '14px 0 0 18px', padding: 0 }}>
              <li>Communication preference: {({ email: 'Email / Written messages', whatsapp: 'WhatsApp', voice: 'Voice call', video: 'Video call', flexible: 'No preference' } as Record<string, string>)[values.communication] || 'Not provided'}</li>
              <li>Urgency: {({ normal: 'Normal — proper planning matters', urgent: 'Urgent — I have a deadline or active issue', exploring: 'Just exploring, no rush' } as Record<string, string>)[values.urgency] || 'Not provided'}</li>
              <li>Timeline: {({ immediate: 'As soon as feasible', month: 'Within 1 month', quarter: 'Within 2–3 months', flexible: 'Flexible / Not sure' } as Record<string, string>)[values.timeframe] || 'Not provided'}</li>
              <li>Budget status: {({ unknown: 'I\'m not sure — guide me', defined: 'Yes, I have an approximate budget', approval: 'Someone else needs to approve it', scope: 'I\'d like to understand the scope first' } as Record<string, string>)[values.budgetStatus] || 'Not provided'}</li>
            </ul>
          </div>
        </div>

        <div className="content-card" style={{ marginTop: 20, padding: 18 }}>
          <h5 style={{ marginTop: 0 }}>What happens after submission?</h5>
          <p style={{ marginTop: 8, marginBottom: 10 }}>
            Your details will be reviewed. Each service will be assessed by the appropriate team member, and we may request clarification before preparing a scope and custom quotation.
          </p>
          <p style={{ margin: 0 }}>
            Submitting discovery is not a paid-work agreement or a confirmed project start.
          </p>
        </div>

        <label className="check-row" style={{ marginTop: 18 }}>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.currentTarget.checked)} required />
          <span>I agree that RapidlyOn may use these details to assess my project and contact me about this request.</span>
        </label>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="form-panel">
        <p className="eyebrow">PROJECT DISCOVERY</p>
        <h3 style={{ fontSize: '1.9rem', marginBottom: 8 }}>Your discovery is ready for review</h3>
        <p className="form-hint">{receiptMessage || 'Your discovery request has been received.'}</p>
        {receiptReference && <p className="form-hint">Reference: {receiptReference}</p>}
        {receiptStatusUrl && <a className="btn btn-outline btn-sm" href={receiptStatusUrl} rel="noreferrer">Check request status</a>}
        <div className="content-card" style={{ marginTop: 18, padding: 18 }}>
          <strong>Selected service assessments</strong>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {selectedServices.map((service) => (
              <span key={service} className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {service === 'design' ? <PenTool size={16} aria-hidden="true" /> : service === 'dev' ? <Code2 size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
                {service === 'design' ? 'Product Design' : service === 'dev' ? 'Development' : 'SEO'}
              </span>
            ))}
          </div>
        </div>
        <p className="form-hint" style={{ marginTop: 18 }}>
          RapidlyOn will review your information and determine whether specialist assessment or clarification is needed.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
          <button type="button" className="btn btn-outline" onClick={() => { setCurrentStep(5); setSubmitted(false); }}>
            Review or edit submission
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="form-panel rapidlyon-approved-form" onSubmit={(event) => {
      event.preventDefault();
      setValidationMessage('');

      if (currentStep < stepCount) {
        nextStep();
        return;
      }

      if (invitationInvalid) {
        setValidationMessage('This invitation could not be verified. Please request a fresh invitation.');
        return;
      }

      if (submittedBefore) {
        setValidationMessage('This request has already been submitted. Changes here will not update it; contact RapidlyOn with your reference.');
        return;
      }

      if (!selectedServices.length) {
        setValidationMessage('Please select at least one service to continue.');
        setCurrentStep(3);
        return;
      }

      if (values.name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
        setValidationMessage('Please provide a valid full name and email address.');
        setCurrentStep(1);
        return;
      }

      if (!consent) {
        setValidationMessage('Please agree before submitting.');
        return;
      }

      // The approved UX only requires name, email, service and consent.
      // The existing Supabase API requires a 20-character projectOverview.
      // Build it from real user selections if the optional free-text brief is short.
      const statedOverview = [values.desiredOutcome, values.projectBusiness, values.audience].filter(v => v.trim()).join(' · ').trim();
      const projectOverview = statedOverview.length >= 20
        ? statedOverview.slice(0, 5000)
        : `Discovery assessment requested for ${selectedServiceText}. ${statedOverview}`.trim().slice(0, 5000);

      if (sending) return;
      setSending(true);
      if (!submissionKey.current) submissionKey.current = crypto.randomUUID();
      // Store all approved profile and service answers inside the existing JSONB
      // submission, without altering production columns or existing RLS rules.
      const responseAnswers: Record<string, string | string[]> = { selectedPackageId, formVersion: 'approved-v1' };
      const profileKeys = ['age','gender','role','digitalExperience','collaboration','availability','country','timezone',
        ...(values.gender === 'Self-describe' ? ['genderDescription'] : []),
        ...(['employee','agency'].includes(values.role) ? ['approval'] : [])];
      const projectKeys = ['business','projectBusiness','industry','projectSituation','desiredOutcome','audience',
        ...(showAssetRef ? ['existingAssetLink'] : [])];
      const planningKeys = ['communication','urgency','timeframe','budgetStatus','constraints',
        ...(['voice','whatsapp'].includes(values.communication) ? ['contactNumber'] : []),
        ...(values.urgency === 'urgent' ? ['urgencyReason'] : []),
        ...(values.budgetStatus === 'defined' ? ['budgetAmount'] : [])];
      const designKeys = ['designSituation',
        ...(['partial','improve'].includes(values.designSituation) ? ['designSummary'] : []),
        ...(values.designSituation === 'redesign' ? ['designImprovement'] : []),
        ...(values.designSituation === 'new' ? ['designActivity'] : []),
        ...(['partial','improve','redesign'].includes(values.designSituation) ? ['designReference'] : [])];
      const devKeys = ['devState','devRequirements',
        ...(['partial','figma','live'].includes(values.devState) ? ['devReference'] : [])];
      const seoKeys = ['seoStatus','seoObjective','seoAudience',
        ...(values.seoStatus !== 'new' ? ['seoUrl'] : [])];
      const applicable = [...profileKeys,...projectKeys,...planningKeys,
        ...(selectedServices.includes('design')?designKeys:[]),
        ...(selectedServices.includes('dev')?devKeys:[]),
        ...(selectedServices.includes('seo')?seoKeys:[])];
      for (const key of applicable) {
        const value = values[key];
        if (value && value.trim()) responseAnswers['approved.' + key] = value.slice(0,5000);
      }
      responseAnswers['approved.selectedServices'] = selectedServices.map(service => ({ design: 'Product Design', dev: 'Next.js Development', seo: 'SEO' }[service]));
      const submission = {
        idempotencyKey: submissionKey.current,
        invitationToken,
        fullName: values.name.trim(),
        email: values.email.trim(),
        company: values.business.trim() || 'Individual / business not specified',
        website: (['partial','live','problem'].includes(values.projectSituation) ? values.existingAssetLink : '') ||
          (selectedServices.includes('seo') && values.seoStatus !== 'new' ? values.seoUrl : '') || '',
        country: values.country.trim() || 'Not provided',
        timeZone: values.timezone || 'Asia/Karachi',
        industry: values.industry.trim() || 'Not provided',
        businessStage: values.projectSituation || 'idea',
        businessModel: values.projectBusiness || '',
        services: selectedServices.map((service) => ({ design: 'Product Design', dev: 'Next.js Development', seo: 'SEO' }[service] || 'Other / not sure yet')),
        answers: responseAnswers,
        projectOverview,
        objectives: values.desiredOutcome || '',
        mustHaveFeatures: [selectedServices.includes('design') && values.designSituation === 'new' ? values.designActivity : '',
          selectedServices.includes('dev') ? values.devRequirements : '',
          selectedServices.includes('design') && ['partial','improve'].includes(values.designSituation) ? values.designSummary : ''].filter(Boolean).join('\n\n').slice(0,5000),
        niceToHaveFeatures: [selectedServices.includes('design') && values.designSituation === 'redesign' ? values.designImprovement : '',
          selectedServices.includes('design') ? values.designReference : '',
          selectedServices.includes('dev') ? values.devReference : ''].filter(Boolean).join('\n\n').slice(0,5000),
        constraints: values.constraints || '',
        budget: (values.budgetStatus === 'defined' ? values.budgetAmount : '') || values.budgetStatus || '',
        timeline: values.timeframe || '',
        productUrl: (['partial','live','problem'].includes(values.projectSituation) ? values.existingAssetLink : '') ||
          (selectedServices.includes('seo') && values.seoStatus !== 'new' ? values.seoUrl : '') || '',
        competitorReferences: [selectedServices.includes('design') ? values.designReference : '',
          selectedServices.includes('dev') ? values.devReference : ''].filter(Boolean).join('\n\n').slice(0,2000),
        discoveryMethod: 'Self-guided discovery',
        preferredTimes: [values.availability, values.communication,
          ['voice','whatsapp'].includes(values.communication) ? values.contactNumber : ''].filter(Boolean).join(' · '),
        consent: true,
      };

      const body = new FormData();
      body.set('submission', JSON.stringify(submission));
      body.set('companyWebsite', '');

      fetch('/api/discovery', {
        method: 'POST',
        body,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data?.message || 'We could not submit your discovery request.');
          }
          setValidationMessage('');
          setReceiptMessage(data.message || 'Your discovery request was received.');
          setReceiptReference(data.reference || '');
          setReceiptStatusUrl(typeof data.statusUrl === 'string' ? data.statusUrl : '');
          setSubmittedBefore(true);
          setSubmitted(true);
        })
        .catch((error) => {
          setValidationMessage(error instanceof Error ? error.message : 'We could not submit your discovery request.');
        }).finally(() => setSending(false));
    }}>
      {renderStepHeader()}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}
      {currentStep === 4 && renderStep4()}
      {currentStep === 5 && renderStep5()}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {currentStep > 1 && (
            <button type="button" className="btn btn-outline" onClick={previousStep}>
              Back
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {currentStep < stepCount ? (
            <button type="submit" className="btn btn-dark" disabled={sending}>
              Continue <ArrowRight size={17} />
            </button>
          ) : (
            <button type="submit" className="btn btn-dark" disabled={!consent || sending || submittedBefore}>
              {sending ? 'Submitting…' : submittedBefore ? 'Already submitted' : 'Submit discovery'} <ArrowUpRight size={17} />
            </button>
          )}
        </div>
      </div>
      {currentStep === 5 && !consent && <p className="form-hint" style={{ marginTop: 12 }}>Please agree before submitting.</p>}
      {currentStep === 5 && submittedBefore && (
        <p className="form-hint" role="status" style={{ marginTop: 12 }}>
          This request has already been sent. Changes you make here are not saved to the submitted request. Contact RapidlyOn with your reference to update it.
        </p>
      )}
      {validationMessage && (
        <div className="form-result error" role="alert" style={{ marginTop: 12 }}>
          {validationMessage}
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <span className="form-hint">{selectedServiceText}</span>
      </div>
    </form>
  );
}
