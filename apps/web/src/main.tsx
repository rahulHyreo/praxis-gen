import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

// The design system's tokens and base styles. Imported once, here, so every
// route and every component sees them. §39 locks these tokens to the shadcn
// preset b1aJCZWLY — change them in packages/ui, never per app.
import "@workspace/ui/globals.css"

import { App } from "./App"

const container = document.getElementById("root")

if (!container) {
  // index.html owns this element. If it is missing the app cannot mount, and a
  // thrown error names the cause instead of leaving a blank page.
  throw new Error("No #root element found — check apps/web/index.html")
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
