export interface CookieSerializeOptions {
  maxAge?: number;
  domain?: string;
  path?: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: boolean | 'lax' | 'strict' | 'none' | 'Lax' | 'Strict' | 'None';
  name?: string;
  value?: string;
}

export function stringifySetCookie(
  name: string | CookieSerializeOptions,
  val?: string,
  options?: CookieSerializeOptions,
): string {
  let cookieName = '';
  let cookieVal = '';
  let opts = options;

  if (typeof name === 'object' && name !== null) {
    opts = name;
    cookieName = opts.name || '';
    cookieVal = opts.value || '';
  } else {
    cookieName = name || '';
    cookieVal = val || '';
  }

  let str = `${encodeURIComponent(cookieName)}=${encodeURIComponent(cookieVal)}`;
  if (opts) {
    if (opts.maxAge) str += `; Max-Age=${opts.maxAge}`;
    if (opts.domain) str += `; Domain=${opts.domain}`;
    if (opts.path) str += `; Path=${opts.path}`;
    if (opts.expires) str += `; Expires=${opts.expires.toUTCString()}`;
    if (opts.httpOnly) str += '; HttpOnly';
    if (opts.secure) str += '; Secure';
    if (opts.sameSite) {
      const sameSite =
        typeof opts.sameSite === 'string'
          ? opts.sameSite.toLowerCase()
          : opts.sameSite;
      if (sameSite === true || sameSite === 'strict') str += '; SameSite=Strict';
      else if (sameSite === 'lax') str += '; SameSite=Lax';
      else if (sameSite === 'none') str += '; SameSite=None';
    }
  }
  return str;
}

export function parseCookie(str?: string): Record<string, string> {
  const obj: Record<string, string> = {};
  if (typeof str !== 'string') return obj;
  const pairs = str.split(';');
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].trim();
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.substring(0, idx).trim();
    const value = pair.substring(idx + 1).trim();
    obj[key] = decodeURIComponent(value);
  }
  return obj;
}

export const parse = parseCookie;
export const serialize = stringifySetCookie;
export const stringifyCookie = (c: Record<string, string>): string =>
  Object.entries(c)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
