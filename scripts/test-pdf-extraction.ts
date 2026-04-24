/**
 * Standalone test script for the PDF extraction service.
 * Usage:
 *   npx tsx scripts/test-pdf-extraction.ts <path-to-pdf>
 *
 * Example:
 *   npx tsx scripts/test-pdf-extraction.ts docs/test-fixtures/releve_cih_yassine_mars_2026.pdf
 */
import fs from "fs";
import path from "path";
import { extractTransactionsFromPdf } from "../src/lib/ai/pdf-extractor";

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error("❌ Usage: npx tsx scripts/test-pdf-extraction.ts <path-to-pdf>");
    process.exit(1);
  }

  const absPath = path.resolve(pdfPath);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ File not found: ${absPath}`);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(absPath);
  console.log(`📄 PDF: ${absPath}`);
  console.log(`📦 Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`🤖 Calling Claude Sonnet 4.6...`);

  try {
    const result = await extractTransactionsFromPdf(pdfBuffer);

    console.log(
      `\n✅ Extracted ${result.transactions.length} transactions in ${result.usage.latencyMs}ms\n`
    );

    console.log(`📊 Metadata:`);
    console.log(`   Bank:     ${result.metadata.bank ?? "(unknown)"}`);
    console.log(`   Holder:   ${result.metadata.accountHolder ?? "(unknown)"}`);
    console.log(
      `   Period:   ${result.metadata.periodStart ?? "?"} → ${result.metadata.periodEnd ?? "?"}`
    );
    console.log(`   Currency: ${result.metadata.currency}`);
    console.log(`   Opening:  ${result.metadata.openingBalance}`);
    console.log(`   Closing:  ${result.metadata.closingBalance}`);

    console.log(`\n💰 Token usage:`);
    console.log(`   Model:           ${result.usage.model}`);
    console.log(`   Input:           ${result.usage.inputTokens}`);
    console.log(`   Output:          ${result.usage.outputTokens}`);
    console.log(`   Cache read:      ${result.usage.cacheReadTokens}`);
    console.log(`   Cache creation:  ${result.usage.cacheCreationTokens}`);

    // Sonnet 4.6 pricing (verify on anthropic.com/pricing)
    // Input: $3/Mtok, Output: $15/Mtok, Cache read: $0.30/Mtok, Cache write: $3.75/Mtok
    const costUsd =
      (result.usage.inputTokens * 3) / 1_000_000 +
      (result.usage.outputTokens * 15) / 1_000_000 +
      (result.usage.cacheReadTokens * 0.3) / 1_000_000 +
      (result.usage.cacheCreationTokens * 3.75) / 1_000_000;
    console.log(`   Est. cost USD:   $${costUsd.toFixed(4)}`);
    console.log(`   Est. cost MAD:   ≈ ${(costUsd * 10).toFixed(4)} MAD`);

    console.log(`\n📋 First 5 transactions:`);
    console.log(JSON.stringify(result.transactions.slice(0, 5), null, 2));

    if (result.transactions.length > 5) {
      console.log(`\n📋 Last 2 transactions:`);
      console.log(JSON.stringify(result.transactions.slice(-2), null, 2));
    }

    console.log(`\n🧮 Sanity checks:`);
    const totalDebits = result.transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = result.transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0);

    console.log(`   Total EXPENSE sum: ${totalDebits.toFixed(2)}`);
    console.log(`   Total INCOME sum:  ${totalCredits.toFixed(2)}`);

    if (
      result.metadata.openingBalance !== null &&
      result.metadata.closingBalance !== null
    ) {
      const computed =
        result.metadata.openingBalance + totalCredits - totalDebits;
      const diff = Math.abs(computed - result.metadata.closingBalance);
      const ok = diff < 0.01;
      console.log(
        `   Balance computed:  ${computed.toFixed(2)} vs extracted closing ${result.metadata.closingBalance} → écart ${diff.toFixed(2)} ${ok ? "✅" : "⚠️"}`
      );
    }
  } catch (error) {
    console.error(`\n❌ Extraction failed:`);
    if (error instanceof Error) {
      const code = (error as { code?: string }).code;
      console.error(`   [${code ?? "ERROR"}] ${error.message}`);
      if ((error as { cause?: unknown }).cause) {
        console.error(`   Cause:`, (error as { cause?: unknown }).cause);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
