import { PrismaClient } from '@prisma/client'

/**
 * Global Singleton PrismaClient.
 *
 * Disimpan di globalThis di SEMUA environment (bukan hanya dev):
 *   - Vercel serverless: instance function hang (warm) memakai ulang
 *     PrismaClient + connection pool yang sama antar invocation → tidak
 *     re-connect / tidak menambah latency tiap request.
 *   - Dev: melindungi dari HMR yang membuat module baru tiap reload.
 *
 * `log: ['query']` hanya di development — di production logging tiap query
 * menambah overhead serialisasi pada jalur panas (hot path).
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error'],
  })

globalForPrisma.prisma = db
