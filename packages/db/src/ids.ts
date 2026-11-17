/**
 * Formatted identifiers, backed by raw Postgres sequences.
 *
 * docs/SPEC.md §40: "IDs — always use helpers in @platform/db ids.ts backed by
 * raw sequences (ensureIdSequences())". Never construct a formatted identifier
 * by hand: the format and the sequence that guarantees its uniqueness are one
 * fact, and splitting them produces duplicates that only appear under
 * concurrency.
 *
 * drizzle-kit does not manage raw sequences, so they are created in code by
 * ensureIdSequences() (CREATE SEQUENCE IF NOT EXISTS) on every seed and boot.
 *
 * NOT CARRIED FROM V1. V1's copy also holds formatDcn(), a `dcn_seq` sequence
 * and a `claims`-table branch in alignIdSequences(). All three are claims
 * vocabulary, which §Non-negotiables bars from core code. §40 replaces
 * formatDcn with formatSubjectRef, whose prefix is *pack-defined* (the Claims
 * pack keeps DCN-######), so it belongs to the packs capability (§5), not here.
 *
 * Still to come, and deliberately absent until the change that issues them:
 *   formatPassportNumber   PSPT-######   §27, §40 — proposed, confirm §45.3
 *   formatCredentialNumber CERT-######   §28, §40 — proposed, confirm §45.3
 */
import { sql } from "drizzle-orm"
import { db } from "./client.js"

// ── Pure formatters (no DB access) ───────────────────────

const pad5 = (n: number): string => n.toString().padStart(5, "0")

/** A trainee's public identifier, e.g. `HYTE-00042`. §40 [v1] */
export function formatTraineeId(seq: number): string {
  return `HYTE-${pad5(seq)}`
}

/** A trainer's public identifier, e.g. `CRTR-00007`. §40 [v1] */
export function formatTrainerId(seq: number): string {
  return `CRTR-${pad5(seq)}`
}

// ── PG sequence allocation ───────────────────────────────

export const ID_SEQUENCES = {
  trainee: "trainee_id_seq",
  trainer: "trainer_id_seq",
} as const

/**
 * Create every sequence if absent, then align it to the rows already present.
 * Idempotent by construction (IF NOT EXISTS + a GREATEST-style setval), so it
 * is safe to call on every seed and every boot.
 */
export async function ensureIdSequences(): Promise<void> {
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS trainee_id_seq START 1`)
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS trainer_id_seq START 1`)
  await alignIdSequences()
}

/**
 * Self-heal each sequence to the highest canonical identifier already in its
 * table, so rows inserted with explicit IDs (seed, restore, the §46 v1 import)
 * cannot collide with the next allocation. An empty table leaves the sequence
 * at its CREATE-time start value.
 *
 * Each block is guarded by `to_regclass` so a missing table — a fresh database,
 * before any migration has created the schema — is skipped rather than
 * erroring. The guard must wrap the WHOLE statement inside a DO block:
 * referencing a non-existent table directly in FROM fails at parse time, before
 * any runtime condition could skip it. That matters immediately here, because
 * this repository has no schema yet (see ./schema.ts) and these tables do not
 * exist.
 */
export async function alignIdSequences(): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      IF to_regclass('public.trainees') IS NOT NULL THEN
        PERFORM setval('trainee_id_seq', m, true)
        FROM (
          SELECT COALESCE(MAX(substring(trainee_id from '^HYTE-(\\d+)$')::bigint), 0) AS m
          FROM trainees
        ) s
        WHERE m > 0;
      END IF;
    END $$;
  `)
  await db.execute(sql`
    DO $$
    BEGIN
      IF to_regclass('public.trainers') IS NOT NULL THEN
        PERFORM setval('trainer_id_seq', m, true)
        FROM (
          SELECT COALESCE(MAX(substring(trainer_id from '^CRTR-(\\d+)$')::bigint), 0) AS m
          FROM trainers
        ) s
        WHERE m > 0;
      END IF;
    END $$;
  `)
}

/** Read one value from a sequence. */
async function nextval(sequence: string): Promise<number> {
  const result = await db.execute<{ nextval: string }>(
    sql`SELECT nextval(${sequence}) AS nextval`
  )
  const rows = (result as unknown as { rows: { nextval: string }[] }).rows
  return Number(rows[0].nextval)
}

/** Allocate the next trainee identifier. */
export async function nextTraineeId(): Promise<string> {
  return formatTraineeId(await nextval(ID_SEQUENCES.trainee))
}

/** Allocate the next trainer identifier. */
export async function nextTrainerId(): Promise<string> {
  return formatTrainerId(await nextval(ID_SEQUENCES.trainer))
}
