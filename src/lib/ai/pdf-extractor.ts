import Anthropic from "@anthropic-ai/sdk";
import {
  ExtractionResponseSchema,
  PdfExtractionError,
  type ExtractionResult,
} from "./types/extraction";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un expert en extraction de données depuis des relevés bancaires marocains.

Ton rôle : analyser un PDF de relevé bancaire fourni par l'utilisateur et extraire TOUTES les transactions sous forme de JSON strict.

CONTEXTE
- Les relevés viennent de banques marocaines (CIH, Attijariwafa, BMCE, BMCI, Banque Populaire, Société Générale Maroc, etc.).
- Les libellés sont principalement en français, parfois avec des termes arabes translittérés.
- Devise par défaut : MAD (dirham marocain).
- Dates au format européen DD/MM/YYYY.
- Montants avec virgule décimale et espace comme séparateur de milliers (ex : "8 000,00").

CE QUE TU EXTRAIS — pour CHAQUE ligne de transaction :
- date : date de l'opération au format ISO 8601 (YYYY-MM-DD).
- description : libellé brut tel qu'il apparaît, nettoyé des espaces multiples et des retours à la ligne, SANS autre transformation (pas de traduction, pas d'abréviation, pas de catégorisation).
- amount : montant en valeur absolue positive, en nombre décimal à 2 décimales. Jamais négatif.
- currency : code ISO 4217 ("MAD", "EUR", "USD"). "MAD" par défaut si la ligne ne spécifie rien.
- type : "EXPENSE" si débit (sortie d'argent), "INCOME" si crédit (entrée d'argent).

CE QUE TU N'INCLUS PAS
- Lignes de solde intermédiaire ou solde final (ce ne sont pas des transactions).
- Lignes purement informatives ("Total débits", "Total crédits", "Report à nouveau").
- Lignes illisibles ou ambiguës : tu les sautes silencieusement plutôt que d'inventer.

CE QUE TU NE FAIS PAS
- Tu ne catégorises pas les transactions (un autre système s'en charge en aval).
- Tu ne fusionnes pas plusieurs lignes, même si elles ont le même libellé.
- Tu ne convertis pas les devises.
- Tu n'inventes rien : si une info de metadata manque, tu mets null.

CAS PARTICULIERS DE TYPAGE
- Retrait DAB / GAB → EXPENSE (l'argent sort du compte).
- Frais bancaires, agios, commissions, tenue de compte → EXPENSE.
- Virement émis / VIR EMIS → EXPENSE. Virement reçu / VIR RECU → INCOME.
- Prélèvement (PRELEVT, PRLV, PRLVT) → EXPENSE.
- Paiement CB / PAIEMENT CARTE → EXPENSE.
- Salaire, remboursement reçu, virement entrant → INCOME.

FORMAT DE SORTIE
Tu réponds UNIQUEMENT avec un objet JSON valide de la forme exacte :

{
  "transactions": [
    { "date": "2026-03-01", "description": "VIR CIH SALAIRES MARS 2026", "amount": 8000.00, "currency": "MAD", "type": "INCOME" }
  ],
  "metadata": {
    "bank": "CIH BANK",
    "accountHolder": "YASSINE EL MANSOURI",
    "periodStart": "2026-03-01",
    "periodEnd": "2026-03-31",
    "currency": "MAD",
    "openingBalance": 1240.50,
    "closingBalance": 2343.71
  }
}

AUCUN texte avant ou après le JSON. PAS de triple backticks. PAS de commentaire. Juste le JSON brut, directement.

Si le PDF ne contient aucune transaction reconnaissable (document corrompu, vide, non-relevé bancaire), tu réponds :
{ "transactions": [], "metadata": { "bank": null, "accountHolder": null, "periodStart": null, "periodEnd": null, "currency": "MAD", "openingBalance": null, "closingBalance": null } }`;

const USER_PROMPT =
  "Voici un relevé bancaire au format PDF. Extrais toutes ses transactions au format JSON strict spécifié dans les instructions système. Aucun texte avant ou après le JSON.";

// ─── Client (lazy singleton) ──────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new PdfExtractionError(
        "INVALID_INPUT",
        "ANTHROPIC_API_KEY missing from environment"
      );
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return anthropicClient;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Extract transactions from a Moroccan bank statement PDF using Claude Sonnet 4.6.
 *
 * Uses Anthropic's native PDF document support (no external OCR).
 * The system prompt is cached (ephemeral) to reduce cost on repeated calls.
 *
 * @param pdfBuffer - Raw PDF bytes (max 10 MB).
 * @returns Validated extraction result with transactions, metadata, and usage stats.
 * @throws {PdfExtractionError} on invalid input, API failure, or parse error.
 */
export async function extractTransactionsFromPdf(
  pdfBuffer: Buffer
): Promise<ExtractionResult> {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new PdfExtractionError(
      "INVALID_INPUT",
      "PDF buffer is empty or not a Buffer"
    );
  }
  if (pdfBuffer.length > MAX_PDF_BYTES) {
    const actualMb = (pdfBuffer.length / 1024 / 1024).toFixed(2);
    const maxMb = MAX_PDF_BYTES / 1024 / 1024;
    throw new PdfExtractionError(
      "INVALID_INPUT",
      `PDF too large: ${actualMb} MB (max ${maxMb} MB)`
    );
  }
  // All PDFs start with "%PDF-"
  if (pdfBuffer.slice(0, 5).toString() !== "%PDF-") {
    throw new PdfExtractionError(
      "INVALID_INPUT",
      "File does not appear to be a valid PDF (bad magic bytes)"
    );
  }

  const client = getClient();
  const pdfBase64 = pdfBuffer.toString("base64");
  const startedAt = Date.now();

  const maxAttempts = 2;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: pdfBase64,
                },
              },
              { type: "text", text: USER_PROMPT },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new PdfExtractionError(
          "EMPTY_RESULT",
          "Claude response contained no text block"
        );
      }

      // Strip any accidental code fences the model might emit
      const cleaned = textBlock.text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(cleaned);
      } catch (jsonError) {
        throw new PdfExtractionError(
          "PARSE_ERROR",
          `Claude returned invalid JSON. First 500 chars: ${cleaned.slice(0, 500)}`,
          jsonError
        );
      }

      const validation = ExtractionResponseSchema.safeParse(parsedJson);
      if (!validation.success) {
        throw new PdfExtractionError(
          "PARSE_ERROR",
          `Claude response failed schema validation: ${validation.error.message}`,
          validation.error
        );
      }

      const usage = response.usage;
      return {
        ...validation.data,
        usage: {
          model: response.model,
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
          cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch (error) {
      lastError = error;

      // Validation and parse errors are not retryable
      if (error instanceof PdfExtractionError && error.code !== "API_ERROR") {
        throw error;
      }

      const status = (error as { status?: number }).status;
      const isRetryable = !status || status >= 500 || status === 429;

      if (!isRetryable || attempt === maxAttempts) {
        break;
      }

      // Exponential backoff: 1s then 3s
      const backoffMs = attempt === 1 ? 1000 : 3000;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw new PdfExtractionError(
    "API_ERROR",
    `PDF extraction failed after ${maxAttempts} attempts: ${
      (lastError as Error)?.message ?? "unknown error"
    }`,
    lastError
  );
}
