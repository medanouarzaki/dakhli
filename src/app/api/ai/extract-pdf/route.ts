import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractTransactionsFromPdf } from "@/lib/ai/pdf-extractor";
import { PdfExtractionError } from "@/lib/ai/types/extraction";

// ─── Schema field mapping (pre-check divergences) ────────────────────────────
//
// AiInsight fields vs. what the prompt assumed:
//   Assumed "kind"     → actual field is "type" (InsightType enum: ANOMALY | FORECAST | ADVICE | SAVINGS_PLAN)
//                        PDF_EXTRACTION is not a valid enum value, so we use "ADVICE" as a proxy.
//   Assumed "tokensIn" → does NOT exist on AiInsight (only on ChatMessage).
//   Assumed "tokensOut"→ does NOT exist on AiInsight (only on ChatMessage).
//   "title"            → required String (not assumed, must be provided).
//   "content"          → required String @db.Text (not assumed, must be provided).
//   "model"            → exists as String? — used as intended.
//   "payload"          → exists as Json? — token counts folded in here.

// ─── Route config ─────────────────────────────────────────────────────────────

// Node.js runtime is required (Buffer API + Anthropic SDK are not Edge-compatible).
export const runtime = "nodejs";

// Sonnet 4.6 on a 2-page PDF takes 15-25s. Give ourselves a generous ceiling.
export const maxDuration = 120;

// ─── Constants ────────────────────────────────────────────────────────────────

// Vercel Hobby plan caps serverless function payloads at 4.5 MB.
// We accept slightly less to leave room for multipart boundaries and headers.
const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB
const ACCEPTED_MIME_TYPES = ["application/pdf"];

// ─── Error helpers ────────────────────────────────────────────────────────────

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_FORM_DATA"
  | "MISSING_FILE"
  | "INVALID_FILE_TYPE"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "EXTRACTION_FAILED"
  | "EXTRACTION_PARSE_ERROR"
  | "EXTRACTION_TIMEOUT"
  | "INTERNAL_ERROR";

function errorResponse(
  code: ApiErrorCode,
  status: number,
  message?: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { error: code, ...(message ? { message } : {}), ...(extra ?? {}) },
    { status }
  );
}

// ─── POST handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/ai/extract-pdf
 *
 * Accepts a multipart/form-data upload with a single "file" field containing a PDF
 * bank statement. Returns the extracted transactions and metadata without persisting
 * anything to the database (persistence happens in a later endpoint).
 *
 * Contract:
 *   Request:  multipart/form-data with field "file" = PDF (application/pdf, ≤ 4 MB)
 *   Response: 200 { transactions, metadata, usage }
 *             401 { error: "UNAUTHORIZED" }
 *             400 { error: "MISSING_FILE" | "INVALID_FILE_TYPE" | "EMPTY_FILE" | ... }
 *             413 { error: "FILE_TOO_LARGE", maxBytes }
 *             502 { error: "EXTRACTION_FAILED" | "EXTRACTION_PARSE_ERROR", message }
 *             504 { error: "EXTRACTION_TIMEOUT" }
 *             500 { error: "INTERNAL_ERROR" }
 */
export async function POST(request: Request) {
  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", 401);
  }
  const userId = session.user.id;

  // 2. Parse multipart form-data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (parseError) {
    console.error("[extract-pdf] form-data parse failed:", parseError);
    return errorResponse("INVALID_FORM_DATA", 400);
  }

  // 3. Validate file presence
  const fileField = formData.get("file");
  if (!(fileField instanceof File)) {
    return errorResponse("MISSING_FILE", 400);
  }
  const file = fileField;

  // 4. Validate MIME type
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return errorResponse("INVALID_FILE_TYPE", 400, undefined, {
      received: file.type || "(empty)",
      accepted: ACCEPTED_MIME_TYPES,
    });
  }

  // 5. Validate size
  if (file.size === 0) {
    return errorResponse("EMPTY_FILE", 400);
  }
  if (file.size > MAX_PDF_BYTES) {
    return errorResponse("FILE_TOO_LARGE", 413, undefined, {
      maxBytes: MAX_PDF_BYTES,
      receivedBytes: file.size,
    });
  }

  // 6. Read into Buffer
  const arrayBuffer = await file.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  // 7. Extract via service
  try {
    const result = await extractTransactionsFromPdf(pdfBuffer);

    // 8. Log usage for audit / cost tracking (best-effort, non-blocking if it fails).
    // AiInsight.type must be a valid InsightType enum value; "ADVICE" is used as a
    // proxy since the schema predates the PDF extraction feature.
    // Token counts are stored in payload because AiInsight has no tokensIn/tokensOut fields.
    try {
      await prisma.aiInsight.create({
        data: {
          userId,
          type: "ADVICE",
          title: "PDF_EXTRACTION",
          content: `Extracted ${result.transactions.length} transactions from ${file.name}`,
          model: result.usage.model,
          payload: {
            filename: file.name,
            fileSize: file.size,
            transactionsCount: result.transactions.length,
            bank: result.metadata.bank,
            latencyMs: result.usage.latencyMs,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            cacheReadTokens: result.usage.cacheReadTokens,
            cacheCreationTokens: result.usage.cacheCreationTokens,
          },
        },
      });
    } catch (insightError) {
      // Logging failure should NOT break the user response
      console.error("[extract-pdf] AiInsight logging failed:", insightError);
    }

    // 9. Return result
    return NextResponse.json({
      transactions: result.transactions,
      metadata: result.metadata,
      usage: {
        model: result.usage.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheCreationTokens: result.usage.cacheCreationTokens,
        latencyMs: result.usage.latencyMs,
      },
    });
  } catch (error) {
    console.error("[extract-pdf] extraction failed:", error);

    if (error instanceof PdfExtractionError) {
      switch (error.code) {
        case "INVALID_INPUT":
          return errorResponse("INVALID_FILE_TYPE", 400, error.message);
        case "PARSE_ERROR":
        case "EMPTY_RESULT":
          return errorResponse("EXTRACTION_PARSE_ERROR", 502, error.message);
        case "TIMEOUT":
          return errorResponse("EXTRACTION_TIMEOUT", 504, error.message);
        case "API_ERROR":
        default:
          return errorResponse("EXTRACTION_FAILED", 502, error.message);
      }
    }

    return errorResponse("INTERNAL_ERROR", 500);
  }
}
