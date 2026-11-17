import type { ApiErrorBody } from "@platform/shared"

/**
 * The SINGLE point of API access for the whole web app.
 *
 * docs/SPEC.md §39: "all access through lib/api.ts" and "views never call
 * `api.*`". A view renders; a viewmodel hook calls this; nothing else issues a
 * request. Two reasons that matters beyond tidiness:
 *
 *  - Tests mock this module (§43: no network in web tests). A `fetch` buried in
 *    a component cannot be mocked without rendering the network, so it either
 *    leaks or forces a test to special-case it.
 *  - Error handling, credentials and the §38 envelope are handled once. A
 *    stray `fetch` gets none of it and fails differently from everything else.
 *
 * Requests are same-origin and relative (`/api/...`): the Vite dev server
 * proxies `/api` to the api process, so the session cookie behaves in
 * development as it will when both are served together.
 */

/** An API call that returned a non-2xx response. */
export class ApiRequestError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(status: number, body: ApiErrorBody) {
    super(body.error || `Request failed with status ${status}`)
    this.name = "ApiRequestError"
    this.status = status
    this.code = body.code
    this.details = body.details
  }
}

const BASE = "/api"

async function parseError(res: Response): Promise<ApiErrorBody> {
  // The server always sends the §38 envelope — but a proxy error page, a
  // gateway timeout or an aborted response will not, so never assume JSON.
  try {
    const body = (await res.json()) as unknown
    if (body && typeof body === "object" && "error" in body) {
      return body as ApiErrorBody
    }
    return { error: `Request failed with status ${res.status}` }
  } catch {
    return { error: `Request failed with status ${res.status}` }
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    // Sessions are cookie-based, so every request must carry them.
    credentials: "include",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...init,
  })

  if (!res.ok) {
    throw new ApiRequestError(res.status, await parseError(res))
  }

  // 204 and other empty responses have no body to parse.
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>("GET", path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>("POST", path, body, init),
  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>("PUT", path, body, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>("PATCH", path, body, init),
  delete: <T>(path: string, init?: RequestInit) =>
    request<T>("DELETE", path, undefined, init),
}

/** The shape of `GET /api/health`. */
export interface HealthResponse {
  status: string
  build: string
  buildTime: string
  uptimeSeconds: number
}
