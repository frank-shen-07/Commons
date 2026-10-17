"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Github, Package, Plus, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  readDrafts,
  deleteDraft,
  type LocalDraft,
} from "@/lib/publishing/drafts";
import {
  publisherRequest,
  PublishingApiError,
  errorMessage,
  statusLabel,
} from "@/lib/publishing/client";
import type {
  DeveloperListingSummary,
  PublisherSession,
} from "@/src/types/api";

export function DeveloperDashboard() {
  const router = useRouter();
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [listings, setListings] = useState<DeveloperListingSummary[]>([]);
  const [user, setUser] = useState<PublisherSession | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  async function load() {
    await Promise.resolve();
    setReady(false);
    setLoadFailed(false);
    setError("");
    try {
      try {
        setLocalDrafts(readDrafts());
      } catch (e) {
        setError(errorMessage(e));
      }
      const session = await publisherRequest<PublisherSession>("/api/auth/me");
      setUser(session);
      setListings(
        await publisherRequest<DeveloperListingSummary[]>(
          "/api/developer/apps",
        ),
      );
    } catch (e) {
      if (!(e instanceof PublishingApiError && e.status === 401)) {
        setLoadFailed(true);
        setError(errorMessage(e));
      }
      if (e instanceof PublishingApiError && e.status === 401) {
        setUser(null);
        setListings([]);
      }
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, []);
  async function logout() {
    try {
      await publisherRequest("/api/auth/logout", { method: "POST" });
      setUser(null);
      setListings([]);
      router.push("/developer");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function remove(id: string) {
    if (!window.confirm("Delete this recovery draft from this device?")) return;
    try {
      deleteDraft(id);
      setLocalDrafts(readDrafts());
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const visibleLocal = localDrafts.filter(
    (d) => !d.ownerId || d.ownerId === user?.id,
  );
  return (
    <main id="main" className="page-container inner-page publisher">
      <div className="publisher-heading">
        <div>
          <h1>Your developer workspace.</h1>
          <p>Bring your GitHub releases to people who will use them.</p>
        </div>
        <Button asChild>
          <Link href="/developer/publish">
            <Plus size={17} />
            Prepare an app
          </Link>
        </Button>
      </div>
      <div className="publisher-notice">
        <Github size={20} />
        <div className="publisher-notice-copy">
          <strong>
            {user
              ? `Connected as ${user.githubUsername ?? "GitHub publisher"}`
              : "Connect GitHub to save and submit"}
          </strong>
          <p>
            {user
              ? "Your account listings are saved across devices. New listings and updates are reviewed before they become public."
              : "You can prepare a local preview without an account. Sign in to verify repository access and save your listing."}
          </p>
        </div>
        {user ? (
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
        ) : (
          <Button asChild>
            <a href="/api/auth/github?next=%2Fdeveloper">Connect GitHub</a>
          </Button>
        )}
      </div>
      {error && (
        <div role="alert" className="publisher-error">
          {error}{" "}
          <Button variant="ghost" onClick={() => void load()}>
            <RefreshCw size={16} />
            Retry
          </Button>
        </div>
      )}
      <section className="publisher-section">
        <h2>
          Your applications{" "}
          <span className="publisher-count">
            {loadFailed ? "—" : listings.length}
          </span>
        </h2>
        {!ready ? (
          <div className="publisher-empty" role="status">
            Loading your workspace…
          </div>
        ) : loadFailed && user ? (
          <p role="status">
            Your applications could not be loaded. Retry to see your saved work.
          </p>
        ) : listings.length ? (
          <div className="publisher-drafts">
            {listings.map((app) => (
              <article className="publisher-draft" key={app.id}>
                <div>
                  <span className="publisher-pill">
                    {statusLabel(app.status)}
                    {app.status === "published" &&
                    app.revisionStatus &&
                    app.revisionStatus !== "approved"
                      ? ` · Update ${statusLabel(app.revisionStatus).toLowerCase()}`
                      : ""}
                  </span>
                  <h3>{app.name}</h3>
                  <p>{app.repository}</p>
                  <small>
                    Saved {new Date(app.updatedAt).toLocaleString()}
                  </small>
                </div>
                <div className="publisher-actions">
                  <Button asChild variant="secondary">
                    <Link href={`/developer/apps/${app.id}/edit`}>
                      {app.revisionStatus === "pending_review"
                        ? "View submission"
                        : app.status === "published"
                          ? "Prepare update"
                          : "Continue editing"}
                    </Link>
                  </Button>
                  {app.status === "published" && (
                    <Link href={`/apps/${app.slug}`}>View public listing</Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="publisher-empty">
            <Package size={38} />
            <h3>Your next release starts here.</h3>
            <p>
              {user
                ? "Import a repository you maintain to prepare your first listing."
                : "Connect GitHub or start with a local preview."}
            </p>
            <Button asChild>
              <Link href="/developer/publish">Connect a repository</Link>
            </Button>
          </div>
        )}
      </section>
      {visibleLocal.length > 0 && (
        <section className="publisher-section">
          <h2>Recovery drafts on this device</h2>
          <p>
            These copies are not public. Save an unlinked draft to your account
            when you are ready.
          </p>
          <div className="publisher-drafts">
            {visibleLocal.map((d) => (
              <article className="publisher-draft" key={d.id}>
                <div>
                  <span className="publisher-pill">
                    {d.serverId ? "Local recovery copy" : "Local draft"}
                  </span>
                  <h3>{d.input.name}</h3>
                  <p>{d.repository.fullName}</p>
                </div>
                <div className="publisher-actions">
                  <Button asChild variant="secondary">
                    <Link
                      href={`/developer/apps/${encodeURIComponent(d.id)}/edit?local=1`}
                    >
                      Open draft
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Delete ${d.input.name} recovery draft`}
                    onClick={() => remove(d.id)}
                  >
                    <Trash2 size={17} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
