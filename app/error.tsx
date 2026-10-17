"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="page-container empty-state inner-page">
      <h1>A small bump in the road.</h1>
      <p>We couldn’t load the marketplace. Please try again in a moment.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
