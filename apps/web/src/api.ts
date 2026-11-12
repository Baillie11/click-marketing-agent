export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers },
    });
  } catch {
    throw new Error('The server could not be reached. Please wait a moment and try again.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(data.error ?? `Request failed (${response.status})`), {
      actionUrl: data.actionUrl as string | undefined,
    });
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
