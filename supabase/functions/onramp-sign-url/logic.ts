/** HMAC-SHA256 signature of the URL query, as MoonPay requires. */
export async function signUrl(url: string, secret: string): Promise<string> {
  const query = new URL(url).search;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(query));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${url}&signature=${encodeURIComponent(b64)}`;
}
