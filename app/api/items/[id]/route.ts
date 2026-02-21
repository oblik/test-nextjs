import db, { type Item } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const existing = db
    .prepare("SELECT * FROM items WHERE id = ?")
    .get(Number(id)) as Item | undefined;
  if (!existing) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }

  db.prepare("UPDATE items SET title = ?, content = ? WHERE id = ?").run(
    title,
    content,
    Number(id)
  );

  return NextResponse.json({ id: Number(id), title, content } as Item);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = db
    .prepare("SELECT * FROM items WHERE id = ?")
    .get(Number(id)) as Item | undefined;
  if (!existing) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }

  db.prepare("DELETE FROM items WHERE id = ?").run(Number(id));

  return NextResponse.json({ success: true });
}
