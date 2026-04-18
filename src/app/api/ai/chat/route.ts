import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildChatContext, buildChatSystemPrompt, CHAT_MODEL } from "@/lib/ai/chat";

const requestSchema = z.object({
  message: z.string().min(1).max(1000),
  locale: z.enum(["fr", "en", "ar"]).default("fr"),
});

export async function POST(request: Request) {
  // 1. Auth
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const userLocale = parsed.data.locale;

  try {
    // 3. Save user message to DB
    await prisma.chatMessage.create({
      data: {
        userId,
        role: "USER",
        locale: userLocale,
        content: parsed.data.message,
      },
    });

    // 4. Load chat history for this locale only (last 20 messages)
    const history = await prisma.chatMessage.findMany({
      where: { userId, locale: userLocale },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: { role: true, content: true },
    });

    // Anthropic API requires strict user/assistant alternation.
    // Merge consecutive same-role messages to avoid 400 errors.
    const mergedHistory: { role: "USER" | "ASSISTANT"; content: string }[] = [];
    for (const msg of history) {
      const last = mergedHistory[mergedHistory.length - 1];
      if (last && last.role === msg.role) {
        last.content += "\n" + msg.content;
      } else {
        mergedHistory.push({ role: msg.role as "USER" | "ASSISTANT", content: msg.content });
      }
    }

    // 5. Build financial context + system prompt
    const context = await buildChatContext(prisma, userId, userLocale);
    const systemPrompt = buildChatSystemPrompt(context, userLocale);

    // 6. Call Claude with streaming
    const client = new Anthropic();

    const stream = client.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: mergedHistory.map((msg) => ({
        role: msg.role === "USER" ? "user" as const : "assistant" as const,
        content: msg.content,
      })),
    });

    // 7. Stream response using ReadableStream
    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const chunk = event.delta.text;
              fullResponse += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
              );
            }
          }

          // Get final message for token usage
          const finalMessage = await stream.finalMessage();

          // 8. Save assistant response to DB
          await prisma.chatMessage.create({
            data: {
              userId,
              role: "ASSISTANT",
              locale: userLocale,
              content: fullResponse,
              tokensIn: finalMessage.usage.input_tokens,
              tokensOut: finalMessage.usage.output_tokens,
              model: CHAT_MODEL,
            },
          });

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );
          controller.close();
        } catch {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "stream_error" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
