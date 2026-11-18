export function redact<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redact(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redact(value);
      }
    }
    return result as T;
  }

  return data;
}

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.startsWith('password') ||
    lower.includes('hash') ||
    lower.includes('token') ||
    lower.includes('secret')
  );
}
