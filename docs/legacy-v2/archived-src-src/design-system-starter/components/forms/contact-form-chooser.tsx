'use client';

import { useState } from 'react';
import { ArrowUpRight, CheckCircle2, HelpCircle, BriefcaseBusiness } from 'lucide-react';
import { InquiryForm, DiscoveryForm } from './public-forms';

type FormChoice = 'inquiry' | 'discovery';

/** Keep both contact journeys in one decision area without changing their submit handlers. */
export function ContactFormChooser() {
  const [choice, setChoice] = useState<FormChoice>('inquiry');
  return (
    <div className="contact-choice-wrapper">
      <div className="contact-choice-heading">
        <p className="eyebrow">Choose how to reach us</p>
        <h2>What would you like to do?</h2>
        <p>Both options are free to submit. Select one to see the right form below.</p>
      </div>
      <div className="contact-choice-grid" role="group" aria-label="Choose a contact form">
        <button type="button" className={'contact-choice-card'+(choice==='inquiry'?' is-selected':'')} aria-pressed={choice==='inquiry'} onClick={()=>setChoice('inquiry')}>
          <span className="contact-choice-icon"><HelpCircle size={22} aria-hidden="true"/></span>
          <span className="contact-choice-copy"><strong>General inquiry</strong><span>Ask a question, request information or share an early idea.</span><small>Short form · ~1 minute</small></span>
          <span className="contact-choice-status" aria-hidden="true">{choice==='inquiry'?<CheckCircle2 size={20}/>:<ArrowUpRight size={20}/>}</span>
        </button>
        <button type="button" className={'contact-choice-card'+(choice==='discovery'?' is-selected':'')} aria-pressed={choice==='discovery'} onClick={()=>setChoice('discovery')}>
          <span className="contact-choice-icon"><BriefcaseBusiness size={22} aria-hidden="true"/></span>
          <span className="contact-choice-copy"><strong>Project discovery</strong><span>Share project goals, scope, budget and timeline for review.</span><small>Detailed form · ~3–5 minutes</small></span>
          <span className="contact-choice-status" aria-hidden="true">{choice==='discovery'?<CheckCircle2 size={20}/>:<ArrowUpRight size={20}/>}</span>
        </button>
      </div>
      <div className="contact-selected-form" id="selected-contact-form" aria-label={choice==='inquiry'?'General inquiry form':'Project discovery form'}>
        {choice==='inquiry' ? <InquiryForm key="inquiry"/> : <DiscoveryForm key="discovery"/>}
      </div>
    </div>
  );
}
