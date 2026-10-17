"use client";
import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
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
export function DownloadButton({
  app,
  endpoint,
}: {
  app: MarketplaceApp;
  endpoint?: string;
}) {
  const [platform, setPlatform] = useState<Platform | "">(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const supported = platform && app.platforms.includes(platform);
  async function download() {
    if (!platform || !endpoint) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const url = new URL(
        endpoint.replace("{slug}", encodeURIComponent(app.slug)),
        window.location.origin,
      );
      url.searchParams.set("platform", platform);
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok)
        throw new Error(
          "A download isn’t available right now. Please try again or visit the developer website.",
        );
      const option: DownloadOption = await response.json();
      if (typeof option.url !== "string" || !option.url.trim())
        throw new Error(
          "The download link is missing. Please use the official release page.",
        );
      const destination = new URL(option.url, window.location.origin);
      if (
        !["https:", "http:"].includes(destination.protocol) ||
        option.platform !== platform
      )
        throw new Error(
          "We couldn’t find a matching download for your device.",
        );
      window.location.assign(destination.href);
      setMessage(
        "Your download was requested. Open the downloaded file and follow the installer’s instructions.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="download-panel" aria-label="Get this application">
      <h2>Get the app</h2>
      <p>Free to download. Yours to explore.</p>
      <label htmlFor="download-platform">Choose your device</label>
      <select
        id="download-platform"
        value={platform}
        onChange={(e) => {
          setPlatform(e.target.value as Platform);
          setMessage("");
          setError("");
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
      {endpoint ? (
        <Button onClick={download} disabled={!supported || busy}>
          <ArrowDownToLine size={17} />
          {busy
            ? "Finding your download…"
            : `Download${platform ? ` for ${platformLabels[platform]}` : ""}`}
        </Button>
      ) : (
        <Button asChild>
          <a
            href={app.releasesUrl ?? app.websiteUrl}
            target="_blank"
            rel="noreferrer"
          >
            {app.releasesUrl
              ? "Choose a release on GitHub"
              : "Get it from the developer"}{" "}
            <ArrowUpRight size={17} />
          </a>
        </Button>
      )}
      {!endpoint && (
        <p className="download-guidance">
          {app.releasesUrl
            ? "Choose a compatible installer from the project’s GitHub releases."
            : "Downloads currently open the official website."}{" "}
          Choose the installer for your device there, then open the downloaded
          file to begin.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </section>
  );
}
export function ScreenshotGallery({ app }: { app: MarketplaceApp }) {
  const [index, setIndex] = useState(0);
  if (!app.screenshots.length)
    return (
      <div className="screenshot-empty">
        <ImageIcon size={34} />
        <h3>A closer look is coming.</h3>
        <p>Screenshots haven’t been added to this listing yet.</p>
        <a href={app.websiteUrl} target="_blank" rel="noreferrer">
          Visit the official website <ArrowUpRight size={14} />
        </a>
      </div>
    );
  return (
    <section aria-label="App screenshots" className="screenshot-gallery">
      <Image
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
