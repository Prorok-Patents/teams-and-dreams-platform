import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const filename = file.name || "uploaded_file";
    const extension = filename.split(".").pop()?.toLowerCase() || "";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    let extractedText = "";
    let pageCount = 1;

    if (extension === "pdf") {
      try {
        const pdf = await getDocumentProxy(buffer);
        pageCount = pdf.numPages;
        const result = await extractText(pdf, { mergePages: true });
        extractedText = Array.isArray(result.text) ? result.text.join("\n\n") : String(result.text || "");
      } catch (pdfErr) {
        console.error("PDF parse error:", pdfErr);
        return NextResponse.json(
          { error: `Failed to extract text from PDF: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}` },
          { status: 422 }
        );
      }
    } else {
      // Plain text formats: txt, md, csv, tsv, json
      const decoder = new TextDecoder("utf-8");
      extractedText = decoder.decode(buffer);
    }

    // Limit maximum text length to protect token context
    const MAX_CHARS = 40000;
    let truncated = false;
    if (extractedText.length > MAX_CHARS) {
      extractedText = extractedText.slice(0, MAX_CHARS) + "\n\n[... Remaining content truncated for token limits ...]";
      truncated = true;
    }

    return NextResponse.json({
      success: true,
      filename,
      extension,
      pageCount,
      characterCount: extractedText.length,
      truncated,
      text: extractedText
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Error in /api/parse-document:", err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
