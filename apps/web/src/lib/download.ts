import { getAccessToken } from './api-client';

export async function downloadCsv(urlPath: string, fallbackFilename: string): Promise<void> {
  const API = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
  const token = getAccessToken();

  const res = await fetch(`${API}${urlPath}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => null);
    throw new Error(errorJson?.message || 'Gagal mengunduh berkas CSV');
  }

  // Check content-disposition header for filename
  let filename = fallbackFilename;
  const disposition = res.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match?.[1]) {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(blobUrl);
}
