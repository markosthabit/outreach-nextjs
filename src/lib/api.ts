export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';


// ---- Internal state for refresh coordination ----
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;
let queuedRequests: (() => void)[] = [];

// ---- Helper: trigger refresh only once ----
async function refreshAccessToken() {
  if (!refreshPromise) {
    isRefreshing = true;
    refreshPromise = fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Refresh failed");
      })
      .finally(() => {
        isRefreshing = false;
        refreshPromise = null;

        // allow queued requests to retry
        queuedRequests.forEach((resolve) => resolve());
        queuedRequests = [];
      });
  }

  return refreshPromise;
}

// ---- Main function ----
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      credentials: "include",
      ...options,
    });
    return res;
  };

  let res = await doFetch();

  // ----- Handle expired token -----
  if (res.status === 401) {
    // If already refreshing → wait
    if (isRefreshing) {
      await new Promise<void>((resolve) => queuedRequests.push(resolve));
    } else {
      try {
        await refreshAccessToken();
      } catch (err) {
        console.error("Token refresh failed:", err);
        // Optionally redirect to login
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw err;
      }
    }

    // After refresh (successful or waited), retry the original request
    res = await doFetch();
  }

 // ----- Handle other errors -----
if (!res.ok) {
  let errorBody: any = null
  const text = await res.text() // read once as text
  try {
    errorBody = JSON.parse(text) // try to parse as JSON
  } catch {
    errorBody = { message: text, statusCode: res.status }
  }

  if (!errorBody.statusCode) {
    errorBody.statusCode = res.status
  }

  throw errorBody
}


  // ----- Success -----
  return res.json();
}
