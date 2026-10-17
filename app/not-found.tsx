import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main id="main" className="page-container empty-state inner-page">
      <h1>Page not found</h1>
      <Button asChild>
        <Link href="/explore">Explore apps</Link>
      </Button>
    </main>
  );
}
