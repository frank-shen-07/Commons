"use client";
import type { ListingInput, RepositoryImport } from "./types";
export interface LocalDraft { id: string; updatedAt: string; input: ListingInput; repository: RepositoryImport; }
const key = "commons.publisher.drafts.v1";
export function readDrafts(): LocalDraft[] { const raw = localStorage.getItem(key); if (!raw) return []; const parsed: unknown = JSON.parse(raw); if (!Array.isArray(parsed) || !parsed.every(d => d && typeof d.id === "string" && d.input && Array.isArray(d.input.assets) && Array.isArray(d.input.screenshots) && typeof d.input.name === "string" && d.repository && Array.isArray(d.repository.releases))) throw new Error("Saved drafts could not be read. Export browser data before clearing storage."); return parsed as LocalDraft[]; }
export function saveDraft(draft: LocalDraft) { const existing = readDrafts(); localStorage.setItem(key, JSON.stringify([draft, ...existing.filter(d => d.id !== draft.id)])); }
export function deleteDraft(id: string) { localStorage.setItem(key, JSON.stringify(readDrafts().filter(d => d.id !== id))); }
export function inputFromRepository(repo: RepositoryImport): ListingInput { return { repository: repo.fullName, name: repo.name, summary: repo.description.slice(0, 160), description: repo.description, category: "Utilities", screenshots: [], iconUrl: repo.avatarUrl, websiteUrl: safeHttps(repo.websiteUrl) ? repo.websiteUrl : "", webUrl: "", releaseId: repo.releases[0]?.id ?? null, assets: [] }; }
export function safeHttps(value: string): boolean { try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; } }
