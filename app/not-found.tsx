import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main id="main" className="page-container inner-page status-page">
      <Compass size={32} strokeWidth={1.6} aria-hidden />
      <h1>Page not found</h1>
      <p>This page may have moved, or the link may be out of date.</p>
      <div className="status-actions">
        <Button asChild>
          <Link href="/apps">Browse apps</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Go to Discover</Link>
        </Button>
      </div>
    </main>
  );
}
