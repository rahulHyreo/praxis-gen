/**
 * @platform/shared — Zod schemas and constants shared by apps/api and apps/web.
 *
 * docs/SPEC.md §38 ("Zod schema first") makes this package the place a request
 * or response shape is defined once and consumed by both sides. Nothing
 * domain-specific belongs here: pack vocabulary (claim, DCN, pay, deny) lives
 * in a domain pack, never in shared code (§Non-negotiables).
 *
 * Schemas arrive with the changes that need them. This package currently
 * carries the §38 error envelope and its code vocabulary.
 */

export * from "./error-codes.js"
