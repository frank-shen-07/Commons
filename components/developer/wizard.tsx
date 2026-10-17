"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Github,
  RefreshCw,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppCard } from "@/components/marketplace";
import { ScreenshotGallery } from "@/components/app-details";
import {
  categories as defaultCategories,
  platformLabels,
  type MarketplaceApp,
  type Platform,
} from "@/lib/types";
import { installationInstructions } from "@/lib/publishing/assets";
import {
  inputFromRepository,
  readDrafts,
  saveDraft,
  deleteDraft,
  safeHttps,
} from "@/lib/publishing/drafts";
import {
  publisherRequest,
  PublishingApiError,
  portalInput,
  errorMessage,
  statusLabel,
} from "@/lib/publishing/client";
import type { ListingInput, RepositoryImport } from "@/lib/publishing/types";
import type {
  DeveloperListing,
  PublisherSession,
  Category,
} from "@/src/types/api";
const steps = ["Connect", "Configure", "Preview", "Submit"];
export function PublishingWizard({
  draftId,
  localOnly = false,
}: {
  draftId?: string;
  localOnly?: boolean;
}) {
  const [downloadPlatform, setDownloadPlatform] = useState<Platform | "">("");
  const [step, setStep] = useState(0),
    [repository, setRepository] = useState("");
  const [repo, setRepo] = useState<RepositoryImport | null>(null),
    [input, setInput] = useState<ListingInput | null>(null);
  const [id, setId] = useState(""),
    [serverId, setServerId] = useState<string | null>(null);
  const [listing, setListing] = useState<DeveloperListing | null>(null),
    [expectedVersion, setExpectedVersion] = useState(0);
  const [user, setUser] = useState<PublisherSession | null>(null),
    [ownerId, setOwnerId] = useState<string | undefined>();
  const [categories, setCategories] = useState(defaultCategories);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [stale, setStale] = useState(false);
  const locked =
    listing?.revisionStatus === "pending_review" ||
    listing?.status === "suspended";
  const returnPath = serverId
    ? `/developer/apps/${serverId}/edit`
    : repo && id
      ? `/developer/apps/${id}/edit?local=1`
      : draftId
        ? `/developer/apps/${draftId}/edit${localOnly ? "?local=1" : ""}`
        : "/developer/publish";
  const signInUrl = `/api/auth/github?next=${encodeURIComponent(returnPath)}`;
  useEffect(() => {
    let active = true;
    async function load() {
      let session: PublisherSession | null = null;
      try {
        session = await publisherRequest<PublisherSession>("/api/auth/me");
      } catch (e) {
        if (!(e instanceof PublishingApiError && e.status === 401) && active)
          setError(errorMessage(e));
      }
      if (!active) return;
      setUser(session);
      try {
        if (draftId && localOnly) {
          const local = readDrafts().find((d) => d.id === draftId);
          if (!local)
            throw new Error(
              "This recovery draft was not found on this device.",
            );
          if (local.ownerId && local.ownerId !== session?.id)
            throw new Error(
              "Sign in with the account that owns this recovery draft.",
            );
          setInput(local.input);
          setRepo(local.repository);
          setRepository(local.repository.fullName);
          setId(local.id);
          setOwnerId(local.ownerId);
          setServerId(local.serverId ?? null);
          if (local.serverId) {
            const saved = await publisherRequest<DeveloperListing>(
              `/api/developer/apps/${local.serverId}`,
            );
            if (!active) return;
            setListing(saved);
            setExpectedVersion(local.version ?? 0);
            if (saved.version !== local.version) {
              setStale(true);
              setError(
                "The account copy has changed. Export this recovery copy before reloading the latest saved version.",
              );
            }
          }
          setDirty(true);
          setStep(1);
        } else if (draftId) {
          const saved = await publisherRequest<DeveloperListing>(
            `/api/developer/apps/${draftId}`,
          );
          if (!active) return;
          setListing(saved);
          setServerId(saved.id);
          setExpectedVersion(saved.version);
          setOwnerId(session?.id);
          setInput(portalInput(saved.snapshot.input));
          setRepo(saved.snapshot.repository);
          setRepository(saved.repository);
          setId(crypto.randomUUID());
          setStep(saved.revisionStatus === "pending_review" ? 3 : 1);
          if (!saved.snapshot.repository.releases.length)
            setNotice(
              "Refresh releases and explicitly confirm your installer selection before submitting this existing listing.",
            );
        } else setId(crypto.randomUUID());
      } catch (e) {
        if (active) setError(errorMessage(e));
      } finally {
        if (active) setReady(true);
      }
      try {
        const values = await publisherRequest<Category[]>("/api/categories");
        if (active && values.length) setCategories(values.map((c) => c.name));
      } catch {
        /* Local previews can still use the shared categories; server saves validate them. */
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [draftId, localOnly]);
  useEffect(() => {
    if (!ready || !dirty || !input || !repo || !id || locked) return;
    const timer = setTimeout(() => {
      try {
        saveDraft({
          id,
          input,
          repository: repo,
          ownerId,
          serverId: serverId ?? undefined,
          version: expectedVersion,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        setError(
          "Local recovery storage is unavailable. Keep this page open and save to your account or export the draft.",
        );
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [
    ready,
    dirty,
    input,
    repo,
    id,
    ownerId,
    serverId,
    expectedVersion,
    locked,
  ]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(patch: Partial<ListingInput>) {
    if (locked) return;
    setInput((current) => (current ? { ...current, ...patch } : null));
    setDirty(true);
    setNotice("");
  }
  async function connect(refresh = false) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const value = refresh && repo ? repo.fullName : repository;
      let imported: RepositoryImport;
      if (user)
        imported = await publisherRequest<RepositoryImport>(
          `/api/developer/repositories/verify?repository=${encodeURIComponent(value)}`,
        );
      else {
        const response = await fetch(
          `/api/developer/import?repository=${encodeURIComponent(value)}`,
          { signal: AbortSignal.timeout(45000) },
        );
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : "Repository import failed.",
          );
        imported = body;
      }
      setRepo(imported);
      setRepository(imported.fullName);
      if (refresh && input) {
        const release = imported.releases.find((r) => r.id === input.releaseId);
        const assets = input.assets.filter((a) =>
          release?.assets.some(
            (f) =>
              f.id === a.id &&
              f.eligible &&
              f.platform === a.platform &&
              f.architecture === a.architecture,
          ),
        );
        update({
          assets,
          releaseId: release?.id ?? imported.releases[0]?.id ?? null,
        });
        setNotice(
          assets.length !== input.assets.length
            ? "Some selected installers disappeared or changed. Review the release and select their replacements."
            : "Releases refreshed. Your descriptions and images have been preserved.",
        );
      } else {
        if (!id) setId(crypto.randomUUID());
        setInput(inputFromRepository(imported));
        setOwnerId(user?.id);
        setDirty(true);
        setStep(1);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function saveRecovery() {
    if (!repo || !input) return;
    saveDraft({
      id,
      input,
      repository: repo,
      ownerId,
      serverId: serverId ?? undefined,
      version: expectedVersion,
      updatedAt: new Date().toISOString(),
    });
  }
  async function saveRemote() {
    if (!repo || !input || !user) return null;
    // Preserve unsaved input before network writes. A server success remains usable if local storage fails.
    try {
      saveRecovery();
    } catch {
      /* The form remains available for export. */
    }
    const persistedInput = {
      ...input,
      screenshots: input.screenshots.map(
        (url) =>
          listing?.snapshot.input.screenshots?.find(
            (shot) => typeof shot !== "string" && shot.url === url,
          ) ?? url,
      ),
    };
    const saved = await publisherRequest<DeveloperListing>(
      serverId ? `/api/developer/apps/${serverId}/draft` : "/api/apps",
      {
        method: serverId ? "PUT" : "POST",
        body: JSON.stringify(
          serverId
            ? { input: persistedInput, expectedVersion }
            : persistedInput,
        ),
      },
    );
    setListing(saved);
    setRepo(saved.snapshot.repository);
    setInput(portalInput(saved.snapshot.input));
    setServerId(saved.id);
    setExpectedVersion(saved.version);
    setOwnerId(user.id);
    setDirty(false);
    try {
      deleteDraft(id);
    } catch {
      /* A duplicate recovery copy is harmless and remains account-bound. */
    }
    window.history.replaceState(null, "", `/developer/apps/${saved.id}/edit`);
    return saved;
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (user) {
        await saveRemote();
        setNotice(
          "Saved to your account. Your listing is not public until approved.",
        );
      } else {
        saveRecovery();
        setDirty(false);
        setNotice(
          "Saved on this device. Connect GitHub to save to your account and submit for review.",
        );
      }
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof PublishingApiError && e.code === "STALE_DRAFT")
        setStale(true);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const saved = await saveRemote();
      if (!saved) return;
      const submitted = await publisherRequest<DeveloperListing>(
        `/api/developer/apps/${saved.id}/submit`,
        {
          method: "POST",
          body: JSON.stringify({ expectedVersion: saved.version }),
        },
      );
      setListing(submitted);
      setExpectedVersion(submitted.version);
      setDirty(false);
      setNotice(
        submitted.status === "published"
          ? "Update submitted for review. Your current public listing remains available."
          : "Submitted for review. Your listing will become public after approval.",
      );
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof PublishingApiError && e.code === "STALE_DRAFT")
        setStale(true);
    } finally {
      setBusy(false);
    }
  }
  async function reopen() {
    if (!serverId) return;
    setBusy(true);
    setError("");
    try {
      const saved = await publisherRequest<DeveloperListing>(
        `/api/developer/apps/${serverId}/draft/reopen`,
        { method: "POST", body: JSON.stringify({ expectedVersion }) },
      );
      setListing(saved);
      setExpectedVersion(saved.version);
      setStep(1);
      setNotice("Returned to draft. Submit again after making your changes.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function exportDraft() {
    if (!repo || !input) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { schemaVersion: 1, input, repository: repo },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "commons-listing-draft.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const release = repo?.releases.find((r) => r.id === input?.releaseId);
  const selected =
    release?.assets.filter((a) =>
      input?.assets.some(
        (s) =>
          s.id === a.id &&
          a.eligible &&
          s.platform === a.platform &&
          s.architecture === a.architecture,
      ),
    ) ?? [];
  const issues = input
    ? ([
        !input.name.trim() && "Add an application name.",
        (!input.summary.trim() || input.summary.length > 160) &&
          "Add a summary of up to 160 characters.",
        !input.description.trim() && "Describe what your app does.",
        !categories.includes(input.category) && "Choose a category.",
        input.screenshots.some((url) => !safeHttps(url)) &&
          "Use HTTPS screenshot URLs without credentials.",
        input.iconUrl && !safeHttps(input.iconUrl) && "Use an HTTPS icon URL.",
        input.websiteUrl &&
          !safeHttps(input.websiteUrl) &&
          "Use an HTTPS website URL.",
        input.webUrl && !safeHttps(input.webUrl) && "Use an HTTPS web app URL.",
        !selected.length &&
          !safeHttps(input.webUrl) &&
          "Select at least one supported installer or provide a web app URL.",
      ].filter(Boolean) as string[])
    : [];
  const app: MarketplaceApp | null =
    input && repo
      ? {
          id: String(repo.id),
          slug: listing?.slug ?? repo.name.toLowerCase(),
          name: input.name,
          summary: input.summary,
          description: input.description,
          iconUrl: safeHttps(input.iconUrl) ? input.iconUrl : null,
          screenshots: input.screenshots.filter(safeHttps),
          category: input.category,
          developerName: user?.githubUsername ?? repo.owner,
          repositoryUrl: repo.url,
          websiteUrl: safeHttps(input.websiteUrl) ? input.websiteUrl : repo.url,
          license: repo.license,
          latestVersion: release?.version ?? null,
          updatedAt: release?.publishedAt ?? null,
          platforms: [
            ...new Set(
              selected.flatMap((a) => (a.platform ? [a.platform] : [])),
            ),
            ...(safeHttps(input.webUrl) ? ["web" as const] : []),
          ],
          color: "#eaf1ff",
          features: [],
          releasesUrl: release?.url,
        }
      : null;
  return (
    <main id="main" className="page-container inner-page publisher">
      <Link className="back-link" href="/developer">
        <ArrowLeft size={16} />
        Developer dashboard
      </Link>
      <div className="publisher-heading">
        <div>
          <h1>Make your app at home.</h1>
          <p>
            A few details. A real release. A clearer way to discover your work.
          </p>
        </div>
        {input && (
          <Button
            variant="secondary"
            disabled={busy || locked || stale}
            onClick={() => void save()}
          >
            <Save size={16} />
            {user
              ? serverId
                ? "Save to account"
                : "Save to my account"
              : "Save locally"}
          </Button>
        )}
      </div>
      <ol className="publisher-steps" aria-label="Publishing progress">
        {steps.map((label, index) => (
          <li key={label} aria-current={step === index ? "step" : undefined}>
            <button
              disabled={
                busy ||
                (!input && index > 0) ||
                (index > 1 && issues.length > 0 && !locked) ||
                (index === 0 && !!serverId)
              }
              onClick={() => setStep(index)}
            >
              <span>{index < step ? <Check size={16} /> : index + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      {user && (
        <p className="publisher-account">
          Connected as {user.githubUsername ?? "GitHub publisher"}
          {listing
            ? ` · ${statusLabel(listing.status)}${listing.revisionStatus ? ` · Revision ${statusLabel(listing.revisionStatus).toLowerCase()}` : ""}`
            : ""}
        </p>
      )}
      {error && (
        <div role="alert" className="publisher-error">
          {error}
          {stale && serverId && (
            <>
              <p>
                Export your unsaved changes before loading the latest account
                copy.
              </p>
              <Button variant="secondary" onClick={exportDraft}>
                Export unsaved draft
              </Button>{" "}
              <Button asChild>
                <a href={`/developer/apps/${serverId}/edit`}>
                  Reload saved version
                </a>
              </Button>
            </>
          )}
          {!stale && (
            <p>
              <a href={signInUrl}>Connect or reconnect GitHub</a> ·{" "}
              <Link href="/developer">Return to dashboard</Link>
            </p>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="publisher-notice">
          {notice}
        </p>
      )}
      {!ready ? (
        <p role="status">Loading your draft…</p>
      ) : step === 0 ? (
        <section className="publisher-panel">
          <Github size={32} />
          <h2>Start with your repository.</h2>
          <p>
            {user
              ? "Connect a public repository you maintain. We verify access with your GitHub account."
              : "Import a public project for a local preview. Connect GitHub to verify access and submit."}
          </p>
          {!user && (
            <Button asChild variant="secondary">
              <a href={signInUrl}>Connect GitHub</a>
            </Button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void connect();
            }}
          >
            <label htmlFor="repository">GitHub repository</label>
            <div className="publisher-connect">
              <input
                id="repository"
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
                placeholder="https://github.com/owner/app"
                required
                maxLength={200}
                autoComplete="off"
              />
              <Button disabled={busy || !repository.trim()} type="submit">
                {busy ? "Reading GitHub…" : "Import repository"}
                <ArrowRight size={16} />
              </Button>
            </div>
          </form>
          <p className="publisher-help">
            We read repository information and up to 20 recent releases,
            excluding drafts and prereleases. Only publish software you are
            authorised to distribute.
          </p>
        </section>
      ) : input && repo && app ? (
        <>
          {step === 1 && (
            <fieldset
              disabled={!!locked || busy || stale}
              className="publisher-config publisher-fieldset"
            >
              <section className="publisher-panel">
                <h2>Tell your app’s story.</h2>
                <p>Help someone understand what they can do with your app.</p>
                <div className="publisher-fields">
                  <label>
                    App name
                    <input
                      value={input.name}
                      maxLength={80}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </label>
                  <label>
                    Short description <small>{input.summary.length}/160</small>
                    <input
                      value={input.summary}
                      maxLength={160}
                      onChange={(e) => update({ summary: e.target.value })}
                    />
                  </label>
                  <label>
                    About this app
                    <textarea
                      rows={6}
                      value={input.description}
                      maxLength={10000}
                      onChange={(e) => update({ description: e.target.value })}
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={input.category}
                      onChange={(e) => update({ category: e.target.value })}
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    App icon URL
                    <input
                      value={input.iconUrl}
                      onChange={(e) => update({ iconUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </label>
                  <label>
                    Screenshot URLs{" "}
                    <small>One HTTPS URL per line, up to 6</small>
                    <textarea
                      rows={3}
                      value={input.screenshots.join("\n")}
                      onChange={(e) =>
                        update({
                          screenshots: e.target.value.split("\n").slice(0, 6),
                        })
                      }
                      onBlur={() =>
                        update({
                          screenshots: input.screenshots
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <label>
                    Official website
                    <input
                      value={input.websiteUrl}
                      onChange={(e) => update({ websiteUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </label>
                  <label>
                    Web app URL <small>Optional; opens in the browser</small>
                    <input
                      value={input.webUrl}
                      onChange={(e) => update({ webUrl: e.target.value })}
                      placeholder="https://…"
                    />
                  </label>
                </div>
                {repo.readme && (
                  <details className="publisher-readme">
                    <summary>Reference: repository README</summary>
                    <pre>{repo.readme}</pre>
                  </details>
                )}
              </section>
              <aside>
                <section className="publisher-panel">
                  <div className="publisher-heading small">
                    <h2>Your release</h2>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void connect(true)}
                      aria-label="Refresh GitHub releases"
                    >
                      <RefreshCw
                        size={16}
                        className={busy ? "publisher-spin" : ""}
                      />
                    </Button>
                  </div>
                  <p>{repo.fullName}</p>
                  <p>
                    Licence:{" "}
                    {repo.license ??
                      "Not identified — confirm an open-source licence before publishing."}
                  </p>
                  {repo.releases.length ? (
                    <>
                      <label htmlFor="release">Stable release</label>
                      <select
                        id="release"
                        value={input.releaseId ?? ""}
                        onChange={(e) =>
                          update({
                            releaseId: Number(e.target.value),
                            assets: [],
                          })
                        }
                      >
                        {repo.releases.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.version}
                          </option>
                        ))}
                      </select>
                      <p className="publisher-help">
                        Select the installers you support. Check their operating
                        system and processor against the release documentation.
                      </p>
                      <div className="publisher-assets">
                        {release?.assets.map((asset) => (
                          <label
                            key={asset.id}
                            className={`publisher-asset ${asset.eligible ? "" : "unsupported"}`}
                          >
                            <input
                              type="checkbox"
                              disabled={!asset.eligible}
                              checked={input.assets.some(
                                (a) => a.id === asset.id,
                              )}
                              onChange={(e) =>
                                update({
                                  assets:
                                    e.target.checked && asset.platform
                                      ? [
                                          ...input.assets,
                                          {
                                            id: asset.id,
                                            platform: asset.platform,
                                            architecture: asset.architecture,
                                          },
                                        ]
                                      : input.assets.filter(
                                          (a) => a.id !== asset.id,
                                        ),
                                })
                              }
                            />
                            <span>
                              <strong>{asset.name}</strong>
                              <small>
                                {asset.platform
                                  ? platformLabels[asset.platform]
                                  : "Unsupported format"}{" "}
                                · {asset.architecture} ·{" "}
                                {(asset.size / 1048576).toFixed(1)} MB
                              </small>
                              <small>{asset.reason}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                      {!release?.assets.length && (
                        <p>
                          No uploaded installers in this release. Source
                          archives are not installers.
                        </p>
                      )}
                    </>
                  ) : (
                    <p>
                      No stable releases found. Add a supported GitHub release
                      or provide a web app URL.
                    </p>
                  )}
                  <p className="publisher-help">
                    Supported: EXE, MSI, DMG, PKG, AppImage, DEB, RPM. Source
                    archives and generic ZIP files are excluded.
                  </p>
                </section>
              </aside>
            </fieldset>
          )}
          {step === 2 && (
            <section className="publisher-panel">
              <div className="publisher-heading small">
                <div>
                  <span className="publisher-pill">Unpublished preview</span>
                  <h2>{app.name}</h2>
                  <p>{app.summary}</p>
                </div>
                <span className="publisher-pill">
                  {user
                    ? listing?.revisionStatus === "pending_review"
                      ? "GitHub account connected · In review"
                      : "GitHub account connected · Unpublished changes"
                    : "Local preview · Publisher not verified"}
                </span>
              </div>
              <div className="publisher-preview">
                <div>
                  <ScreenshotGallery app={app} />
                  <h3>About this app</h3>
                  <p className="publisher-description">{app.description}</p>
                  <p>
                    By {app.developerName} ·{" "}
                    {app.license ?? "Licence not identified"} ·{" "}
                    {app.latestVersion ?? "Web application"}
                  </p>
                  <a href={repo.url} target="_blank" rel="noreferrer">
                    View repository on GitHub
                  </a>
                </div>
                <aside>
                  <h3>Try a download</h3>
                  <p>
                    These are real third-party downloads. GitHub hosting does
                    not verify software safety.
                  </p>
                  <label htmlFor="preview-platform">Choose your device</label>
                  <select
                    id="preview-platform"
                    value={downloadPlatform}
                    onChange={(e) =>
                      setDownloadPlatform(e.target.value as Platform | "")
                    }
                  >
                    <option value="">Select a platform</option>
                    {(["windows", "macos", "linux", "web"] as const).map(
                      (p) => (
                        <option key={p} value={p}>
                          {platformLabels[p]}
                        </option>
                      ),
                    )}
                  </select>
                  {downloadPlatform &&
                    !app.platforms.includes(downloadPlatform) && (
                      <p role="status">
                        No {platformLabels[downloadPlatform]} download is
                        selected for this listing.
                      </p>
                    )}
                  {selected
                    .filter((asset) => asset.platform === downloadPlatform)
                    .map((asset) => (
                      <div className="publisher-download" key={asset.id}>
                        <strong>
                          {asset.platform && platformLabels[asset.platform]} ·{" "}
                          {asset.architecture}
                        </strong>
                        <small>{asset.name}</small>
                        <Button asChild variant="secondary">
                          <a
                            href={`/api/developer/download?${new URLSearchParams({ repository: repo.fullName, releaseId: String(asset.releaseId), assetId: String(asset.id), platform: asset.platform ?? "" })}`}
                          >
                            Download installer
                          </a>
                        </Button>
                        <p>{installationInstructions(asset.format)}</p>
                      </div>
                    ))}
                  {downloadPlatform === "web" && safeHttps(input.webUrl) && (
                    <Button asChild>
                      <a href={input.webUrl} target="_blank" rel="noreferrer">
                        Open web app
                      </a>
                    </Button>
                  )}
                  <p className="publisher-help">
                    Downloading an installer does not install the application.
                  </p>
                  <h3>Marketplace card</h3>
                  <div className="publisher-card-preview" inert>
                    <AppCard app={app} variant="preview" />
                  </div>
                </aside>
              </div>
            </section>
          )}
          {step === 3 && (
            <section className="publisher-panel publisher-finish">
              <Check size={38} />
              <h2>
                {listing?.status === "suspended"
                  ? "This listing is suspended."
                  : locked
                    ? "Your submission is in review."
                    : listing?.status === "published"
                      ? "Submit your update for review."
                      : "Ready for review?"}
              </h2>
              <p>
                {listing?.status === "published"
                  ? "Your current public listing stays available while this update is reviewed."
                  : "A moderator will review your listing before it appears in the marketplace."}
              </p>
              {!repo.license && (
                <p className="publisher-error">
                  GitHub has not identified an open-source licence. Add a
                  licence to your repository and refresh before submitting.
                </p>
              )}
              <div className="publisher-actions">
                {!user ? (
                  <Button asChild>
                    <a
                      href={signInUrl}
                      onClick={(e) => {
                        try {
                          saveRecovery();
                        } catch {
                          e.preventDefault();
                          setError(
                            "Save or export your draft before leaving this page. Browser storage is unavailable.",
                          );
                        }
                      }}
                    >
                      Connect GitHub to submit
                    </a>
                  </Button>
                ) : locked ? (
                  <Button
                    variant="secondary"
                    disabled={busy || listing?.status === "suspended"}
                    onClick={() => void reopen()}
                  >
                    Return to draft
                  </Button>
                ) : (
                  <Button
                    disabled={
                      busy || stale || issues.length > 0 || !repo.license
                    }
                    onClick={() => void submit()}
                  >
                    {busy ? "Saving and submitting…" : "Submit for review"}
                  </Button>
                )}
                <Button variant="secondary" onClick={exportDraft}>
                  Export listing JSON
                </Button>
              </div>
              {listing?.status === "published" && (
                <Link href={`/apps/${listing.slug}`}>
                  View current public listing
                </Link>
              )}
            </section>
          )}
          {step === 1 && issues.length > 0 && (
            <div className="publisher-validation">
              <strong>Before previewing</strong>
              <ul>
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="publisher-footer">
            <Button
              variant="secondary"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={busy}
            >
              <ArrowLeft size={16} />
              Back
            </Button>
            {step < 3 && (
              <Button
                disabled={busy || issues.length > 0}
                onClick={() => setStep(step + 1)}
              >
                {step === 1 ? "Preview listing" : "Continue"}
                <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </>
      ) : (
        <p>Return to Connect to import a repository.</p>
      )}
    </main>
  );
}
