"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowUpRight,
  Compass,
  Grid2X2,
  Palette,
  Layers2,
  Shield,
  Wrench,
  Code2,
  Search,
} from "lucide-react";
import { Brand } from "./brand";
import { ThemeToggle } from "./theme-toggle";
const links = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/apps", label: "Browse apps", icon: Grid2X2 },
];
const categories = [
  { name: "Productivity", icon: Layers2 },
  { name: "Creativity", icon: Palette },
  { name: "Developer Tools", icon: Code2 },
  { name: "Utilities", icon: Wrench },
  { name: "Security & Privacy", icon: Shield },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document
          .querySelector<HTMLInputElement>(".global-search input")
          ?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <>
      <aside className="sidebar">
        <Brand />
        <nav className="primary-nav" aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (
                  href === "/"
                    ? pathname === "/"
                    : pathname.startsWith("/apps") || pathname === "/explore"
                )
                  ? "page"
                  : undefined
              }
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <span className="sidebar-label">Categories</span>
        <nav className="sidebar-categories" aria-label="App categories">
          {categories.map(({ name, icon: Icon }) => (
            <Link
              key={name}
              href={`/apps?category=${encodeURIComponent(name)}`}
            >
              <Icon size={17} />
              {name}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/developer" className="sidebar-publish">
            <Code2 size={16} />
            For developers
            <ArrowUpRight size={13} />
          </Link>
          <Link href="/about" className="sidebar-about">
            About Commons
          </Link>
        </div>
      </aside>
      <div className="site-content">
        <header className="topbar">
          <Link href="/" className="mobile-brand" aria-label="Commons home">
            <Layers2 size={21} />
            commons.
          </Link>
          <form action="/apps" role="search" className="global-search">
            <Search size={17} />
            <input
              name="q"
              aria-label="Search applications"
              placeholder="Search apps, categories, developers"
            />
            <kbd>⌘ K</kbd>
            <button type="submit" aria-label="Search">
              <Search size={16} />
            </button>
          </form>
          <Link className="publish-link" href="/developer">
            Publish your app
            <ArrowUpRight size={14} />
          </Link>
          <ThemeToggle />
        </header>
        {children}
      </div>
      <nav className="mobile-navigation" aria-label="Mobile navigation">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          <Compass size={20} />
          Discover
        </Link>
        <Link
          href="/apps"
          aria-current={pathname.startsWith("/apps") ? "page" : undefined}
        >
          <Grid2X2 size={20} />
          Browse
        </Link>
        <Link href="/developer">
          <Code2 size={20} />
          Publish
        </Link>
      </nav>
    </>
  );
}
