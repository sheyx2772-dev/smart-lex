import { type Locale, type UserRole } from "@lex/shared";

/** Har so'rovga biriktiriladigan autentifikatsiya konteksti. */
export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
}

/** Hono `c.var` tiplari. */
export interface Variables {
  locale: Locale;
  auth: AuthContext;
}

export interface JwtPayload {
  sub: string; // userId
  tid: string; // tenantId
  role: UserRole;
  exp: number;
}
