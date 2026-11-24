const localHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
export const apiOrigin = ODONTO_API_ORIGIN || (localHost ? "http://" + window.location.hostname + ":8000" : "");

export async function request(path, { method = "GET", body, signal, headers } = {}) {
  const raw = body instanceof Blob;
  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", raw ? body.type || "application/octet-stream" : "application/json");
  }
  const response = await fetch(apiOrigin + path, {
    method,
    signal,
    credentials: "include",
    headers: requestHeaders,
    body: raw ? body : JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401 && !["/auth/me", "/auth/logout"].includes(path)) {
      window.dispatchEvent(new Event("odontosoft:session-expired"));
    }
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.detail === "string" ? error.detail : "Error " + response.status);
  }
  return response.status === 204 ? null : response.json();
}
