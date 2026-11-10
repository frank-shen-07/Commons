"use client";
import { useEffect, useRef, useState } from "react";
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
import { Markdown } from "./markdown";

// The visitor's desktop platform, as far as the browser reveals it.
function detectPlatform(): Platform | "" {
  const agent = navigator.userAgent;
  if (
    /Android|iPhone|iPad|iPod|CrOS/i.test(agent) ||
    navigator.maxTouchPoints > 1
  )
    return "";
  if (/Windows/i.test(agent)) return "windows";
  if (/Macintosh|Mac OS X/i.test(agent)) return "macos";
  if (/Linux|X11/i.test(agent)) return "linux";
  return "";
}
export function DownloadButton({
  app,
  endpoint,
}: {
  app: MarketplaceApp;
  endpoint?: string;
}) {
  // Until the visitor chooses, preselect their own device when this listing
  // supports it.
  const [chosen, setPlatform] = useState<Platform | "" | null>(null);
  const [detected, setDetected] = useState<Platform | "">("");
  const deviceSelect = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    // Runs after hydration, and leaves the field alone if the visitor already
    // picked a device while the page was still loading.
    const timer = window.setTimeout(() => {
      if (deviceSelect.current?.value === "") setDetected(detectPlatform());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const platform: Platform | "" =
    chosen ?? (detected && app.platforms.includes(detected) ? detected : "");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [choices, setChoices] = useState<DownloadChoice[]>([]),
    [assetId, setAssetId] = useState("");
  const [acknowledged, setAcknowledged] = useState(false),
    [instructions, setInstructions] = useState("");
  const sequence = useRef(0);
  const supported = platform && app.platforms.includes(platform);
  // A listing with no installers of its own hands off to the developer's
  // official page instead of offering a device choice that can't succeed.
  const direct = Boolean(endpoint) && app.platforms.length > 0;
  const chooseDevice = direct || !endpoint;
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
      {chooseDevice && (
        <>
          <label htmlFor="download-platform">Choose your device</label>
          <select
            id="download-platform"
            ref={deviceSelect}
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
        </>
      )}
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
      {direct ? (
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
      {!direct && (
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
  const count = app.screenshots.length;
  if (!count) return null;
  const step = (by: number) => setIndex((index + by + count) % count);
  return (
    <section
      aria-label="App screenshots"
      className="screenshot-gallery"
      onKeyDown={(event) => {
        if (count < 2) return;
        if (event.key === "ArrowLeft") step(-1);
        if (event.key === "ArrowRight") step(1);
      }}
    >
      <Image
        key={app.screenshots[index]}
        unoptimized
        priority
        width={1200}
        height={750}
        src={app.screenshots[index]}
        alt={`${app.name} screenshot ${index + 1}`}
      />
      {count > 1 && (
        <div className="screenshot-controls">
          <Button
            variant="secondary"
            aria-label="Previous screenshot"
            onClick={() => step(-1)}
          >
            <ChevronLeft size={17} />
          </Button>
          <div className="screenshot-thumbs">
            {app.screenshots.map((src, position) => (
              <button
                type="button"
                key={src}
                aria-label={`Show screenshot ${position + 1} of ${count}`}
                aria-current={position === index ? "true" : undefined}
                onClick={() => setIndex(position)}
              >
                <Image unoptimized width={160} height={100} src={src} alt="" />
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            aria-label="Next screenshot"
            onClick={() => step(1)}
          >
            <ChevronRight size={17} />
          </Button>
          <span className="sr-only" aria-live="polite">
            Screenshot {index + 1} of {count}
          </span>
        </div>
      )}
    </section>
  );
}
export function FeatureList({ features }: { features: string[] }) {
  if (!features.length) return null;
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
      <Markdown
        id="release-notes"
        source={notes}
        className={long && !expanded ? "release-clamped" : ""}
      />
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
