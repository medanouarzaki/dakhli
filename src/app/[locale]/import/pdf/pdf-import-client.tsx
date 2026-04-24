"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/pdf-import/upload-zone";
import { ExtractionLoading } from "@/components/pdf-import/extraction-loading";
import { TransactionReviewTable } from "@/components/pdf-import/transaction-review-table";

const MAX_PDF_BYTES = 4 * 1024 * 1024;

type State = "upload" | "loading" | "review" | "error";

type ExtractedTransaction = {
  date: string;
  description: string;
  amount: number;
  currency: "MAD" | "EUR" | "USD";
  type: "EXPENSE" | "INCOME";
};

type Metadata = {
  bank: string | null;
  accountHolder: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  openingBalance: number | null;
  closingBalance: number | null;
};

type Props = {
  accounts: Array<{ id: string; name: string; currency: string }>;
  locale: "fr" | "en" | "ar";
};

export function PdfImportClient({ accounts, locale }: Props) {
  const t = useTranslations("ImportPdf");

  const [state, setState] = useState<State>("upload");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error(t("errors.invalid_file_type"));
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error(t("errors.file_too_large"));
      return;
    }

    setState("loading");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/ai/extract-pdf", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        let message = t("errors.extraction_failed");
        try {
          const body = await res.json();
          if (body?.message) message = body.message;
        } catch {
          // use default message
        }
        setErrorMessage(message);
        setState("error");
        return;
      }

      const data = await res.json();
      setTransactions(data.transactions);
      setMetadata(data.metadata);
      setState("review");
    } catch {
      setErrorMessage(t("errors.network_error"));
      setState("error");
    }
  }

  function reset() {
    setState("upload");
    setErrorMessage(null);
    setTransactions([]);
    setMetadata(null);
  }

  return (
    <div className="space-y-6">
      {/* Persistent description card */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">{t("page_description")}</p>
        </CardContent>
      </Card>

      {state === "upload" && <UploadZone onFileSelected={handleFile} />}

      {state === "loading" && <ExtractionLoading />}

      {state === "review" && metadata && (
        <TransactionReviewTable
          transactions={transactions}
          metadata={metadata}
          accounts={accounts}
          onReset={reset}
          locale={locale}
        />
      )}

      {state === "error" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <div className="space-y-1">
                <p className="font-semibold text-destructive">
                  {t("errors.extraction_failed")}
                </p>
                {errorMessage && (
                  <p className="text-sm text-muted-foreground">{errorMessage}</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button onClick={reset}>{t("errors.retry_button")}</Button>
                <Button variant="outline" asChild>
                  <Link href={`/${locale}/transactions`}>
                    {t("errors.back_button")}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
