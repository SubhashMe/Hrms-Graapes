import { ArrowRight, CircleCheck, AlertCircle } from 'lucide-react';
import './dashboard.css';

function StatCard({ item }) {
  const Icon = item.icon;
  return <article className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={19}/></span><span className="text-[11px] font-semibold text-muted">Live data</span></div><p className="mt-4 text-sm text-muted">{item.label}</p><p className="mt-1 text-2xl font-bold">—</p><p className="mt-1 text-xs text-muted">{item.note}</p></article>;
}
export default function DashboardPage({ config }) {
 return <div className="space-y-6">
  <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{config.eyebrow}</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">{config.title}</h2><p className="mt-2 max-w-2xl text-sm text-muted">{config.subtitle}</p></section>
  <section aria-label="Dashboard summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{config.stats.map((item)=><StatCard key={item.label} item={item}/>)}</section>
  <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"><h3 className="font-bold">Quick actions</h3><p className="mt-1 text-xs text-muted">Common tasks for your role</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{config.actions.map((item)=><a key={item.label} href={item.to} className="group flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-accent/50 hover:bg-surface-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent"><item.icon size={19}/></span><span className="flex-1 text-sm font-semibold">{item.label}</span><ArrowRight size={16} className="text-muted group-hover:text-accent"/></a>)}</div></section>
  <section className="grid gap-4 xl:grid-cols-2">{config.sections.map((section)=><article key={section.title} className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"><h3 className="font-bold">{section.title}</h3><div className="mt-3 divide-y divide-border">{section.items.map((item)=><div key={item.title} className="flex gap-3 py-3"><CircleCheck size={16} className="mt-0.5 shrink-0 text-accent"/><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted">{item.description}</p></div></div>)}</div></article>)}</section>
  <section className="flex gap-3 rounded-2xl border border-border bg-surface-2/60 p-4"><AlertCircle size={18} className="mt-0.5 shrink-0 text-muted"/><div><p className="text-sm font-semibold">Live database connection</p><p className="mt-1 text-xs leading-5 text-muted">Cards show a dash until real API data is connected. No fake employee counts or attendance figures are shown.</p></div></section>
 </div>;
}
