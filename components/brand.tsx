import Link from "next/link";
import { Layers2 } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Commons home">
      <span className="brand-symbol">
        <Layers2 size={22} />
      </span>
      <span>
        commons<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
