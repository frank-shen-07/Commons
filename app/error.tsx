"use client";
import Link from "next/link";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="page-container inner-page status-page">
      <CloudOff size={32} strokeWidth={1.6} aria-hidden />
      <h1>A small bump in the road.</h1>
      <p>We couldn’t load the marketplace. Please try again in a moment.</p>
      <div className="status-actions">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="secondary">
          <Link href="/">Go to Discover</Link>
        </Button>
      </div>
    </main>
  );
}
