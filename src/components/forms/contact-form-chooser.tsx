'use client';

import { useState } from 'react';
import { ArrowUpRight, CheckCircle2, HelpCircle, BriefcaseBusiness } from 'lucide-react';
import { Brand } from '@/components/site/chrome';
import { InquiryForm, DiscoveryForm } from './public-forms';

type FormChoice = 'inquiry' | 'discovery';

export function ContactFormChooser() {
  const [choice, setChoice] = useState<FormChoice>('inquiry');
  return (
    <div className="contact-choice-wrapper">
      <div className="contact-choice-heading" style={{ marginBottom: 18 }}>
        <div style={{ background: 'var(--color-primary, #45641F)', color: '#fff', padding: 18, borderRadius: 'var(--radius-lg, 16px)' }}>
          <Brand inverted />
          <p style={{ color: 'inherit', margin: '10px 0 0' }}>Digital experiences, thoughtfully built.</p>
        </div>
        <div className="contact-choice-grid" role="group" aria-label="Choose a contact form" style={{ marginTop: 16 }}>
          <button type="button" className={'contact-choice-card' + (choice === 'inquiry' ? ' is-selected' : '')} aria-pressed={choice === 'inquiry'} onClick={() => setChoice('inquiry')}>
            <span className="contact-choice-icon"><HelpCircle size={22} aria-hidden="true" /></span>
            <span className="contact-choice-copy"><strong>01 · Inquiry</strong><span>General Inquiry / Get in touch</span></span>
            <span className="contact-choice-status" aria-hidden="true">{choice === 'inquiry' ? <CheckCircle2 size={20} /> : <ArrowUpRight size={20} />}</span>
          </button>
          <button type="button" className={'contact-choice-card' + (choice === 'discovery' ? ' is-selected' : '')} aria-pressed={choice === 'discovery'} onClick={() => setChoice('discovery')}>
            <span className="contact-choice-icon"><BriefcaseBusiness size={22} aria-hidden="true" /></span>
            <span className="contact-choice-copy"><strong>02 · Discovery</strong><span>Project Discovery</span></span>
            <span className="contact-choice-status" aria-hidden="true">{choice === 'discovery' ? <CheckCircle2 size={20} /> : <ArrowUpRight size={20} />}</span>
          </button>
        </div>
      </div>
      <div className="contact-selected-form" id="selected-contact-form" aria-label={choice === 'inquiry' ? 'General inquiry form' : 'Project discovery form'}>
        {choice === 'inquiry' ? <InquiryForm key="inquiry" /> : <DiscoveryForm key="discovery" />}
      </div>
    </div>
  );
}
