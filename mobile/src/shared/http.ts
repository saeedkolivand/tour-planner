/**
 * JSON request to the server; throws with the server's error message. Gives up after `timeoutMs`: a dropped
 * Tailscale connection otherwise hangs for about a minute.
 */
export async function request<T>(baseUrl: string, method: string, path: string, body?: unknown, fetchFn: typeof fetch = fetch, timeoutMs = 15_000): Promise<T> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const r = await fetchFn(baseUrl.replace(/\/$/, '') + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: abort.signal,
  }).catch(e => { throw abort.signal.aborted ? new Error(`${method} ${path} timed out`) : e; })
    .finally(() => clearTimeout(timer));
  // a redirect target, a captive portal or a proxy page answers 200 with HTML: that is not the server
  const text = await r.text().catch(() => '');
  let json: Record<string, unknown>;
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { json = {}; if (r.ok) throw new Error(`Not the tour server (${r.status}${r.url && r.redirected ? `, redirected to ${new URL(r.url).host}` : ''})`); }
  if (!r.ok) throw new Error((json.error as string | undefined) ?? `Server error ${r.status}`);
  return json as T;
}
