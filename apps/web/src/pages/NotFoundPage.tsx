import { SearchX } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="standalone-state standalone-state--embedded">
      <SearchX aria-hidden="true" size={34} />
      <h1>Page not found</h1>
      <p>
        The requested workspace route does not exist or is no longer available.
      </p>
      <Link className="button button--primary" to="/">
        Return to dashboard
      </Link>
    </div>
  );
}
