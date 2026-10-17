"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Github, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  publisherRequest,
  PublishingApiError,
  errorMessage,
} from "@/lib/publishing/client";
import type {
  AdminApprovalResult,
  AdminRevisionDetail,
  AdminRevisionSummary,
} from "@/src/types/api";

function safeUrl(value?: string | null) {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function External({
  url,
  children,
}: {
  url?: string | null;
  children: React.ReactNode;
}) {
  const href = safeUrl(url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  ) : (
    <span>{children}</span>
  );
}

function Screenshot({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return safeUrl(url) && !failed ? (
    // Submitted screenshots are external URLs, not optimized marketplace assets.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safeUrl(url)}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <p className="admin-image-failure">
      Screenshot unavailable{alt ? `: ${alt}` : "."}
    </p>
  );
}

function Submission({ revision }: { revision: AdminRevisionDetail }) {
  const { input, repository } = revision.snapshot;
  const release = repository.releases.find(
    (item) => item.id === input.releaseId,
  );
  return (
    <div className="admin-detail">
      <section aria-labelledby="listing-heading">
        <h2 id="listing-heading">Submitted listing</h2>
        <p className="admin-summary">{input.summary}</p>
        <p className="admin-prose">{input.description}</p>
        <dl className="admin-facts">
          <div>
            <dt>Category</dt>
            <dd>{input.category}</dd>
          </div>
          <div>
            <dt>Licence</dt>
            <dd>{repository.license || "Not provided"}</dd>
          </div>
          <div>
            <dt>Repository</dt>
            <dd>
              <External url={repository.url}>{repository.fullName}</External>
            </dd>
          </div>
          {input.websiteUrl && (
            <div>
              <dt>Website</dt>
              <dd>
                <External url={input.websiteUrl}>{input.websiteUrl}</External>
              </dd>
            </div>
          )}
          <div>
            <dt>Publisher</dt>
            <dd>
              {revision.publisher.displayName ||
                revision.publisher.githubUsername}{" "}
              {revision.publisher.githubUsername && (
                <span className="admin-muted">
                  @{revision.publisher.githubUsername}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{date(revision.submittedAt)}</dd>
          </div>
        </dl>
        {(input.screenshots?.length ?? 0) > 0 && (
          <>
            <h2>Screenshots</h2>
            <div className="admin-screenshots">
              {input.screenshots!.map((shot, index) => (
                <Screenshot
                  key={index}
                  url={typeof shot === "string" ? shot : shot.url}
                  alt={
                    typeof shot === "string"
                      ? `Submitted screenshot ${index + 1}`
                      : shot.alt
                  }
                />
              ))}
            </div>
          </>
        )}
      </section>
      <section aria-labelledby="distribution-heading">
        <h2 id="distribution-heading">Selected distribution</h2>
        <p className="admin-muted">
          Approval publishes these selected downloads. Repository hosting does
          not establish software safety.
        </p>
        {release ? (
          <>
            <h3>
              <External url={release.url}>{release.version}</External>
            </h3>
            <p className="admin-muted">
              {release.publishedAt
                ? date(release.publishedAt)
                : "Release date unavailable"}
            </p>
            <p className="admin-prose">
              {release.notes || "No release notes provided."}
            </p>
          </>
        ) : (
          <p>
            {input.releaseId
              ? "Selected release is missing from the submitted snapshot."
              : "No desktop release selected."}
          </p>
        )}
        <ul className="admin-installers">
          {(input.assets ?? []).map((selection) => {
            const asset = release?.assets.find(
              (item) => item.id === selection.id,
            );
            return (
              <li key={selection.id}>
                <strong>
                  {asset ? (
                    <External url={asset.url}>{asset.name}</External>
                  ) : (
                    `Missing installer ${selection.id}`
                  )}
                </strong>
                <span>
                  {selection.platform} · {selection.architecture}
                  {asset?.format ? ` · ${asset.format}` : ""}
                  {asset
                    ? ` · ${asset.size < 1024 * 1024 ? `${Math.max(1, Math.round(asset.size / 1024))} KB` : `${(asset.size / 1024 / 1024).toFixed(1)} MB`}`
                    : ""}
                </span>
                {asset && !asset.eligible && (
                  <p role="alert">This asset is not an eligible installer.</p>
                )}
              </li>
            );
          })}
        </ul>
        {input.webUrl && (
          <p>
            Web application:{" "}
            <External url={input.webUrl}>{input.webUrl}</External>
          </p>
        )}
      </section>
    </div>
  );
}

function date(value: string) {
  return new Date(value).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AdminPortal({ revisionId }: { revisionId?: string }) {
  const [queue, setQueue] = useState<AdminRevisionSummary[]>([]);
  const [detail, setDetail] = useState<AdminRevisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<PublishingApiError | Error | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stale, setStale] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [successes, setSuccesses] = useState<
    Array<{ name: string; slug: string }>
  >([]);
  const inFlight = useRef(new Set<string>());
  const generation = useRef(0);

  async function load(isActive: () => boolean = () => true) {
    const current = ++generation.current;
    setLoading(true);
    setLoadError(null);
    try {
      if (revisionId) {
        const data = await publisherRequest<AdminRevisionDetail>(
          `/api/admin/revisions/${encodeURIComponent(revisionId)}`,
        );
        if (current === generation.current && isActive()) setDetail(data);
      } else {
        const data = await publisherRequest<AdminRevisionSummary[]>(
          "/api/admin/revisions",
        );
        if (current === generation.current && isActive()) setQueue(data);
      }
      if (current === generation.current && isActive()) {
        setErrors({});
        setStale({});
      }
    } catch (error) {
      if (current === generation.current && isActive())
        setLoadError(
          error instanceof Error ? error : new Error(errorMessage(error)),
        );
    } finally {
      if (current === generation.current && isActive()) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => {
      active = false;
    };
    // Reload when the route changes; explicit reloads use the same function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revisionId]);

  async function approve(revision: AdminRevisionSummary) {
    if (inFlight.current.has(revision.id) || stale[revision.id]) return;
    inFlight.current.add(revision.id);
    setBusy((value) => ({ ...value, [revision.id]: true }));
    setErrors((value) => ({ ...value, [revision.id]: "" }));
    try {
      const result = await publisherRequest<AdminApprovalResult>(
        `/api/admin/revisions/${revision.id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ expectedVersion: revision.version }),
        },
      );
      setQueue((value) => value.filter((item) => item.id !== revision.id));
      setDetail((value) =>
        value?.id === revision.id ? { ...value, status: "approved" } : value,
      );
      setSuccesses((value) => [
        ...value,
        { name: revision.name, slug: result.slug },
      ]);
    } catch (error) {
      setErrors((value) => ({ ...value, [revision.id]: errorMessage(error) }));
      if (error instanceof PublishingApiError && error.status === 409)
        setStale((value) => ({ ...value, [revision.id]: true }));
      if (
        error instanceof PublishingApiError &&
        [401, 403].includes(error.status)
      )
        setLoadError(error);
    } finally {
      inFlight.current.delete(revision.id);
      setBusy((value) => ({ ...value, [revision.id]: false }));
    }
  }

  const code =
    loadError instanceof PublishingApiError ? loadError.status : null;
  function action(revision: AdminRevisionSummary) {
    return (
      <div className="admin-row-action">
        <Button
          onClick={() => void approve(revision)}
          disabled={!!busy[revision.id] || !!stale[revision.id]}
        >
          {busy[revision.id] ? "Approving…" : "Approve"}
        </Button>
        {errors[revision.id] && (
          <p className="admin-error" role="alert">
            {errors[revision.id]}
          </p>
        )}
      </div>
    );
  }
  return (
    <main id="main" className="page-container inner-page admin-portal">
      {revisionId && (
        <Link className="admin-back" href="/admin">
          <ArrowLeft size={16} aria-hidden="true" /> Review queue
        </Link>
      )}
      <header className="admin-heading">
        <div>
          <h1>
            {revisionId
              ? detail?.name || "Review submission"
              : "Application review"}
          </h1>
          <p className="admin-muted">
            {revisionId
              ? "Inspect the submitted listing and its selected downloads before publishing."
              : "Review publisher submissions and make approved applications available on Commons."}
          </p>
        </div>
        {!loading && !code && (
          <Button
            variant="secondary"
            disabled={Object.values(busy).some(Boolean)}
            onClick={() => void load()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Reload
          </Button>
        )}
      </header>
      <div aria-live="polite">
        {successes.map((item, index) => (
          <p className="admin-success" key={index}>
            {item.name} is published.{" "}
            <Link href={`/apps/${item.slug}`}>View public listing</Link>
          </p>
        ))}
      </div>
      {loading ? (
        <p role="status" className="admin-state">
          Loading submissions…
        </p>
      ) : loadError ? (
        <section className="admin-state">
          <h2>
            {code === 401
              ? "Sign in to review applications"
              : code === 403
                ? "Administrator access required"
                : code === 404
                  ? "Submission not found"
                  : "Could not load submissions"}
          </h2>
          <p role="alert">
            {code === 401
              ? "Use the GitHub account configured for administrator access."
              : errorMessage(loadError)}
          </p>
          {code === 401 ? (
            <Button asChild>
              <a
                href={`/api/auth/github?next=${encodeURIComponent(revisionId ? `/admin/revisions/${revisionId}` : "/admin")}`}
              >
                <Github size={16} aria-hidden="true" />
                Sign in with GitHub
              </a>
            </Button>
          ) : (
            code !== 403 && (
              <Button variant="secondary" onClick={() => void load()}>
                Reload submissions
              </Button>
            )
          )}
        </section>
      ) : revisionId && detail ? (
        <>
          <div className="admin-review-bar">
            <div>
              <span className="admin-kind">
                {detail.isUpdate ? "Application update" : "First publication"}
              </span>
              {detail.isUpdate && (
                <Link href={`/apps/${detail.application.slug}`}>
                  View current public listing
                </Link>
              )}
            </div>
            {detail.status === "pending_review" ? (
              action(detail)
            ) : (
              <p role="status">
                {detail.status === "approved"
                  ? "This submission has been approved."
                  : "This submission is no longer awaiting review."}
              </p>
            )}
          </div>
          <Submission revision={detail} />
        </>
      ) : queue.length === 0 ? (
        <section className="admin-state">
          <h2>No applications awaiting review</h2>
          <p>New submissions will appear here when publishers submit them.</p>
        </section>
      ) : (
        <section aria-label="Pending submissions" className="admin-queue">
          {queue.map((revision) => (
            <article className="admin-row" key={revision.id}>
              <div>
                <span className="admin-kind">
                  {revision.isUpdate ? "Update" : "First publication"}
                </span>
                <h2>
                  <Link href={`/admin/revisions/${revision.id}`}>
                    {revision.name}
                  </Link>
                </h2>
                <p>{revision.repository}</p>
                <p className="admin-muted">
                  {revision.publisher.displayName ||
                    revision.publisher.githubUsername}
                  {revision.publisher.githubUsername &&
                    ` · @${revision.publisher.githubUsername}`}
                </p>
                <time dateTime={revision.submittedAt}>
                  {date(revision.submittedAt)}
                </time>
              </div>
              <div className="admin-row-controls">
                <Link href={`/admin/revisions/${revision.id}`}>
                  Review submission
                </Link>
                {action(revision)}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
