"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Github, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readDrafts, deleteDraft, type LocalDraft } from "@/lib/publishing/drafts";
export function DeveloperDashboard() {
 const [drafts, setDrafts] = useState<LocalDraft[]>([]), [ready, setReady] = useState(false), [error, setError] = useState("");
 useEffect(() => { let active = true; queueMicrotask(() => { if (!active) return; try { setDrafts(readDrafts()); } catch (e) { setError(e instanceof Error ? e.message : "Browser storage is unavailable."); } setReady(true); }); return () => { active = false; }; }, []);
 function remove(id: string) { if (!window.confirm("Delete this draft from this device?")) return; try { deleteDraft(id); setDrafts(readDrafts()); } catch { setError("Could not delete the draft. Check browser storage permissions."); } }
 return <main id="main" className="page-container inner-page publisher">
 <div className="publisher-heading"><div><p className="eyebrow">COMMONS FOR DEVELOPERS</p><h1>Good software deserves<br />to be discovered.</h1><p>Bring your GitHub release to a listing anyone can understand.</p></div><Button asChild><Link href="/developer/publish"><Plus size={17} />Prepare an app</Link></Button></div>
 <div className="publisher-notice"><Github size={20} /><div><strong>Your publishing workspace</strong><p>Import a public repository, choose installers, and preview your listing. Drafts stay in this browser. GitHub sign-in and public publishing will become available when the account service is connected.</p></div></div>
 <section className="publisher-section"><h2>Your drafts <span className="publisher-count">{drafts.length}</span></h2>{error && <p role="alert" className="error-text">{error}</p>}{!ready ? <p role="status">Loading drafts…</p> : !drafts.length ? <div className="publisher-empty"><Package size={38} /><h3>Your next release starts here.</h3><p>Connect a public GitHub repository to create your first app listing.</p><Button asChild><Link href="/developer/publish">Connect a repository <ArrowUpRight size={16} /></Link></Button></div> : <div className="publisher-drafts">{drafts.map(d => <article className="publisher-draft" key={d.id}><div><span className="publisher-pill">Draft · this device</span><h3>{d.input.name}</h3><p>{d.repository.fullName}</p><small>Saved {new Date(d.updatedAt).toLocaleString()}</small></div><div className="publisher-actions"><Button asChild variant="secondary"><Link href={`/developer/apps/${encodeURIComponent(d.id)}/edit`}>Continue editing</Link></Button><Button variant="ghost" aria-label={`Delete ${d.input.name} draft`} onClick={() => remove(d.id)}><Trash2 size={17} /></Button></div></article>)}</div>}</section>
 <div className="publisher-benefits"><div><strong>1. Connect</strong><p>Import repository details and real releases.</p></div><div><strong>2. Make it yours</strong><p>Tell people what your app helps them do.</p></div><div><strong>3. Preview</strong><p>Check your listing and try its downloads.</p></div></div>
 </main>;
}
