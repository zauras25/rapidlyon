'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';

type Agreement = Record<string, unknown>;
const asText = (value: unknown) => typeof value === 'string' ? value : '';

/** Production client-side agreement acceptance, backed by an authenticated and audited RPC. */
export function AgreementAcceptance({
  agreement,
  accessToken,
  onAccepted,
}: {
  agreement: Agreement;
  accessToken: string;
  onAccepted: () => void | Promise<void>;
}) {
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const [hasRead, setHasRead] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [agrees, setAgrees] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const terms = asText(agreement.terms);
  const version = Number(agreement.version);
  const validVersion = Number.isInteger(version) && version > 0;
  const available = asText(agreement.status) === 'sent' && terms.trim().length > 0 && validVersion;
  const canAccept = available && signerName.trim().length >= 2 && signerRole.trim().length >= 2 && hasRead && authorized && agrees && !busy;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAccept) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/client/commercial', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'accept_agreement',
          id: agreement.id,
          version,
          signer_name: signerName.trim(),
          signer_role: signerRole.trim(),
          read_confirmed: hasRead,
          authority_confirmed: authorized,
          terms_confirmed: agrees,
        }),
      });
      const body: { message?: string } = await response.json();
      if (!response.ok) throw new Error(body.message || 'Agreement acceptance could not be recorded.');
      await onAccepted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Agreement acceptance could not be confirmed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="agreement-acceptance" aria-labelledby="agreement-accept-heading">
      <div className="agreement-acceptance__heading">
        <FileCheck2 size={22} aria-hidden="true" />
        <div><h4 id="agreement-accept-heading">Review & accept your agreement</h4>
          <p>Agreement version {validVersion ? version : 'unavailable'} · Review the complete terms before proceeding.</p></div>
      </div>
      {available ? (
        <>
          <div className="agreement-acceptance__terms" role="region" tabIndex={0} aria-label={`Complete agreement terms, version ${version}`}>
            <div className="agreement-acceptance__terms-text">{terms}</div>
          </div>
          <form onSubmit={event => void submit(event)} className="agreement-acceptance__form">
            <label className="form-field"><span>Authorized signer’s full name *</span>
              <input required minLength={2} maxLength={160} autoComplete="name" value={signerName} onChange={event => setSignerName(event.target.value)} placeholder="Your full legal name" /></label>
            <label className="form-field"><span>Signer&apos;s role / authority *</span>
              <input required minLength={2} maxLength={160} value={signerRole} onChange={event => setSignerRole(event.target.value)} placeholder="Owner / Authorized representative" /></label>
            <label className="agreement-acceptance__check"><input type="checkbox" required checked={hasRead} onChange={event => setHasRead(event.target.checked)} /><span>I have read and reviewed the complete agreement (version {version}).</span></label>
            <label className="agreement-acceptance__check"><input type="checkbox" required checked={authorized} onChange={event => setAuthorized(event.target.checked)} /><span>I am authorized to accept this agreement on behalf of the named client.</span></label>
            <label className="agreement-acceptance__check"><input type="checkbox" required checked={agrees} onChange={event => setAgrees(event.target.checked)} /><span>I agree to the terms of this exact agreement version.</span></label>
            <p className="form-hint"><ShieldCheck size={16} aria-hidden="true" /> Your acceptance will be linked to your signed-in account, signer declaration and agreement version. Accepting does not automatically start the project or charge you.</p>
            {error ? <p className="form-result error" role="alert">{error}</p> : null}
            <button type="submit" className="btn btn-dark" disabled={!canAccept}>
              {busy ? 'Recording acceptance…' : 'Accept agreement'} <CheckCircle2 size={18} aria-hidden="true" />
            </button>
          </form>
        </>
      ) : <div className="banner" role="status">Complete agreement terms are unavailable or this version cannot be accepted. Contact RapidlyOn before proceeding.</div>}
    </section>
  );
}
