import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, Code2, Compass, SearchCheck, Sparkles, MoveUpRight } from 'lucide-react';
import { services, featuredProjects } from '@/data/site';
import type { WorkProject } from '@/lib/work-project-schema';

export const serviceIcons = [Compass, Code2, SearchCheck];
export function SectionHeader({ eyebrow, title, intro, action }: { eyebrow:string; title:string; intro?:string; action?:{label:string;href:string} }) {
  return <div className="section-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><div>{intro && <p className="lead">{intro}</p>}{action && <Link className="btn btn-outline" href={action.href}>{action.label}<ArrowUpRight size={17}/></Link>}</div></div>;
}
export function ServiceCards() {
  return <div className="grid-3">{services.map((s,i) => { const Icon = serviceIcons[i] || Sparkles; return <Link href={`/services/${s.slug}`} className="service-card" key={s.slug}>
    <div className="service-icon"><Icon size={30} strokeWidth={1.65}/></div><span className="kicker">0{i+1} / Service</span><h3>{s.title}</h3><p>{s.short}</p><div className="card-bottom"><span>Explore service</span><span className="circle-arrow"><ArrowUpRight size={20}/></span></div>
  </Link>; })}</div>;
}
export function WorkCards({ count=3, projects=featuredProjects }: { count?:number; projects?:WorkProject[] }) {
  return <div className="grid-2">{projects.slice(0,count).map((p,i) => <Link className="work-card" key={p.slug} href={`/work/${p.slug}`}>
    <div className={`work-art theme-${(i%3)+1}`}><div className="work-art-card"><small>Selected project / {String(i+1).padStart(2,'0')}</small>{p.title}<ArrowUpRight size={28} style={{ display:'block',marginTop:19,color:'#588323' }}/></div></div>
    <div className="work-body"><div className="tag-row"><span className="pill">{p.projectContext === 'concept' ? 'Concept project' : 'Personal project'}</span><span className="pill pill-lime">{p.discipline === 'ux-design' ? 'Product design' : 'Web development'}</span></div><h3>{p.title}</h3><p>{p.summary}</p><div className="card-bottom" style={{display:'flex',justifyContent:'space-between',marginTop:18,fontWeight:700,fontSize:'.83rem'}}>Read case study <MoveUpRight size={18}/></div></div>
  </Link>)}</div>;
}
export function CtaPanel() { return <div className="shell"><div className="cta-panel"><div><p className="eyebrow">Your next chapter starts here</p><h2>Have an idea?<br/>Let’s make it <em style={{fontStyle:'normal',color:'#4d6f1d'}}>matter.</em></h2></div><Link className="btn btn-dark" href="/discovery">Start a project <ArrowUpRight size={18}/></Link></div></div>; }
export function PageHero({ eyebrow, title, lead, centered=false }: { eyebrow:string;title:string;lead:string;centered?:boolean }) {
  return <section className={'page-hero'+(centered?' centered':'')}><div className="shell"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{lead}</p></div></section>;
}
export function FeatureList({ features }: { features: string[] }) {
  return <ul style={{listStyle:'none',padding:0,margin:0}}>{features.map(f => <li key={f} style={{display:'flex',gap:12,alignItems:'start',borderTop:'1px solid var(--color-border)',padding:'16px 0',fontSize:'.93rem'}}><Check size={18} color="#6b9b26" style={{flexShrink:0,marginTop:4}}/>{f}</li>)}</ul>;
}
export function LeadPanel() {return <div className="dark-panel"><p className="eyebrow">Clarity, built in</p><h2>Digital should feel <span style={{color:'#b7e65d'}}>effortless.</span></h2><p className="lead" style={{marginTop:25,marginBottom:30}}>We bring strategy, interface craft, and development into one considered process. No noise. No shortcuts. Just purposeful work that holds up.</p><Link href="/process" className="btn btn-lime">Discover our process <ArrowRight size={18}/></Link><div className="grid-3" style={{marginTop:70,position:'relative',zIndex:1}}>{[['01','One clear direction'],['02','Thoughtful execution'],['03','Built to evolve']].map(([n,label])=><div className="number-stat" key={n}><b>{n}</b><span>{label}</span></div>)}</div></div>}
