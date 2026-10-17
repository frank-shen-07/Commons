import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main id="main" className="page-container empty-state inner-page">
      <h1>This app wandered off.</h1>
      <p>It may have moved, or this listing is no longer available.</p>
      <Button asChild>
        <Link href="/explore">Explore apps</Link>
      </Button>
    </main>
  );
}
