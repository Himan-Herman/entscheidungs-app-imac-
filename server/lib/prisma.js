/**
 * Shared PrismaClient singleton.
 *
 * Render OOM fix: previously every route/service module created its own
 * `new PrismaClient()` (~130 instances), each loading the query engine + full
 * DMMF for the large schema into memory at startup. This module provides ONE
 * process-wide instance that every module imports instead.
 *
 * No query/behaviour change — same default client, no options (matches the
 * previous per-file `new PrismaClient()` calls). Cached on globalThis so repeated
 * imports / dev hot-reloads reuse the same instance.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__medscoutxPrisma ?? new PrismaClient();

if (!globalForPrisma.__medscoutxPrisma) {
  globalForPrisma.__medscoutxPrisma = prisma;
}

export default prisma;
