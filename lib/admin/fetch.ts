/**
 * Reading an admin API response without assuming it is JSON.
 *
 * A crashed serverless function returns Vercel's HTML error page, and a bare
 * `response.json()` then throws `Unexpected token '<'` — which tells whoever
 * is looking at the admin panel nothing at all. These helpers turn that into
 * the status code and a message worth acting on.
 */

export interface AdminResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** Present when the request failed; safe to show in the UI. */
  error?: string;
}

function messageForStatus(status: number): string {
  if (status === 401) return "Your session has expired — please sign in again.";
  if (status === 403) return "You do not have access to this.";
  if (status === 404) return "Not found.";
  if (status === 429) return "Too many requests — wait a moment and retry.";
  if (status >= 500) {
    return `The server failed (HTTP ${status}). Check the Vercel runtime logs for this route.`;
  }
  return `Request failed (HTTP ${status}).`;
}

/** Parse a response body as JSON, tolerating a non-JSON error page. */
export async function readJson<T>(response: Response): Promise<AdminResponse<T>> {
  const text = await response.text();

  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // Not JSON — an HTML error page, a proxy timeout, an empty body.
      parsed = null;
    }
  }

  const asRecord =
    parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const serverError =
    asRecord && typeof asRecord.error === "string" ? asRecord.error : undefined;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: (parsed as T) ?? null,
      error: serverError ?? messageForStatus(response.status),
    };
  }

  if (parsed === null && text) {
    // A 200 that is not JSON means something upstream replaced the response.
    return {
      ok: false,
      status: response.status,
      data: null,
      error: "The server returned an unexpected response.",
    };
  }

  return { ok: true, status: response.status, data: parsed as T };
}

/** fetch + readJson, turning a network failure into the same shape. */
export async function adminFetch<T>(
  input: string,
  init?: RequestInit,
): Promise<AdminResponse<T>> {
  try {
    const response = await fetch(input, init);
    return readJson<T>(response);
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      error: "Network error — check your connection and try again.",
    };
  }
}
