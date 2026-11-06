'use client';
import {useEffect,useRef,useState} from 'react';
import {getEngagementOption} from '@/data/engagement-options';
import './guided-discovery.css';

type Answer=string|string[];
type Model={services:string[];unsure:boolean;name:string;email:string;company:string;website:string;projectStage:string;projectType:string;goals:string[];overview:string;priority:string;timeline:string;deliveryWindow:string;budget:string;region:string;contact:string;startDate:string;references:string;challenge:string;consent:boolean;answers:Record<string,Answer>};
type Question={key:string;label:string;options:string[];multi?:boolean};
const catalog: {key:string;title:string;desc:string;questions:Question[]}[]=[
 {key:'ux',title:'UX / Product Design',desc:'Research, user journeys and accessible interfaces',questions:[
  {key:'uxProduct',label:'What would you like designed?',options:['Website / landing pages','Mobile app experience','Web app / client dashboard','Improve an existing product','Not sure yet']},
  {key:'uxWork',label:'Which design help do you expect?',options:['User research & experience planning','User journeys / wireframes','High-fidelity interface design','Clickable prototype / handoff','I need your recommendation'],multi:true},
  {key:'uxAssets',label:'What do you already have?',options:['Only an idea','Branding or content','Existing screens or Figma file','A live website / product','Not sure']},
  {key:'uxPriority',label:'What matters most in the design?',options:['Make it easier for users','Increase signups or sales','Create a stronger visual experience','Test a product concept','Not sure yet']}]},
 {key:'dev',title:'Next.js Development',desc:'Websites, commerce, platforms and applications',questions:[
  {key:'devType',label:'What do you want built?',options:['Marketing / business website','Online shop or commerce experience','Account-based portal / dashboard','Custom Next.js web application','I need advice']},
  {key:'devAssets',label:'What is ready for development?',options:['Approved Figma design','Some designs or references','Existing website / code','Requirements only','Nothing yet']},
  {key:'devFeatures',label:'Which features do you expect?',options:['Accounts & user login','Admin dashboard / CMS','Payments / checkout','Bookings / forms','Third-party integrations','Not sure yet'],multi:true},
  {key:'devSupport',label:'What support is needed after build?',options:['Deployment & handoff','Hosting / maintenance guidance','Ongoing updates','Not sure yet']}]},
 {key:'seo',title:'SEO & Optimization',desc:'Search visibility, technical SEO and site performance',questions:[
  {key:'seoWebsite',label:'What is your website situation?',options:['Website is live','Website launching soon','Website needs redevelopment','No website yet']},
  {key:'seoScope',label:'What SEO help do you need?',options:['Technical SEO & indexing','On-page pages / metadata','Keyword strategy & content plan','Local business visibility','SEO audit and recommendations','Not sure yet'],multi:true},
  {key:'seoMarket',label:'Who should find you through search?',options:['People in my city / region','Customers across my country','International customers','A specific industry audience','Not sure yet']},
  {key:'seoAccess',label:'Do you have analytics or search tools set up?',options:['Search Console / Analytics available','Only website access','No access yet','Not sure']}]}
];
const steps=['Choose services','Project & goals','Service details','Timing & budget','Review'];
const defaults:Model={services:[],unsure:false,name:'',email:'',company:'',website:'',projectStage:'',projectType:'',goals:[],overview:'',priority:'',timeline:'',deliveryWindow:'',budget:'',region:'',contact:'',startDate:'',references:'',challenge:'',consent:false,answers:{}};
const draftKey='rapidlyon_discovery_v10_integrated';
const serviceNames:Record<string,string>={ux:'Product Design',dev:'Next.js Development',seo:'SEO'};
function Choice({options,value,onChange,multi=false}:{options:string[];value:Answer|undefined;onChange:(answer:Answer)=>void;multi?:boolean}){
 const selected=multi?(Array.isArray(value)?value:[]):[];
 return <div className="gd-choices">{options.map(option=>{const active=multi?selected.includes(option):value===option;return <button type="button" key={option} aria-pressed={active} className={'gd-choice'+(active?' active':'')} onClick={()=>onChange(multi?(active?selected.filter(item=>item!==option):[...selected,option]):option)}><span aria-hidden="true">{active?'✓':'○'}</span>{option}</button>})}</div>;
}
function Input({label,value,onChange,type='text',placeholder='',required=false}:{label:string;value:string;onChange:(value:string)=>void;type?:string;placeholder?:string;required?:boolean}){return <label className="gd-field"><span>{label}{required?' *':' (optional)'}</span><input type={type} value={value} onChange={event=>onChange(event.target.value)} placeholder={placeholder} required={required}/></label>}
export function GuidedDiscovery(){
 const [data,setData]=useState<Model>(defaults);const [step,setStep]=useState(0);const [ready,setReady]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');const [statusUrl,setStatusUrl]=useState('');const [invite,setInvite]=useState<string|null>(null);const [offer,setOffer]=useState('');const [done,setDone]=useState(false);const submissionKey=useRef<string|null>(null);
 const set=(key:keyof Model,value:Model[keyof Model])=>setData(current=>({...current,[key]:value}));
 const answer=(key:string,value:Answer)=>setData(current=>({...current,answers:{...current.answers,[key]:value}}));
 useEffect(()=>{
  let active=true;
  // Load the browser draft after mount, without a synchronous state update in an effect.
  void Promise.resolve().then(async ()=>{
   if(!active)return;
   let initial:Model={...defaults};
   try{
    const saved=JSON.parse(localStorage.getItem(draftKey)||'null');
    if(saved&&typeof saved==='object'&&Array.isArray(saved.services)){
     initial={...initial,...saved,answers:saved.answers||{}};
    }
   }catch{}
   const url=new URL(window.location.href);
   const pkg=url.searchParams.get('package');
   if(pkg){
    const option=getEngagementOption(pkg);
    if(option){
     initial.services=option.services.map(service=>service==='Product Design'?'ux':service==='Next.js Development'?'dev':service==='SEO'?'seo':'').filter(Boolean);
     initial.unsure=false;
     if(active)setOffer(pkg);
    }
   }
   const token=url.searchParams.get('invite');
   if(token){
    url.searchParams.delete('invite');
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
   }
   if(!active)return;
   setData(initial);
   setReady(true);
   if(token){
    try{
     const response=await fetch('/api/discovery/invite?token='+encodeURIComponent(token),{cache:'no-store'});
     const payload=await response.json();
     if(!response.ok)throw Error(payload.message||'Invitation invalid');
     if(!active)return;
     setInvite(token);
     setData(current=>({...current,name:payload.name||current.name,email:payload.email||current.email,company:payload.company||current.company}));
    }catch(e){if(active)setError(e instanceof Error?e.message:'Invitation unavailable')}
   }
  });
  return ()=>{active=false};
 },[]);
 useEffect(()=>{if(ready&&!done)localStorage.setItem(draftKey,JSON.stringify(data))},[data,ready,done]);
 const changeService=(key:string)=>setData(current=>({...current,unsure:false,services:current.services.includes(key)?current.services.filter(s=>s!==key):[...current.services,key]}));
 const valid=()=>{if(step===0&&!data.services.length&&!data.unsure)return 'Choose a service or ask for a recommendation.';if(step===1){if(data.name.trim().length<2)return 'Enter your full name (at least 2 characters).';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))return 'Enter a valid email address.';if(data.website&&!/^https?:\/\//.test(data.website))return 'Website URL should begin with https://.';}if(step===3&&(!data.timeline||!data.deliveryWindow))return 'Preferred start and delivery window are required.';if(step===4&&!data.consent)return 'Please agree to be contacted about this request.';return ''};
 const next=()=>{const reason=valid();if(reason){setError(reason);return}setError('');setStep(current=>Math.min(4,current+1));window.scrollTo({top:0,behavior:'smooth'})};
 async function submit(){const reason=valid();if(reason){setError(reason);return}setBusy(true);setError('');try{
  if(!submissionKey.current)submissionKey.current=crypto.randomUUID();
  const services=data.unsure?['Other / not sure yet']:data.services.map(key=>serviceNames[key]);
  const clientAnswers:Record<string,Answer>={...data.answers,gdGoals:data.goals,gdProjectType:data.projectType,gdProjectStage:data.projectStage,gdPriority:data.priority,gdDeliveryWindow:data.deliveryWindow,gdContactPreference:data.contact,gdStartDate:data.startDate,gdChallenge:data.challenge,gdRegion:data.region,gdFormVersion:'v10',...(offer?{selectedPackageId:offer}:{})};
  const description=data.overview.trim()||[...data.goals,data.challenge].filter(Boolean).join('; ')||'I would like guidance on defining my digital project.';
  const submission={idempotencyKey:submissionKey.current,invitationToken:invite,fullName:data.name.trim(),email:data.email.trim(),company:data.company.trim()||'Individual project',website:data.website,country:data.region||'Not provided',timeZone:'Not provided',industry:'Not provided',businessStage:data.projectStage||'Not sure',businessModel:data.projectType,services,answers:clientAnswers,projectOverview:description.length>=20?description:description.padEnd(20,'.'),objectives:data.goals.join('; '),mustHaveFeatures:'',niceToHaveFeatures:'',constraints:'',budget:data.budget,timeline:data.timeline,productUrl:data.website,competitorReferences:data.references,discoveryMethod:'Self-guided discovery',preferredTimes:data.contact||'',consent:true};
  const form=new FormData();form.set('submission',JSON.stringify(submission));form.set('companyWebsite','');const response=await fetch('/api/discovery',{method:'POST',body:form});const result=await response.json();if(!response.ok)throw Error(result.message||'We could not submit your project request.');setSuccess(`${result.reference?'Reference: '+result.reference+'. ':''}${result.message||'Your discovery request was received.'}`);setStatusUrl(typeof result.statusUrl==='string'?result.statusUrl:'');setDone(true);localStorage.removeItem(draftKey);submissionKey.current=null;
 }catch(e){setError(e instanceof Error?e.message:'Connection interrupted. Please retry.')}finally{setBusy(false)}}
 const review=(label:string,value:Answer|undefined)=> <div className="gd-review-row" key={label}><span>{label}</span><strong>{Array.isArray(value)?value.join(', ')||'Not specified':value||'Not specified'}</strong></div>;
 if(!ready)return <div className="gd-shell">Loading discovery…</div>;
 return <div className="gd-shell"><header className="gd-heading"><p className="gd-kicker">Start a project / Discovery</p><h1>Tell us what you’re building.<br/>We’ll guide the rest.</h1><p>Choose the services that fit, explain your goals and tell us what you know. We’ll clarify the rest together.</p><div className="gd-meta"><span>About 3–6 minutes</span><span>1–3 services</span><span>Draft saved on this device</span></div></header><div className="gd-layout"><aside className="gd-side"><p className="gd-kicker">Your discovery</p><h3>A clearer starting point.</h3><nav aria-label="Discovery progress">{steps.map((label,index)=><div key={label} className={'gd-step'+(index===step?' active':'')+(index<step?' done':'')}><span>{index<step?'✓':index+1}</span>{label}</div>)}</nav><p className="gd-side-note">We review your brief, confirm fit and dependencies, then discuss scope and a tailored quote. Submitting does not purchase anything.</p></aside><section className="gd-card" aria-label="Guided project discovery">{done?<div role="status"><h2>Discovery request received</h2><p>{success}</p>{statusUrl&&<a className="gd-primary" href={statusUrl}>Track your request</a>}</div>:<><div className="gd-section-head"><div><p className="gd-kicker">Step {step+1} of 5</p><h2>{['How can we help?','Tell us about your project','Let’s understand the work','Timing and practical details','Review your project brief'][step]}</h2></div></div>
 {step===0&&<><p>Choose one, two or all three services. You can also ask us to recommend a starting point.</p><div className="gd-service-grid">{catalog.map(service=><button key={service.key} type="button" className={'gd-service'+(data.services.includes(service.key)?' active':'')} aria-pressed={data.services.includes(service.key)} onClick={()=>changeService(service.key)}><span>{data.services.includes(service.key)?'✓ Selected':'○ Select'}</span><strong>{service.title}</strong><small>{service.desc}</small></button>)}</div><button type="button" className={'gd-choice gd-unsure'+(data.unsure?' active':'')} aria-pressed={data.unsure} onClick={()=>setData(current=>({...current,unsure:!current.unsure,services:[]}))}>I’m not sure — help me choose</button></>}
 {step===1&&<><div className="gd-fields"><Input label="Your name" required value={data.name} onChange={v=>set('name',v)}/><Input label="Email address" required value={data.email} type="email" onChange={v=>set('email',v)}/><Input label="Business or project name" value={data.company} onChange={v=>set('company',v)}/><Input label="Existing website" type="url" value={data.website} onChange={v=>set('website',v)} placeholder="https://"/></div><h3>What stage is your project at?</h3><Choice value={data.projectStage} onChange={v=>set('projectStage',v)} options={['Just an idea','Planning or gathering requirements','Already have a live website / product','Ready to start with an existing plan','Not sure']}/><h3>Is this new work or an improvement?</h3><Choice value={data.projectType} onChange={v=>set('projectType',v)} options={['Build something new','Redesign or improve something existing','Continue work already started','Need help deciding']}/><h3>What would you like to achieve?</h3><Choice multi value={data.goals} onChange={v=>set('goals',v)} options={['Launch a new website or app','Improve usability and design','Build features or automate a process','Get found by more customers online','Improve an existing website','Need help figuring it out']}/><label className="gd-field gd-full"><span>In a sentence, what do you have in mind? (optional)</span><textarea value={data.overview} onChange={e=>set('overview',e.target.value)} placeholder="Example: I want customers to book appointments online."/></label></>}
 {step===2&&(data.unsure?<><p>We can recommend the right services after reviewing your goals.</p><h3>What is your biggest challenge right now?</h3><Choice value={data.challenge} onChange={v=>set('challenge',v)} options={['I don’t know where to start','I need someone to plan the work','My existing solution is not working well','I need help comparing options','I would rather discuss this with someone']}/></>:<>{data.services.length>1&&<><h3>Which work should come first?</h3><Choice value={data.priority} onChange={v=>set('priority',v)} options={['Design / experience first','Development / working product first','SEO / search visibility first','Plan them together','Not sure — recommend a sequence']}/></>}{catalog.filter(item=>data.services.includes(item.key)).map(service=><div className="gd-service-questions" key={service.key}><h3>{service.title}</h3>{service.questions.map(question=><div key={question.key}><h4>{question.label}</h4><Choice options={question.options} multi={question.multi} value={data.answers[question.key]} onChange={v=>answer(question.key,v)}/></div>)}<label className="gd-field"><span>Anything else about {service.title}? (optional)</span><textarea value={String(data.answers[service.key+'Notes']||'')} onChange={e=>answer(service.key+'Notes',e.target.value)}/></label></div>)}</>)}
 {step===3&&<><p>Your preferences are not delivery promises. We confirm feasibility and pricing later.</p><div className="gd-fields">{([['timeline','Preferred project start',['Immediately / ASAP','Within 2–4 weeks','Within 1–3 months','After 3 months','Flexible — discuss with team']],['deliveryWindow','Preferred delivery window',['Within 2 weeks','2–4 weeks','1–2 months','2–3 months','More than 3 months','Flexible — plan together']],['budget','Estimated budget range',['I need a quote first','Under $500','$500–$1,500','$1,500–$3,000','$3,000–$5,000','$5,000+','Not sure / flexible']],['region','Where are you based?',['Pakistan','United States','United Kingdom','United Arab Emirates','Other / prefer to discuss']],['contact','Preferred contact method',['Email','Video call after initial review','WhatsApp if available','No preference']]] as const).map(([key,label,values])=><label className="gd-field" key={key}><span>{label}{key==='timeline'||key==='deliveryWindow'?' *':' (optional)'}</span><select value={data[key]} onChange={e=>set(key,e.target.value)}><option value="">Choose one…</option>{values.map(value=><option key={value}>{value}</option>)}</select></label>)}<Input label="Ideal start date" value={data.startDate} type="date" onChange={v=>set('startDate',v)}/></div><label className="gd-field"><span>Links or special requirements (optional)</span><textarea value={data.references} onChange={e=>set('references',e.target.value)}/></label></>}
 {step===4&&<><p>Review the request before sending it to the RapidlyOn team.</p><div className="gd-review"><h3>Services & goals</h3>{review('Services',data.unsure?'Recommend services':data.services.map(key=>serviceNames[key]))}{review('Goals',data.goals)}<h3>Project</h3>{review('Name',data.name)}{review('Email',data.email)}{review('Company',data.company)}{review('Stage',data.projectStage)}{review('Project type',data.projectType)}{review('Overview',data.overview)}<h3>Service requirements</h3>{Object.entries(data.answers).map(([key,value])=>review(catalog.flatMap(item=>item.questions).find(q=>q.key===key)?.label||key,value))}<h3>Timing and budget</h3>{review('Start',data.timeline)}{review('Delivery preference',data.deliveryWindow)}{review('Budget',data.budget)}{review('Region',data.region)}</div><label className="gd-consent"><input type="checkbox" checked={data.consent} onChange={e=>set('consent',e.target.checked)}/>I agree that RapidlyOn may use this information to review my request and contact me. *</label></>}
 {error&&<p className="gd-error" role="alert">{error}</p>}<div className="gd-actions"><button type="button" disabled={step===0||busy} onClick={()=>{setStep(s=>s-1);setError('')}}>← Back</button><span>{step+1} / 5</span><button className="gd-primary" disabled={busy} type="button" onClick={()=>step===4?void submit():next()}>{busy?'Submitting…':step===4?'Submit discovery':'Continue →'}</button></div></>}</section></div></div>;
}
