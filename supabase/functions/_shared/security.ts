import { AppError } from "./errors.ts";

export function requireBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  if (!match?.[1]) {
    throw new AppError(401, "unauthorized", "Authentication is required.");
  }
  return match[1];
}

export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

export function requireInternalToken(request: Request, expectedToken: string): void {
  const suppliedToken = request.headers.get("x-internal-token") ?? "";
  if (expectedToken.length < 32 || !constantTimeEqual(expectedToken, suppliedToken)) {
    throw new AppError(401, "unauthorized", "Internal authentication failed.");
  }
}
