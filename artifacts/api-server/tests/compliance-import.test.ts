import { describe, it, expect } from "vitest";
import { parseCsv, parseJson, computeDiff, resolveParentCodes } from "../src/lib/compliance-import";

// --- parseCsv ---
describe("parseCsv", () => {
  it("returns RawRequirement[] with code, title, description, parentCode from valid 4-column CSV", () => {
    const csv = `code,title,description,parent_code\nCC-01,Access Control,Control access,\nCC-01.1,Sub-control,Sub description,CC-01\n`;
    const buf = Buffer.from(csv);
    const result = parseCsv(buf);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ code: "CC-01", title: "Access Control", description: "Control access" });
    expect(result[1]).toMatchObject({ code: "CC-01.1", title: "Sub-control", parentCode: "CC-01" });
  });

  it("throws descriptive error when required column code is missing", () => {
    const csv = `title,description\nAccess Control,Some description\n`;
    const buf = Buffer.from(csv);
    expect(() => parseCsv(buf)).toThrow(/code/i);
  });

  it("throws descriptive error when required column title is missing", () => {
    const csv = `code,description\nCC-01,Some description\n`;
    const buf = Buffer.from(csv);
    expect(() => parseCsv(buf)).toThrow(/title/i);
  });

  it("handles empty rows gracefully (skipEmptyLines)", () => {
    const csv = `code,title\nCC-01,Access Control\n\n\nCC-02,Audit Logging\n`;
    const buf = Buffer.from(csv);
    const result = parseCsv(buf);
    expect(result).toHaveLength(2);
  });

  it("handles BOM at start of file", () => {
    const csv = `\uFEFFcode,title\nCC-01,Access Control\n`;
    const buf = Buffer.from(csv);
    const result = parseCsv(buf);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("CC-01");
  });
});

// --- parseJson ---
describe("parseJson", () => {
  it("returns flat RawRequirement[] with parentCode resolved from nested hierarchy", () => {
    const json = JSON.stringify([
      {
        code: "CC-01",
        title: "Access Control",
        children: [
          { code: "CC-01.1", title: "Sub-control", description: "Sub desc" },
        ],
      },
    ]);
    const buf = Buffer.from(json);
    const result = parseJson(buf);
    expect(result).toHaveLength(2);
    const parent = result.find(r => r.code === "CC-01");
    const child = result.find(r => r.code === "CC-01.1");
    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    expect(child!.parentCode).toBe("CC-01");
  });

  it("throws Zod validation error when code is missing", () => {
    const json = JSON.stringify([{ title: "Access Control" }]);
    const buf = Buffer.from(json);
    expect(() => parseJson(buf)).toThrow();
  });

  it("throws Zod validation error when title is missing", () => {
    const json = JSON.stringify([{ code: "CC-01" }]);
    const buf = Buffer.from(json);
    expect(() => parseJson(buf)).toThrow();
  });
});

// --- computeDiff ---
describe("computeDiff", () => {
  it("marks all incoming as new when existing is empty", () => {
    const incoming = [
      { code: "CC-01", title: "Access Control" },
      { code: "CC-02", title: "Audit Logging" },
    ];
    const result = computeDiff([], incoming);
    expect(result.new).toHaveLength(2);
    expect(result.modified).toHaveLength(0);
    expect(result.unchanged).toHaveLength(0);
  });

  it("marks as modified when code matches but title differs", () => {
    const existing = [{ code: "CC-01", title: "Old Title" }];
    const incoming = [{ code: "CC-01", title: "New Title" }];
    const result = computeDiff(existing, incoming);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].incoming.title).toBe("New Title");
    expect(result.modified[0].existing.title).toBe("Old Title");
  });

  it("marks as modified when description differs", () => {
    const existing = [{ code: "CC-01", title: "Same Title", description: "Old desc" }];
    const incoming = [{ code: "CC-01", title: "Same Title", description: "New desc" }];
    const result = computeDiff(existing, incoming);
    expect(result.modified).toHaveLength(1);
  });

  it("marks as unchanged when code and title match", () => {
    const existing = [{ code: "CC-01", title: "Access Control" }];
    const incoming = [{ code: "CC-01", title: "Access Control" }];
    const result = computeDiff(existing, incoming);
    expect(result.unchanged).toHaveLength(1);
    expect(result.new).toHaveLength(0);
    expect(result.modified).toHaveLength(0);
  });
});

// --- resolveParentCodes ---
describe("resolveParentCodes", () => {
  it("maps parentCode to parentId UUID when present in map", () => {
    const reqs = [
      { code: "CC-01.1", title: "Sub-control", parentCode: "CC-01" },
    ];
    const map = new Map([["CC-01", "uuid-1234"]]);
    const { resolved, warnings } = resolveParentCodes(reqs, map);
    expect(resolved[0].parentId).toBe("uuid-1234");
    expect(warnings).toHaveLength(0);
  });

  it("sets parentId to null and includes warning when parentCode not in map", () => {
    const reqs = [
      { code: "CC-01.1", title: "Sub-control", parentCode: "MISSING" },
    ];
    const map = new Map<string, string>();
    const { resolved, warnings } = resolveParentCodes(reqs, map);
    expect(resolved[0].parentId).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("MISSING");
  });

  it("sets parentId to null when parentCode is not set", () => {
    const reqs = [{ code: "CC-01", title: "Access Control" }];
    const map = new Map<string, string>();
    const { resolved, warnings } = resolveParentCodes(reqs, map);
    expect(resolved[0].parentId).toBeNull();
    expect(warnings).toHaveLength(0);
  });
});
