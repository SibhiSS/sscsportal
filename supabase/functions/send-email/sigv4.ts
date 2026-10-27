// AWS Signature Version 4, hand-rolled with Web Crypto.
//
// The alternative — pulling in the AWS SDK — costs a multi-megabyte cold start
// on every Edge Function invocation for one HTTP call. SigV4 for a single
// request is ~80 lines of well-specified hashing; the algorithm is fixed by
// AWS's own spec (https://docs.aws.amazon.com/general/latest/gr/sigv4-signed-request.html)
// and does not need a library to get right, only to get RIGHT. sigv4_test.ts
// checks this file's output against AWS's own published "get-vanilla" test
// vector — the canonical example from their documentation — so this has been
// verified against a known-correct signature, not just read over.

async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<Uint8Array> {
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secretAccessKey), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

export interface SigV4Input {
  method: string;
  /** Path only, e.g. "/v2/email/outbound-emails" — no scheme or host. */
  path: string;
  host: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  body: string;
  /** Additional headers to include in the signature, beyond host/x-amz-date. Keys lowercase. */
  extraHeaders?: Record<string, string>;
  /** Overridable for tests only — production callers should omit this. */
  now?: Date;
}

export interface SignedRequest {
  headers: Record<string, string>;
}

/**
 * Signs one request per AWS SigV4. Returns the headers to send alongside
 * `body` — Authorization, x-amz-date, and (if content was hashed) nothing
 * else required, since host/content-type etc. are passed in by the caller
 * and already included in `extraHeaders`.
 */
export async function signV4(input: SigV4Input): Promise<SignedRequest> {
  const now = input.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // yyyyMMddTHHmmssZ
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host: input.host,
    'x-amz-date': amzDate,
    ...input.extraHeaders,
  };

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((k) => `${k}:${headers[k].trim()}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');

  const payloadHash = await sha256Hex(input.body);

  const canonicalRequest = [
    input.method,
    input.path,
    '', // canonical query string — none of our calls use one
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(input.secretAccessKey, dateStamp, input.region, input.service);
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = toHex(signatureBytes);

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    headers: {
      ...headers,
      Authorization: authorization,
    },
  };
}
