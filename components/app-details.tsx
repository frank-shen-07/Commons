"use client";
import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  platformLabels,
  platforms,
  type DownloadOption,
  type MarketplaceApp,
  type Platform,
} from "@/lib/types";
import { Button } from "./ui/button";
import Image from "next/image";
import type { DownloadChoice } from "@/src/types/api";
export function DownloadButton({
  app,
  endpoint,
}: {
  app: MarketplaceApp;
  endpoint?: string;
}) {
  const [platform, setPlatform] = useState<Platform | "">("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [choices, setChoices] = useState<DownloadChoice[]>([]),
    [assetId, setAssetId] = useState("");
  const [acknowledged, setAcknowledged] = useState(false),
    [instructions, setInstructions] = useState("");
  const sequence = useRef(0);
  const supported = platform && app.platforms.includes(platform);
  const selected = choices.find((choice) => choice.assetId === assetId);
  async function download() {
    if (!platform || !endpoint) return;
    const requestId = ++sequence.current;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const url = new URL(
        endpoint.replace("{slug}", encodeURIComponent(app.slug)),
        window.location.origin,
      );
      url.searchParams.set("platform", platform);
      if (assetId) url.searchParams.set("assetId", assetId);
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      if (requestId !== sequence.current) return;
      if (
        response.status === 409 &&
        body.error?.code === "ASSET_SELECTION_REQUIRED" &&
        Array.isArray(body.error.details)
      ) {
        setChoices(body.error.details);
        setAssetId("");
        setAcknowledged(false);
        setMessage("Choose the installer that matches your device.");
        return;
      }
      if (!response.ok)
        throw new Error(
          body.error?.message ??
            "This download is unavailable. Try again or visit the official releases.",
        );
      const option: DownloadOption = body.data;
      if (
        !option ||
        typeof option.url !== "string" ||
        option.platform !== platform
      )
        throw new Error("A matching download link was not returned.");
      const destination = new URL(option.url);
      if (
        destination.protocol !== "https:" ||
        destination.username ||
        destination.password
      )
        throw new Error("The download destination is invalid.");
      setInstructions(option.instructions ?? "");
      setMessage(
        platform === "web"
          ? "Opening the web application…"
          : "Your download was requested. Open the downloaded file and follow the installation instructions.",
      );
      window.location.assign(destination.href);
    } catch (e) {
      if (requestId === sequence.current)
        setError(
          e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.",
        );
    } finally {
      if (requestId === sequence.current) setBusy(false);
    }
  }
  return (
    <section className="download-panel" aria-label="Get this application">
      <h2>Get the app</h2>
      <label htmlFor="download-platform">Choose your device</label>
      <select
        id="download-platform"
        value={platform}
        onChange={(e) => {
          sequence.current++;
          setPlatform(e.target.value as Platform);
          setBusy(false);
          setMessage("");
          setError("");
          setChoices([]);
          setAssetId("");
          setAcknowledged(false);
          setInstructions("");
        }}
      >
        <option value="">Select your device</option>
        {platforms.map((p) => (
          <option key={p} value={p}>
            {platformLabels[p]}
          </option>
        ))}
      </select>
      {platform && !supported && (
        <p role="status">
          This listing doesn’t include a {platformLabels[platform]} download.
          Choose another device.
        </p>
      )}
      {choices.length > 0 && (
        <>
          <label htmlFor="download-asset">Choose an installer</label>
          <select
            id="download-asset"
            value={assetId}
            onChange={(e) => {
              setAssetId(e.target.value);
              setAcknowledged(false);
              setInstructions("");
            }}
          >
            <option value="">Select an installer</option>
            {choices.map((choice) => (
              <option key={choice.assetId} value={choice.assetId}>
                {choice.fileName} · {choice.architecture}
                {choice.sizeBytes
                  ? ` · ${(choice.sizeBytes / 1048576).toFixed(1)} MB`
                  : ""}
              </option>
            ))}
          </select>
          {selected?.architecture === "unknown" && (
            <label className="download-acknowledgement">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              The processor compatibility is unknown. I have checked the
              publisher’s release instructions.
            </label>
          )}
        </>
      )}
      {endpoint ? (
        <Button
          onClick={() => void download()}
          disabled={
            !supported ||
            busy ||
            (choices.length > 0 &&
              (!assetId ||
                (selected?.architecture === "unknown" && !acknowledged)))
          }
        >
          <ArrowDownToLine size={17} />
          {busy
            ? "Finding your download…"
            : platform === "web"
              ? "Open web app"
              : `Download${platform ? ` for ${platformLabels[platform]}` : ""}`}
        </Button>
      ) : (
        <Button asChild>
          <a
            href={app.releasesUrl || app.websiteUrl || app.repositoryUrl}
            target="_blank"
            rel="noreferrer"
          >
            {app.releasesUrl
              ? "Choose a release on GitHub"
              : "Get it from the developer"}
            <ArrowUpRight size={14} />
          </a>
        </Button>
      )}
      {!endpoint && (
        <p className="download-guidance">
          Choose a compatible installer on the official release page, then open
          the downloaded file to begin.
        </p>
      )}
      {instructions && <p className="download-guidance">{instructions}</p>}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <p className="download-guidance">
        Provided by the publisher. Not security verified.
      </p>
    </section>
  );
}
export function ScreenshotGallery({ app }: { app: MarketplaceApp }) {
  const [index, setIndex] = useState(0);
  if (!app.screenshots.length) return null;
  return (
    <section aria-label="App screenshots" className="screenshot-gallery">
      <Image
        unoptimized
        width={1200}
        height={750}
        src={app.screenshots[index]}
        alt={`${app.name} screenshot ${index + 1}`}
      />
      <div>
        <Button
          variant="secondary"
          aria-label="Previous screenshot"
          onClick={() =>
            setIndex(
              (index + app.screenshots.length - 1) % app.screenshots.length,
            )
          }
        >
          <ChevronLeft size={17} />
        </Button>
        <span aria-live="polite">
          {index + 1} of {app.screenshots.length}
        </span>
        <Button
          variant="secondary"
          aria-label="Next screenshot"
          onClick={() => setIndex((index + 1) % app.screenshots.length)}
        >
          <ChevronRight size={17} />
        </Button>
      </div>
    </section>
  );
}
export function FeatureList({ features }: { features: string[] }) {
  return (
    <ul className="feature-list">
      {features.map((feature) => (
        <li key={feature}>
          <Check size={16} />
          {feature}
        </li>
      ))}
    </ul>
  );
}

// Long GitHub release notes collapse to a preview; the toggle only appears
// when the text actually overflows.
export function ReleaseNotes({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = notes.length > 600 || notes.split("\n").length > 10;
  return (
    <div className="release">
      <p
        id="release-notes"
        className={`release-notes ${long && !expanded ? "release-clamped" : ""}`}
      >
        {notes}
      </p>
      {long && (
        <button
          type="button"
          className="release-toggle"
          aria-expanded={expanded}
          aria-controls="release-notes"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
