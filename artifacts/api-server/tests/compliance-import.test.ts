import { describe, it, expect } from "vitest";
import {
  parseCsv,
  parseJson,
  computeDiff,
  resolveParentCodes,
  type RawRequirement,
} from "@/lib/compliance-import";

// ─── parseCsv() tests ─────────────────────────────────────────────────────────

describe("parseCsv()", () => {
  it("parses valid 4-column CSV into RawRequirement[]", () => {
    const csv = `code,title,description,parentCode\nA.1,Control Title,Control description,\nA.1.1,Sub Control,Sub description,A.1\n`;
    const result = parseCsv(Buffer.from(csv));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      code: "A.1",
      title: "Control Title",
      description: "Control description",
    });
    expect(result[1]).toMatchObject({
      code: "A.1.1",
      title: "Sub Control",
      description: "Sub description",
      parentCode: "A.1",
    });
  });

  it("throws on missing required column (code)", () => {
    const csv = `title,description,parentCode\nControl Title,Control description,\n`;
    expect(() => parseCsv(Buffer.from(csv))).toThrow(/code/i);
  });

  it("throws on missing required column (title)", () => {
    const csv = `code,description,parentCode\nA.1,Control description,\n`;
    expect(() => parseCsv(Buffer.from(csv))).toThrow(/title/i);
  });

  it("handles empty rows and BOM gracefully", () => {
    const csv = `\uFEFFcode,title,description,parentCode\nA.1,Control Title,Control description,\n\n\nA.2,Another Control,,\n`;
    const result = parseCsv(Buffer.from(csv));
    expect(result).toHaveLength(2);
    expect(result[0].code).toBe("A.1");
    expect(result[1].code).toBe("A.2");
  });

  it("handles rows with empty optional fields", () => {
    const csv = `code,title,description,parentCode\nA.1,Control Title,,\n`;
    const result = parseCsv(Buffer.from(csv));
    expect(result).toHaveLength(1);
    expect(result[0].description).toBeUndefined();
    expect(result[0].parentCode).toBeUndefined();
  });
});

// ─── parseJson() tests ────────────────────────────────────────────────────────

describe("parseJson()", () => {
  it("parses flat JSON array into RawRequirement[]", () => {
    const json = JSON.stringify([
      { code: "A.1", title: "Control Title", description: "A description" },
      { code: "A.2", title: "Another Control" },
    ]);
    const result = parseJson(Buffer.from(json));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      code: "A.1",
      title: "Control Title",
      description: "A description",
    });
    expect(result[1].code).toBe("A.2");
  });

  it("flattens nested hierarchy with parentCode", () => {
    const json = JSON.stringify([
      {
        code: "A.1",
        title: "Parent Control",
        children: [
          { code: "A.1.1", title: "Child Control 1" },
          { code: "A.1.2", title: "Child Control 2" },
        ],
      },
    ]);
    const result = parseJson(Buffer.from(json));
    expect(result.length).toBeGreaterThanOrEqual(3);
    const child = result.find((r) => r.code === "A.1.1");
    expect(child).toBeDefined();
    expect(child?.parentCode).toBe("A.1");
    const child2 = result.find((r) => r.code === "A.1.2");
    expect(child2?.parentCode).toBe("A.1");
  });

  it("throws Zod validation error on invalid schema", () => {
    const json = JSON.stringify([
      { title: "Missing code field" },
    ]);
    expect(() => parseJson(Buffer.from(json))).toThrow();
  });
});

// ─── computeDiff() tests ──────────────────────────────────────────────────────

describe("computeDiff()", () => {
  const incoming: RawRequirement[] = [
    { code: "A.1", title: "Control Title", description: "A description" },
    { code: "A.2", title: "Another Control" },
  ];

  it("marks all as new when no existing requirements", () => {
    const result = computeDiff([], incoming);
    expect(result.new).toHaveLength(incoming.length);
    expect(result.modified).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it("marks matching code+title as unchanged", () => {
    const existing = [
      { code: "A.1", title: "Control Title", description: "A description" },
    ];
    const result = computeDiff(existing, [
      { code: "A.1", title: "Control Title", description: "A description" },
    ]);
    expect(result.unchanged).toHaveLength(1);
    expect(result.unchanged[0].code).toBe("A.1");
    expect(result.new).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });

  it("marks matching code with different title as modified", () => {
    const existing = [
      { code: "A.1", title: "Old Title", description: "A description" },
    ];
    const result = computeDiff(existing, [
      { code: "A.1", title: "New Title", description: "A description" },
    ]);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].incoming.title).toBe("New Title");
    expect(result.modified[0].existing.title).toBe("Old Title");
    expect(result.new).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it("marks matching code with different description as modified", () => {
    const existing = [
      { code: "A.1", title: "Same Title", description: "Old description" },
    ];
    const result = computeDiff(existing, [
      { code: "A.1", title: "Same Title", description: "New description" },
    ]);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].existing.description).toBe("Old description");
    expect(result.modified[0].incoming.description).toBe("New description");
  });

  it("preserves existing requirements not in incoming (additive-only per D-05)", () => {
    const existing = [
      { code: "A.1", title: "Existing Control" },
      { code: "A.2", title: "Another Existing" },
    ];
    const incomingPartial = [
      { code: "A.3", title: "New Control" },
    ];
    const result = computeDiff(existing, incomingPartial);
    // A.1 and A.2 are not in incoming — they should NOT appear in any diff category
    const allCodes = [
      ...result.new.map((r) => r.code),
      ...result.modified.map((r) => r.incoming.code),
      ...result.unchanged.map((r) => r.code),
    ];
    expect(allCodes).not.toContain("A.1");
    expect(allCodes).not.toContain("A.2");
    // A.3 is new
    expect(result.new).toHaveLength(1);
    expect(result.new[0].code).toBe("A.3");
  });
});

// ─── resolveParentCodes() tests ───────────────────────────────────────────────

describe("resolveParentCodes()", () => {
  it("resolves parentCode to parentId via codeToIdMap", () => {
    const requirements: RawRequirement[] = [
      { code: "A.1.1", title: "Child Control", parentCode: "A.1" },
    ];
    const codeToIdMap = new Map<string, string>([["A.1", "uuid-parent-001"]]);
    const { resolved, warnings } = resolveParentCodes(requirements, codeToIdMap);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].parentId).toBe("uuid-parent-001");
    expect(warnings).toHaveLength(0);
  });

  it("sets parentId to null and adds warning for invalid parentCode", () => {
    const requirements: RawRequirement[] = [
      { code: "A.1.1", title: "Child Control", parentCode: "INVALID" },
    ];
    const codeToIdMap = new Map<string, string>([["A.1", "uuid-parent-001"]]);
    const { resolved, warnings } = resolveParentCodes(requirements, codeToIdMap);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].parentId).toBeNull();
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/INVALID/);
  });

  it("sets parentId to null when no parentCode specified", () => {
    const requirements: RawRequirement[] = [
      { code: "A.1", title: "Root Control" },
    ];
    const codeToIdMap = new Map<string, string>();
    const { resolved, warnings } = resolveParentCodes(requirements, codeToIdMap);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].parentId).toBeNull();
    expect(warnings).toHaveLength(0);
  });
});
