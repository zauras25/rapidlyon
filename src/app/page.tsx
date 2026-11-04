import { Suspense } from 'react';
import { connection } from 'next/server';
import { ServicesCarousel } from '@/components/site/services-carousel';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CheckCircle2, Sparkles, Zap } from 'lucide-react';
import { CtaPanel, LeadPanel, SectionHeader, ServiceCards, WorkCards } from '@/components/site/sections';
import { PublicShell } from '@/components/site/chrome';
import { processSteps } from '@/data/site';
import { getPublishedWorkProjects } from '@/lib/work-project-storage';

function HomeWorkFallback() {
  return <section className="section" id="work"><div className="shell"><SectionHeader eyebrow="02 / Selected work" title="See how ideas become interfaces." intro="Explore published case studies, with concept and personal projects clearly identified." action={{label:'View all projects',href:'/work'}}/><div className="work-empty-state"><div><p className="eyebrow">Work in progress</p><h3>Our case studies are in progress.</h3><p>We are documenting the thinking, decisions, and outcomes behind our work. Until the full studies are published, see what we offer or tell us about your project.</p></div><div className="work-empty-actions"><Link className="btn btn-dark" href="/discovery">Discuss your project <ArrowUpRight size={18}/></Link><Link className="btn btn-outline" href="/services">Explore services <ArrowRight size={18}/></Link></div></div></div></section>;
}

async function HomeWorkContent() {
  await connection();
  const published = await getPublishedWorkProjects();
  return <section className="section" id="work"><div className="shell"><SectionHeader eyebrow="02 / Selected work" title="See how ideas become interfaces." intro="Explore published case studies, with concept and personal projects clearly identified." action={{label:'View all projects',href:'/work'}}/>{published.length?<WorkCards count={2} projects={published}/>:<div className="work-empty-state"><div><p className="eyebrow">Work in progress</p><h3>Our case studies are in progress.</h3><p>We are documenting the thinking, decisions, and outcomes behind our work. Until the full studies are published, see what we offer or tell us about your project.</p></div><div className="work-empty-actions"><Link className="btn btn-dark" href="/discovery">Discuss your project <ArrowUpRight size={18}/></Link><Link className="btn btn-outline" href="/services">Explore services <ArrowRight size={18}/></Link></div></div>}</div></section>;
}

export default function HomePage(){return <PublicShell><main>
    <section className="hero hero-premium" aria-labelledby="home-hero-title">
    <div className="shell hero-grid hero-premium-grid">
      <div className="hero-copy reveal">
        <p className="eyebrow hero-premium-eyebrow"><span className="hero-live-dot" aria-hidden="true"/> Independent digital design & development studio</p>
        <h1 id="home-hero-title">Digital experiences that <em>work beautifully and launch confidently.</em></h1>
        <p className="lead">From product strategy and UX/UI design to Next.js development and SEO. Work directly with one studio through a clear, practical path from idea to launch.</p>
        <div className="hero-actions"><Link className="btn btn-dark" href="/discovery">Start a project <ArrowUpRight size={19}/></Link><Link className="btn btn-outline" href="/work">View our work <ArrowRight size={18}/></Link></div>
        <div className="hero-trustline"><span><CheckCircle2 size={17}/> Scope before production</span><span><CheckCircle2 size={17}/> Direct collaboration</span><span><CheckCircle2 size={17}/> Design through delivery</span></div>
      </div>
      <div className="hero-showcase reveal delay-2" aria-label="Illustration of RapidlyOn product design and development work">
        <div className="hero-showcase-glow" aria-hidden="true"/>
        <div className="hero-project-window">
          <div className="hero-window-top"><div className="hero-window-dots" aria-hidden="true"><i/><i/><i/></div><span>rapidlyon / preview</span><span className="hero-window-status">Live-ready concept</span></div>
          <div className="hero-window-body"><div className="hero-demo-nav"><strong>northstar<span>.</span></strong><span>Platform / Solutions / About</span><span className="hero-demo-button">Get started <ArrowUpRight size={12}/></span></div>
            <div className="hero-demo-content"><span className="hero-demo-kicker">DESIGNED FOR WHAT&apos;S NEXT</span><strong>Better digital.<br/><em>Built thoughtfully.</em></strong><div className="hero-demo-description"/><div className="hero-demo-description short"/><div className="hero-demo-pill">Explore solutions <ArrowUpRight size={12}/></div></div>
            <div className="hero-demo-feature"><div className="hero-demo-feature-orbit"/><div className="hero-demo-feature-core"><Sparkles size={24}/></div></div>
          </div>
        </div>
        <div className="hero-floating-note hero-floating-note-top"><span className="hero-note-icon"><CheckCircle2 size={17}/></span><span><strong>Design system</strong><small>Consistent by design</small></span></div>
        <div className="hero-floating-note hero-floating-note-bottom"><span className="hero-note-icon"><Zap size={17}/></span><span><strong>From Figma to launch</strong><small>Design · Development · SEO</small></span></div>
        <div className="hero-showcase-caption">A preview of our approach · Concept interface</div>
      </div>
    </div>
  </section>
      <ServicesCarousel />
  
  <section className="section" id="services"><div className="shell"><SectionHeader eyebrow="01 / What we do" title="The right expertise. At the right moment." intro="From product UX to production-ready websites and search visibility. Explore individual services or combine them into one delivery plan."/><ServiceCards /></div></section>
  <section className="section-tight"><div className="shell"><LeadPanel/></div></section>
  <Suspense fallback={<HomeWorkFallback />}><HomeWorkContent /></Suspense>
  <section className="section process-section"><div className="shell"><SectionHeader eyebrow="03 / The approach" title="Less friction. More forward motion." intro="A simple process with deliberate checkpoints, clear expectations and a steady focus on what matters most."/><ol className="home-process-list">{processSteps.slice(0,4).map((s,i)=><li className="step-card" key={s.title}><span className="step-index">0{i+1}</span><h3>{s.title}</h3><p>{s.text}</p></li>)}</ol><Link href="/process" className="btn btn-outline" style={{marginTop:28}}>See the full process <ArrowUpRight size={18}/></Link></div></section>
  <section className="section"><div className="shell"><div className="quote-panel"><p className="eyebrow">The RapidlyOn philosophy</p><blockquote>“The best digital experiences don’t demand attention. They make every interaction feel natural.”</blockquote><p style={{fontWeight:750}}>Clear thinking. Considered execution. <Sparkles size={18} style={{display:'inline',verticalAlign:'middle'}}/></p></div></div></section>
  <section className="section-tight"><CtaPanel/></section>
</main></PublicShell>}
