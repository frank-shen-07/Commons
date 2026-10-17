"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  publisherRequest,
  PublishingApiError,
  errorMessage,
} from "@/lib/publishing/client";
import type {
  AdminApplicationLookup,
  AdminApplicationDeletionResult,
} from "@/src/types/api";

export function DeleteApplication({
  onDeleted,
  onPermissionError,
}: {
  onDeleted: (id: string, slug: string) => void;
  onPermissionError: (error: PublishingApiError) => void;
}) {
  const [url, setUrl] = useState("");
  const [application, setApplication] = useState<AdminApplicationLookup | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<"lookup" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [success, setSuccess] = useState("");
  const inFlight = useRef(false);
  const generation = useRef(0);

  function changeUrl(value: string) {
    generation.current++;
    setUrl(value);
    setApplication(null);
    setConfirmation("");
    setError("");
    setSuccess("");
    setStale(false);
  }
  function report(error: unknown) {
    setError(errorMessage(error));
    if (
      error instanceof PublishingApiError &&
      [401, 403].includes(error.status)
    )
      onPermissionError(error);
  }
  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    const current = generation.current;
    setBusy("lookup");
    setError("");
    setSuccess("");
    setApplication(null);
    setConfirmation("");
    setStale(false);
    try {
      const data = await publisherRequest<AdminApplicationLookup>(
        "/api/admin/applications/lookup",
        { method: "POST", body: JSON.stringify({ url: url.trim() }) },
      );
      if (current === generation.current) setApplication(data);
    } catch (error) {
      if (current === generation.current) report(error);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (
      !application ||
      confirmation !== application.slug ||
      stale ||
      inFlight.current
    )
      return;
    inFlight.current = true;
    setBusy("delete");
    setError("");
    setSuccess("");
    try {
      const data = await publisherRequest<AdminApplicationDeletionResult>(
        `/api/admin/applications/${application.id}`,
        {
          method: "DELETE",
          body: JSON.stringify({
            confirmSlug: confirmation,
            expectedUpdatedAt: application.updatedAt,
          }),
        },
      );
      if (
        data.deleted !== true ||
        data.id !== application.id ||
        data.slug !== application.slug
      )
        throw new Error(
          "Deletion was not confirmed. Find the application again to check its status.",
        );
      setSuccess(`${application.name} was permanently deleted from Commons.`);
      setApplication(null);
      setConfirmation("");
      onDeleted(data.id, data.slug);
    } catch (error) {
      report(error);
      // Reload after an uncertain outcome or conflict; never retry a mutation automatically.
      setStale(true);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <section className="admin-delete" aria-labelledby="delete-heading">
      <h2 id="delete-heading">Delete application</h2>
      <p className="admin-muted">
        Find a stored application by its Commons URL, then review it before
        permanent deletion.
      </p>
      <form onSubmit={lookup} className="admin-delete-lookup">
        <div>
          <label htmlFor="delete-url">Application URL</label>
          <input
            id="delete-url"
            type="url"
            required
            value={url}
            placeholder="https://your-site/apps/application-slug"
            disabled={busy === "delete"}
            onChange={(event) => changeUrl(event.target.value)}
            aria-describedby="delete-url-help"
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={!!busy || !url.trim()}
        >
          {busy === "lookup" ? "Finding…" : "Find application"}
        </Button>
      </form>
      <p id="delete-url-help" className="admin-muted">
        Use a URL from this site. Sample-only listings are not stored
        applications.
      </p>
      {busy === "lookup" && <p role="status">Finding application…</p>}
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      <div role="status" aria-live="polite">
        {success && <p className="admin-success">{success}</p>}
      </div>
      {application && (
        <div className="admin-delete-preview">
          <h3>{application.name}</h3>
          <dl className="admin-facts">
            <div>
              <dt>Slug</dt>
              <dd>{application.slug}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{application.status.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Publisher</dt>
              <dd>
                {application.publisher.displayName}
                {application.publisher.githubUsername &&
                  ` · @${application.publisher.githubUsername}`}
              </dd>
            </div>
            <div>
              <dt>Repository</dt>
              <dd>{application.repositoryUrl}</dd>
            </div>
          </dl>
          {application.status === "published" && (
            <Link href={`/apps/${application.slug}`}>View public listing</Link>
          )}
          <p className="admin-delete-warning">
            This permanently deletes the application, its submissions,
            screenshots, release records, download links, and reports from
            Commons. There is no restore action. The GitHub repository and files
            hosted on GitHub remain available.
          </p>
          <form onSubmit={remove}>
            <label htmlFor="delete-confirm">
              Type {application.slug} to confirm deletion
            </label>
            <input
              id="delete-confirm"
              autoComplete="off"
              spellCheck={false}
              value={confirmation}
              disabled={!!busy || stale}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            {stale && (
              <p className="admin-muted">
                Find the application again to check its latest status before
                another attempt.
              </p>
            )}
            <Button
              className="admin-delete-button"
              type="submit"
              disabled={!!busy || stale || confirmation !== application.slug}
            >
              {busy === "delete" ? "Deleting…" : "Permanently delete"}
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
