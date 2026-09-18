import { createRoot, hydrateRoot } from "react-dom/client";
import { RenderComparison } from "./render-content";
const root = document.getElementById("root")!;
if (document.documentElement.dataset.mode === "csr") {
  createRoot(root).render(<RenderComparison />);
  document.documentElement.dataset.clientMode = "createRoot";
} else {
  hydrateRoot(root, <RenderComparison />);
  document.documentElement.dataset.clientMode = "hydrateRoot";
}
