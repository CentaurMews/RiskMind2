import Papa from "papaparse";
import { z } from "zod/v4";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface RawRequirement {
  code: string;
  title: string;
  description?: string;
  parentCode?: string;
}

export interface DiffResult {
  new: RawRequirement[];
  modified: {
    incoming: RawRequirement;
    existing: { code: string; title: string; description?: string };
  }[];
  unchanged: RawRequirement[];
  warnings: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// CSV Parser
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Parse a CSV buffer into an array of RawRequirement objects.
 * Expects columns: code, title, and optionally description and parent_code.
 * Throws a descriptive error if required columns are missing.
 */
export function parseCsv(fileBuffer: Buffer): RawRequirement[] {
  const csvText = fileBuffer.toString("utf-8").replace(/^\uFEFF/, ""); // strip BOM

  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  if (result.errors.length > 0) {
    const msgs = result.errors.map((e: { message: string }) => e.message).join("; ");
    throw new Error(`CSV parse error: ${msgs}`);
  }

  const rows = result.data;
  if (rows.length === 0) return [];

  const firstRow = rows[0];
  if (!("code" in firstRow)) {
    throw new Error(
      'CSV missing required column "code". Found columns: ' +
        Object.keys(firstRow).join(", "),
    );
  }
  if (!("title" in firstRow)) {
    throw new Error(
      'CSV missing required column "title". Found columns: ' +
        Object.keys(firstRow).join(", "),
    );
  }

  const requirements: RawRequirement[] = [];
  for (const row of rows) {
    const code = (row["code"] ?? "").trim();
    const title = (row["title"] ?? "").trim();

    if (!code || !title) continue; // skip rows where required fields are empty

    const req: RawRequirement = { code, title };
    const desc = (row["description"] ?? "").trim();
    if (desc) req.description = desc;
    const parentCode = (row["parent_code"] ?? "").trim();
    if (parentCode) req.parentCode = parentCode;

    requirements.push(req);
  }

  return requirements;
}

// ──────────────────────────────────────────────────────────────────────────────
// JSON Parser (nested hierarchy → flat list)
// ──────────────────────────────────────────────────────────────────────────────

const jsonNodeSchema: z.ZodType<{
  code: string;
  title: string;
  description?: string;
  parentCode?: string;
  children?: unknown[];
}> = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  parentCode: z.string().optional(),
  children: z.array(z.unknown()).optional(),
});

const jsonInputSchema = z.array(jsonNodeSchema);

function flattenNode(
  node: z.infer<typeof jsonNodeSchema>,
  parentCode?: string,
): RawRequirement[] {
  const req: RawRequirement = {
    code: node.code,
    title: node.title,
  };
  if (node.description) req.description = node.description;
  if (parentCode) req.parentCode = parentCode;

  const results: RawRequirement[] = [req];

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const parsed = jsonNodeSchema.parse(child);
      results.push(...flattenNode(parsed, node.code));
    }
  }

  return results;
}

/**
 * Parse a JSON buffer (array of potentially nested requirement nodes) into a
 * flat array of RawRequirement objects with parentCode set from hierarchy.
 * Throws a Zod validation error if the schema is invalid.
 */
export function parseJson(fileBuffer: Buffer): RawRequirement[] {
  const text = fileBuffer.toString("utf-8");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON parse error: ${(err as Error).message}`);
  }

  const nodes = jsonInputSchema.parse(raw);
  const results: RawRequirement[] = [];
  for (const node of nodes) {
    results.push(...flattenNode(node));
  }
  return results;
}

// ──────────────────────────────────────────────────────────────────────────────
// Diff computation (additive-only)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Compute a diff between existing DB requirements and an incoming set.
 * Additive-only: no "deleted" category — existing requirements not in
 * incoming are simply ignored.
 */
export function computeDiff(
  existing: { code: string; title: string; description?: string }[],
  incoming: RawRequirement[],
): DiffResult {
  const existingMap = new Map(existing.map((e) => [e.code, e]));
  const result: DiffResult = {
    new: [],
    modified: [],
    unchanged: [],
    warnings: [],
  };

  for (const req of incoming) {
    const existing = existingMap.get(req.code);
    if (!existing) {
      result.new.push(req);
    } else if (
      existing.title !== req.title ||
      (existing.description ?? "") !== (req.description ?? "")
    ) {
      result.modified.push({ incoming: req, existing });
    } else {
      result.unchanged.push(req);
    }
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Parent code resolution
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Resolve parentCode strings to parentId UUIDs using a pre-built code-to-id
 * lookup map (built after requirements are inserted into the DB).
 * Unresolvable parentCodes produce warnings and null parentId.
 */
export function resolveParentCodes(
  requirements: RawRequirement[],
  codeToIdMap: Map<string, string>,
): {
  resolved: {
    code: string;
    title: string;
    description?: string;
    parentId: string | null;
  }[];
  warnings: string[];
} {
  const resolved: {
    code: string;
    title: string;
    description?: string;
    parentId: string | null;
  }[] = [];
  const warnings: string[] = [];

  for (const req of requirements) {
    let parentId: string | null = null;
    if (req.parentCode) {
      const id = codeToIdMap.get(req.parentCode);
      if (id) {
        parentId = id;
      } else {
        warnings.push(
          `Could not resolve parentCode "${req.parentCode}" for requirement "${req.code}" — no matching code found`,
        );
      }
    }

    const entry: {
      code: string;
      title: string;
      description?: string;
      parentId: string | null;
    } = { code: req.code, title: req.title, parentId };
    if (req.description) entry.description = req.description;
    resolved.push(entry);
  }

  return { resolved, warnings };
}
