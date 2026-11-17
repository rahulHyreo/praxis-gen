/* eslint-disable react-refresh/only-export-components --
 * This file exports both the route table (`router`) and the component that
 * mounts it (`AppRouter`), which the react-refresh rule disallows: a non-
 * component export means an edit here does a full reload rather than a hot
 * update.
 *
 * That cost is accepted deliberately. docs/SPEC.md §39 requires every route to
 * be registered in this one file, and splitting the table into a second module
 * to satisfy a hot-reload ergonomic would mean the route registry is no longer
 * where the specification says to look for it. Editing the route table is also
 * rare, and a full reload on it is barely noticeable.
 */
import { createBrowserRouter, RouterProvider } from "react-router-dom"

import { AppShell } from "./AppShell"
import { HomePage } from "./HomePage"
import { NotFoundPage } from "./NotFoundPage"

/**
 * EVERY route in the application is registered here (docs/SPEC.md §39: "routes
 * in app/router.tsx"). One registry means the route table, the role guards and
 * the shells are reviewable in one file instead of scattered across features.
 *
 * Role guards belong here too, wrapping the routes they protect — but the guard
 * only decides what to RENDER. Access itself is decided server-side (§6, §12);
 * a hidden route is not access control, and the API refuses regardless.
 *
 * The trainee navigation §33 specifies — Home, My Program, Current Week,
 * Workbench, Practice, Assessments, Results, Credentials, Overlay, Guides,
 * Profile — plus the admin, trainer, evaluator and governance surfaces, are
 * added here by the changes that build them.
 */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
