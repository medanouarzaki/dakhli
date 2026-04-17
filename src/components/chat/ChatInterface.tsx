"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
};

type Props = {
  initialMessages: ChatMessage[];
  locale: string;
  suggestions: string[];
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatInterface({ initialMessages, suggestions }: Props) {
  const t = useTranslations("Chat");

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom whenever messages update (covers streaming chunks too)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  const resetTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    resetTextarea();
    setIsStreaming(true);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "USER",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const assistantId = `assistant-${Date.now()}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: "ASSISTANT",
      content: "",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok || !res.body) {
        toast.error(t("error"));
        setIsStreaming(false);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          try {
            const parsed = JSON.parse(json) as {
              text?: string;
              done?: boolean;
              error?: string;
            };

            if (parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.text }
                    : m
                )
              );
            }

            if (parsed.done) {
              setIsStreaming(false);
            }

            if (parsed.error) {
              toast.error(t("error"));
              setIsStreaming(false);
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    } catch {
      toast.error(t("error"));
      setIsStreaming(false);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Messages ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-12">
            <div>
              <h2 className="text-xl font-semibold">{t("empty.title")}</h2>
              <p className="mt-1 text-muted-foreground">{t("empty.subtitle")}</p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="rounded-lg border px-4 py-2 text-sm text-left hover:bg-accent transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "USER" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] px-4 py-2.5 text-sm whitespace-pre-wrap break-words",
                  msg.role === "USER"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                    : "bg-muted rounded-2xl rounded-bl-sm"
                )}
              >
                {msg.content === "" && msg.role === "ASSISTANT" ? (
                  <span className="italic text-muted-foreground">
                    {t("thinking")}
                  </span>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ────────────────────────────────────────────────── */}
      <div className="border-t p-4 flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustTextareaHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 overflow-hidden"
          style={{ maxHeight: "120px" }}
        />
        <Button
          onClick={() => sendMessage(input)}
          disabled={isStreaming || !input.trim()}
          size="sm"
          className="shrink-0"
        >
          <Send size={16} />
          <span className="sr-only">{t("send")}</span>
        </Button>
      </div>
    </div>
  );
}
