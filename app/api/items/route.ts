import db, { type Item } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const items = db
    .prepare("SELECT * FROM items ORDER BY id DESC")
    .all() as Item[];
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const { title, content } = (await request.json()) as {
    title: string;
    content: string;
  };

  if (!title || !content) {
    return NextResponse.json(
      { error: "title and content are required" },
      { status: 400 }
    );
  }

  const stmt = db.prepare("INSERT INTO items (title, content) VALUES (?, ?)");
  const result = stmt.run(title, content);

  return NextResponse.json(
    { id: result.lastInsertRowid, title, content } as Item,
    { status: 201 }
  );
}
