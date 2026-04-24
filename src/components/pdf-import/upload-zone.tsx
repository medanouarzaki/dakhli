"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  onFileSelected: (file: File) => void;
};

export function UploadZone({ onFileSelected }: Props) {
  const t = useTranslations("ImportPdf");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFile(file: File) {
    setSelectedFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div
          role="button"
          tabIndex={0}
          aria-label={t("upload_prompt")}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-16 cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          ].join(" ")}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleInputChange}
          />
          <Upload
            className={[
              "h-10 w-10 transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground",
            ].join(" ")}
          />
          <div className="text-center space-y-1">
            <p className="font-medium">{t("upload_prompt")}</p>
            <p className="text-sm text-muted-foreground">{t("upload_hint")}</p>
          </div>
        </div>

        {selectedFile && (
          <div className="rounded-md border bg-muted/40 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <Button
                onClick={() => onFileSelected(selectedFile)}
                size="sm"
              >
                {t("extract_button")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
