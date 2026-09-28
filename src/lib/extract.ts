import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export async function extractTextFromBuffer(buf: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value.trim();
  }
  if (ext === "pdf") {
    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    await parser.destroy();
    return result.text.trim();
  }
  throw new Error(`Unsupported file type: ${filename}. Only .pdf and .docx are supported.`);
}
