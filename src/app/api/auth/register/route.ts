import { NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";
import { setSessionUser } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name : undefined;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const user = await registerUser(email, password, name);
    await setSessionUser(user.id, user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    if (message.includes("Unique constraint") || message.includes("unique")) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
