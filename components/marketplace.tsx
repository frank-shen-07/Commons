import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Box,
  ChevronRight,
  Code2,
  Compass,
  FileText,
  Flame,
  GraduationCap,
  Layers2,
  Leaf,
  LockKeyhole,
  MessageCircle,
  Monitor,
  Palette,
  Play,
  Search,
  Star,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { platformLabels, type MarketplaceApp } from "@/lib/types";
import { Button } from "./ui/button";
export { Brand } from "./brand";
export function Footer() {
  return (
    <footer className="footer">
      <p>Good software belongs to everyone.</p>
      <div>
        <Link href="/about">About Commons</Link>
        <a href="https://opensource.org/osd" target="_blank" rel="noreferrer">
          What is open source?
          <ArrowUpRight size={12} />
        </a>
      </div>
    </footer>
  );
}
export function SearchBar({
  defaultValue = "",
  large = false,
}: {
  defaultValue?: string;
  large?: boolean;
}) {
  return (
    <form
      action="/apps"
      role="search"
      className={`search-bar ${large ? "search-large" : ""}`}
    >
      <Search size={20} />
      <input
        name="q"
        aria-label="Search apps and public GitHub repositories"
        placeholder="Search apps and public GitHub repositories"
        defaultValue={defaultValue}
      />
      <button type="submit" aria-label="Find apps">
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
const appIcons: Record<string, LucideIcon> = {
  blender: Box,
  obs: AudioLines,
  firefox: Flame,
  libreoffice: FileText,
  vlc: Play,
  bitwarden: ShieldCheck,
};
export function AppIcon({
  app,
  large = false,
}: {
  app: MarketplaceApp;
  large?: boolean;
}) {
  const Icon = appIcons[app.id] ?? Box;
  return (
    <span
      className={`app-icon ${large ? "app-icon-large" : ""}`}
      style={{ background: app.color }}
    >
      {app.iconUrl ? (
        <Image
          unoptimized
          src={app.iconUrl}
          alt=""
          width={large ? 96 : 56}
          height={large ? 96 : 56}
        />
      ) : (
        <Icon size={large ? 45 : 27} strokeWidth={1.7} />
      )}
    </span>
  );
}
export function PlatformBadge({ app }: { app: MarketplaceApp }) {
  return (
    <span className="platforms">
      <Monitor size={12} />
      {app.platforms.map((p) => platformLabels[p]).join(" · ")}
    </span>
  );
}
export function AppCard({
  app,
  variant = "standard",
  href,
}: {
  app: MarketplaceApp;
  variant?: "standard" | "compact" | "preview";
  href?: string;
}) {
  return (
    <Link href={href ?? `/apps/${app.slug}`} className={`app-card app-card-${variant}`}>
      {variant === "preview" && app.screenshots.length > 0 && (
        <div className="app-preview">
          <Image
            unoptimized
            src={app.screenshots[0]}
            alt={`${app.name} application preview`}
            width={700}
            height={430}
          />
        </div>
      )}
      <div className="app-card-main">
        <AppIcon app={app} />
        <div className="app-card-copy">
          <h3>{app.name}</h3>
          <p>{app.summary}</p>
          <span className="app-category">
            {app.category}
            {app.repositoryStars !== undefined &&
              ` · ${app.repositoryStars.toLocaleString()} stars`}
          </span>
        </div>
        <span className="get-pill">
          View
          <ChevronRight size={12} />
        </span>
      </div>
      <div className="app-card-bottom">
        {app.repositoryStars !== undefined ? (
          <span className="platforms">
            <Star size={12} />
            {app.repositoryStars.toLocaleString()} stars
          </span>
        ) : (
          <PlatformBadge app={app} />
        )}
        <span>
          {app.repositoryStars !== undefined ? "Public GitHub repo" : "Open source"}
        </span>
      </div>
    </Link>
  );
}
export function AppGrid({
  apps,
  variant = "standard",
  getHref,
}: {
  apps: MarketplaceApp[];
  variant?: "standard" | "compact" | "preview";
  getHref?: (app: MarketplaceApp) => string;
}) {
  return (
    <div className={`app-grid app-grid-${variant}`}>
      {apps.map((app) => {
        const href = getHref?.(app);
        return (
          <AppCard
            app={app}
            variant={variant}
            href={href}
            key={href ?? app.id}
          />
        );
      })}
    </div>
  );
}
export function SectionHeading({
  title,
  href,
  link = "See all",
  description,
}: {
  title: string;
  href?: string;
  link?: string;
  description?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link href={href}>
          {link}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
export function FeaturedAppCard({
  app,
  secondary = false,
}: {
  app: MarketplaceApp;
  secondary?: boolean;
}) {
  return (
    <Link
      href={`/apps/${app.slug}`}
      className={`featured-card ${secondary ? "feature-light" : "feature-dark"}`}
    >
      <div className="feature-copy">
        <h2>
          {secondary
            ? "A little focus.\nA lot of possibility."
            : "Your ideas deserve\na bigger stage."}
        </h2>
        <p>
          {secondary
            ? "Make room for the work that matters."
            : "Record, create, and share your point of view."}
        </p>
      </div>
      <div className="feature-media">
        {app.screenshots[0] ? (
          <Image
            priority
            unoptimized
            src={app.screenshots[0]}
            alt={`${app.name} official application screenshot`}
            width={1000}
            height={600}
          />
        ) : (
          <AppIcon app={app} large />
        )}
      </div>
      <div className="feature-app">
        <AppIcon app={app} />
        <div>
          <strong>{app.name}</strong>
          <span>
            {app.category} · {app.summary}
          </span>
        </div>
        <span className="feature-view">
          Explore
          <ArrowRight size={14} />
        </span>
      </div>
    </Link>
  );
}
const categoryIcons: Record<string, LucideIcon> = {
  Productivity: Layers2,
  Creativity: Palette,
  "Developer Tools": Code2,
  Utilities: Wrench,
  Education: GraduationCap,
  "Security & Privacy": LockKeyhole,
  Communication: MessageCircle,
  Entertainment: Play,
};
export function CategoryCard({ name }: { name: string }) {
  const Icon = categoryIcons[name] ?? Compass;
  return (
    <Link
      href={`/apps?category=${encodeURIComponent(name)}`}
      className="category-card"
    >
      <Icon size={22} />
      <strong>{name}</strong>
      <ChevronRight size={14} />
    </Link>
  );
}
export function EmptyState({
  reset,
  searchQuery = "",
}: {
  reset: () => void;
  searchQuery?: string;
}) {
  return (
    <div className="empty-state">
      <Search size={32} />
      <h2>
        {searchQuery ? "No Commons apps match this search" : "No apps found this time"}
      </h2>
      <p>
        {searchQuery
          ? "You can also search public GitHub repositories below."
          : "Try a different search or clear your filters."}
      </p>
      <Button variant="secondary" onClick={reset}>
        Clear search & filters
      </Button>
    </div>
  );
}
export function OpenSourceBanner() {
  return (
    <section className="open-banner">
      <Leaf size={28} />
      <div>
        <h2>Good tools. Great communities.</h2>
        <p>
          Built in the open, shared with everyone. Discover what open source
          makes possible.
        </p>
      </div>
      <Link href="/about">
        Learn more
        <ArrowRight size={15} />
      </Link>
    </section>
  );
}
export function TrustRow() {
  return (
    <div className="trust-row">
      <ShieldCheck size={15} />
      Open-source software. No account needed to explore.
    </div>
  );
}
