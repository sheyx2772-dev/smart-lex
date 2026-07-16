import { type Context } from "hono";

/** So'rovdan sahifa parametrlarini o'qiydi (xavfsiz chegaralar bilan). */
export function pageParams(c: Context): { page: number; pageSize: number; limit: number; offset: number } {
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(c.req.query("pageSize")) || 25));
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

/** Sahifalash metadatasi (frontend uchun). */
export function pageMeta(total: number, page: number, pageSize: number) {
  return { total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
