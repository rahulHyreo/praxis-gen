/**
 * Build identity, surfaced by /api/health.
 *
 * Both values come from the environment so the running image can be identified
 * without shelling into it — "which build is this?" is the first question when
 * a deploy misbehaves. The Dockerfile sets them at build time; a host-mode
 * `pnpm dev` leaves them unset and gets the development fallbacks.
 */
export const API_BUILD_ID = process.env.API_BUILD_ID ?? "dev"

export const API_BUILD_TIME = process.env.API_BUILD_TIME ?? "unknown"
