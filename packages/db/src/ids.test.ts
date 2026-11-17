import { beforeEach, describe, expect, it, vi } from "vitest"

// ids.ts imports `db` from ./client.js, which opens a connection pool at import
// time. §43 forbids a live database in a unit test, so the client is replaced
// wholesale: these tests assert the SQL ids.ts ISSUES, not its effect on a
// database. The effect is asserted against a real (PGlite) database in the
// api's db suite — see apps/api/vitest.db.config.ts.
const execute = vi.fn().mockResolvedValue({ rows: [{ nextval: "1" }] })

vi.mock("./client.js", () => ({
  db: { execute: (...args: unknown[]) => execute(...args) },
  pool: { end: vi.fn() },
}))

const {
  ID_SEQUENCES,
  alignIdSequences,
  ensureIdSequences,
  formatTraineeId,
  formatTrainerId,
  nextTraineeId,
  nextTrainerId,
} = await import("./ids.js")

/** The SQL text of every statement passed to db.execute so far. */
function issuedSql(): string {
  return execute.mock.calls
    .map(([query]) => {
      const q = query as { queryChunks?: unknown[]; sql?: string }
      // Drizzle's sql`` template exposes its pieces as queryChunks; fall back
      // to a plain string so this helper survives a representation change.
      if (Array.isArray(q.queryChunks)) {
        return q.queryChunks
          .map((chunk) => {
            if (typeof chunk === "string") return chunk
            const c = chunk as { value?: unknown }
            return Array.isArray(c?.value) ? c.value.join("") : ""
          })
          .join("")
      }
      return typeof q.sql === "string" ? q.sql : JSON.stringify(query)
    })
    .join("\n")
}

beforeEach(() => {
  execute.mockClear()
  execute.mockResolvedValue({ rows: [{ nextval: "1" }] })
})

describe("formatTraineeId", () => {
  it("formats as HYTE- with five padded digits (§40)", () => {
    expect(formatTraineeId(1)).toBe("HYTE-00001")
    expect(formatTraineeId(42)).toBe("HYTE-00042")
    expect(formatTraineeId(99999)).toBe("HYTE-99999")
  })

  it("does not truncate a sequence past five digits", () => {
    // Padding is a minimum width, never a cap. Truncating would mint a
    // duplicate identifier at 100000.
    expect(formatTraineeId(100000)).toBe("HYTE-100000")
  })
})

describe("formatTrainerId", () => {
  it("formats as CRTR- with five padded digits (§40)", () => {
    expect(formatTrainerId(1)).toBe("CRTR-00001")
    expect(formatTrainerId(7)).toBe("CRTR-00007")
  })

  it("does not truncate a sequence past five digits", () => {
    expect(formatTrainerId(100000)).toBe("CRTR-100000")
  })
})

describe("the formatters round-trip with the alignment regexes", () => {
  // alignIdSequences() recovers the numeric part with '^HYTE-(\d+)$' and
  // '^CRTR-(\d+)$'. If a formatter ever emitted a shape those patterns miss,
  // alignment would silently read 0 and the next allocation would collide
  // with an existing row.
  it.each([1, 42, 99999, 100000])("HYTE round-trips for %i", (seq) => {
    const match = /^HYTE-(\d+)$/.exec(formatTraineeId(seq))
    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBe(seq)
  })

  it.each([1, 7, 99999, 100000])("CRTR round-trips for %i", (seq) => {
    const match = /^CRTR-(\d+)$/.exec(formatTrainerId(seq))
    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBe(seq)
  })
})

describe("ID_SEQUENCES", () => {
  it("declares the trainee and trainer sequences", () => {
    expect(ID_SEQUENCES).toEqual({
      trainee: "trainee_id_seq",
      trainer: "trainer_id_seq",
    })
  })

  it("declares no pack-specific sequence", () => {
    // §40 replaces V1's formatDcn/dcn_seq with a pack-defined
    // formatSubjectRef, which belongs to the packs capability (§5). A
    // claims-named sequence here would be pack vocabulary in core code.
    const text = JSON.stringify(ID_SEQUENCES).toLowerCase()
    for (const term of ["dcn", "claim", "pay", "deny"]) {
      expect(text).not.toContain(term)
    }
  })
})

describe("ensureIdSequences", () => {
  it("creates every declared sequence", async () => {
    await ensureIdSequences()
    const sql = issuedSql()
    for (const sequence of Object.values(ID_SEQUENCES)) {
      expect(sql).toContain(sequence)
    }
  })

  it("is idempotent by construction: every CREATE uses IF NOT EXISTS", async () => {
    await ensureIdSequences()
    const sql = issuedSql()
    const creates = sql.match(/CREATE SEQUENCE[^\n]*/g) ?? []
    expect(creates.length).toBe(Object.keys(ID_SEQUENCES).length)
    for (const statement of creates) {
      expect(statement).toContain("IF NOT EXISTS")
    }
  })

  it("can be called repeatedly without error", async () => {
    await ensureIdSequences()
    await ensureIdSequences()
    await expect(ensureIdSequences()).resolves.toBeUndefined()
  })

  it("aligns after creating, so an imported row cannot collide", async () => {
    await ensureIdSequences()
    const sql = issuedSql()
    expect(sql).toContain("CREATE SEQUENCE")
    expect(sql).toContain("setval")
    expect(sql.indexOf("CREATE SEQUENCE")).toBeLessThan(sql.indexOf("setval"))
  })
})

describe("alignIdSequences", () => {
  it("guards every table with to_regclass, so a schema-less database is safe", async () => {
    // This repository HAS no schema yet (§40), so every block must be skipped
    // rather than erroring on a missing table. A bare reference to a
    // non-existent table in FROM fails at parse time, which is why the guard
    // has to wrap the whole statement in a DO block.
    await alignIdSequences()
    const sql = issuedSql()
    const blocks = sql.split("DO $$").slice(1)
    expect(blocks.length).toBe(Object.keys(ID_SEQUENCES).length)
    for (const block of blocks) {
      expect(block).toContain("to_regclass")
      expect(block).toContain("IS NOT NULL")
    }
  })

  it("only ever raises a sequence, never lowers it", async () => {
    // `WHERE m > 0` is what stops an empty table resetting a live sequence to
    // 0 and reissuing identifiers that already exist.
    await alignIdSequences()
    expect(issuedSql()).toContain("m > 0")
  })

  it("references no claims table", async () => {
    await alignIdSequences()
    const sql = issuedSql().toLowerCase()
    expect(sql).toContain("trainees")
    expect(sql).toContain("trainers")
    expect(sql).not.toContain("claims")
    expect(sql).not.toContain("dcn")
  })
})

describe("nextTraineeId / nextTrainerId", () => {
  it("formats whatever the sequence returns", async () => {
    execute.mockResolvedValue({ rows: [{ nextval: "42" }] })
    await expect(nextTraineeId()).resolves.toBe("HYTE-00042")
    await expect(nextTrainerId()).resolves.toBe("CRTR-00042")
  })

  it("reads from its own sequence", async () => {
    execute.mockClear()
    await nextTraineeId()
    expect(issuedSql()).toContain("nextval")
    // The sequence name is bound as a parameter, not interpolated, so assert
    // it was passed rather than searching the SQL text for it.
    const [query] = execute.mock.calls[0] as [{ queryChunks?: unknown[] }]
    expect(JSON.stringify(query)).toContain(ID_SEQUENCES.trainee)
  })

  it("handles a sequence value arriving as a string", async () => {
    // node-postgres returns bigint-ish columns as strings; Number() is what
    // makes the padding work. A regression here yields "HYTE-NaN".
    execute.mockResolvedValue({ rows: [{ nextval: "100" }] })
    await expect(nextTraineeId()).resolves.toBe("HYTE-00100")
  })
})
