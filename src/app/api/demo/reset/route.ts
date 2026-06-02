import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { resetDemoData } from "@/lib/demo/generate";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const deleted = await resetDemoData(session.user.id);
    return NextResponse.json({ deleted }, { status: 200 });
  } catch (err) {
    console.error("[demo/reset]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
