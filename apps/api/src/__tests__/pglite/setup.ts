// Per-file database for the DB-backed api suites (vitest.db.config.ts). Listed
// BEFORE ../setup.ts in setupFiles, so by the time that file and the test file
// are evaluated TEST_DATABASE_URL already points here and `hasTestDb()` is
// true.
//
// Each test file runs in a fresh fork. This boots that fork's own PGlite from
// the migrated snapshot ./global-setup.ts saved, and serves it on a free
// loopback port over the Postgres wire protocol (pglite-socket), so the app's
// ordinary pg.Pool connects to it exactly as it would to any Postgres. That is
// the point of going through a socket rather than using PGlite's driver
// directly: the code under test is unmodified, with no test-only database
// client.
//
// NOT CARRIED FROM V1: V1 additionally starts an HTTP server here to serve
// Better Auth's JWKS route, because its lib/jwt.ts verifies access tokens
// against it and supertest never listens. This repository has no
// authentication yet (§7 adds it), so there is nothing to serve and the
// complexity would be unused. The change that ports auth adds it back.
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, inject } from "vitest"

const snapshot = inject("pgliteSnapshot")

let pglite: PGlite | undefined
let socket: PGLiteSocketServer | undefined

if (snapshot) {
  pglite = await PGlite.create({
    loadDataDir: new Blob([await readFile(snapshot)]),
  })
  // The app's pool opens up to DB_POOL_MAX (10) connections. pglite-socket
  // multiplexes them onto PGlite's single session, a query at a time.
  socket = new PGLiteSocketServer({
    db: pglite,
    host: "127.0.0.1",
    port: 0,
    maxConnections: 20,
  })
  await socket.start()
  process.env.TEST_DATABASE_URL = `postgres://postgres:postgres@${socket.getServerConn()}/postgres?sslmode=disable`
}

// `after` hooks run in reverse registration order, and this file is loaded
// before ../setup.ts — so this runs LAST, after anything that file tears down.
// Closing the socket before the app's pool has finished would surface as a
// connection error during teardown rather than a clean exit.
afterAll(async () => {
  await socket?.stop()
  await pglite?.close()
})
