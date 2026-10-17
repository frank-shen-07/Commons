import Link from "next/link";
import { OpenSourceBanner } from "@/components/marketplace";
export const metadata = { title: "About Commons" };
export default function About() {
  return (
    <main id="main" className="page-container inner-page about-page">
      <h1>Open to everyone.</h1>
      <p className="page-description">
        Commons makes open-source software easier to discover, understand, and
        enjoy.
      </p>
      <OpenSourceBanner />
      <section className="detail-section">
        <h2>What does open source mean?</h2>
        <p>
          Open-source software gives people permission to inspect, use, change,
          and share its code under the project’s license. You don’t need to be a
          developer to enjoy it. Just find an app that makes your day better.
        </p>
        <p>
          Some projects offer paid services or optional upgrades. Check the
          developer’s website for the details.
        </p>
        <Link href="/explore">Find an app you’ll love →</Link>
      </section>
      <section id="developers" className="detail-section">
        <h2>Your work deserves to be discovered.</h2>
        <p>
          Prepare a listing with our developer portal: import a public GitHub
          repository you maintain, choose release assets, and submit your app
          for review. Approved listings appear in the marketplace.
        </p>
        <p>
          <Link href="/developer">Open your developer workspace →</Link>
        </p>
      </section>
    </main>
  );
}
