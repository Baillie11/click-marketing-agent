export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw Object.assign(new Error(data.error ?? `Request failed (${response.status})`), {
      actionUrl: data.actionUrl as string | undefined,
    });
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
