import { z } from "zod"

/**
 * The model layer: the shape of the data and nothing else.
 *
 * No React and no fetch here (§39). Parsing lives with the schema so a
 * malformed response fails at one boundary with a useful message, rather than
 * surfacing as `undefined` three layers later in a view.
 */
export const healthSchema = z.object({
  status: z.string(),
  build: z.string(),
  buildTime: z.string(),
  uptimeSeconds: z.number(),
})

export type Health = z.infer<typeof healthSchema>
