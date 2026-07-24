const TOKEN_PREFIX = "scwi";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const source = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const input = Uint8Array.from(source).buffer;
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  return Array.from(digest).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface OneTimeToken {
  token: string;
  prefix: string;
  hash: string;
}

export async function generateInvitationToken(): Promise<OneTimeToken> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = base64Url(randomBytes);
  const lookupBytes = randomBytes.slice(0, 6);
  const lookupHex = Array.from(lookupBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const prefix = `${TOKEN_PREFIX}${lookupHex}`;
  const token = `${prefix}_${secret}`;
  return { token, prefix, hash: await sha256Hex(token) };
}

export async function inspectInvitationToken(token: string): Promise<Omit<OneTimeToken, "token">> {
  const match = /^(scwi[a-f0-9]{12})_([A-Za-z0-9_-]{40,})$/.exec(token);
  if (!match?.[1]) throw new Error("Invalid invitation token format.");
  return { prefix: match[1], hash: await sha256Hex(token) };
}
