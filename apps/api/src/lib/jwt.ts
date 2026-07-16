import { type UserRole } from "@lex/shared";
import { sign, verify } from "hono/jwt";
import { type JWTPayload } from "hono/utils/jwt/types";
import { type JwtPayload } from "./context";
import { env } from "./env";

const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 soat
const ALG = "HS256";

export async function signToken(userId: string, tenantId: string, role: UserRole): Promise<string> {
  const payload: JWTPayload = {
    sub: userId,
    tid: tenantId,
    role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  return sign(payload, env.jwtSecret, ALG);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    return (await verify(token, env.jwtSecret, ALG)) as unknown as JwtPayload;
  } catch {
    return null;
  }
}
