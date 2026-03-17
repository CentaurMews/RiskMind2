import type { Buffer } from "node:buffer";

export interface ParsedDocument {
  text: string;
  name: string;
  mimeType: string;
  wordCount: number;
  pageCount?: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function parseDocument(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<ParsedDocument> {
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType === "application/pdf" || ext === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer as unknown as Uint8Array });
    const result = await parser.getText();
    const text = result.text || "";
    return {
      text,
      name: originalName,
      mimeType,
      wordCount: countWords(text),
      pageCount: result.pages?.length,
    };
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    ext === "docx" ||
    ext === "doc"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
      name: originalName,
      mimeType,
      wordCount: countWords(result.value),
    };
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    ext === "xlsx" ||
    ext === "xls"
  ) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const texts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.trim()) {
        texts.push(`[Sheet: ${sheetName}]\n${csv}`);
      }
    }
    const text = texts.join("\n\n");
    return {
      text,
      name: originalName,
      mimeType,
      wordCount: countWords(text),
    };
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint" ||
    ext === "pptx" ||
    ext === "ppt"
  ) {
    try {
      const { parseOffice } = await import("officeparser");
      const ast = await parseOffice(buffer as unknown as Parameters<typeof parseOffice>[0]);
      const text = ast.toText ? ast.toText() : String(ast);
      return {
        text,
        name: originalName,
        mimeType,
        wordCount: countWords(text),
      };
    } catch {
      return {
        text: `[Presentation: ${originalName}] Content could not be extracted.`,
        name: originalName,
        mimeType,
        wordCount: 0,
      };
    }
  }

  if (
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/csv" ||
    ["txt", "md", "markdown", "csv"].includes(ext)
  ) {
    const text = buffer.toString("utf-8");
    return {
      text,
      name: originalName,
      mimeType,
      wordCount: countWords(text),
    };
  }

  throw new Error(`Unsupported file type: ${mimeType || ext}`);
}
