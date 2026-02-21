import db, { type Item } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  const items = db
    .prepare("SELECT * FROM items ORDER BY id DESC")
    .all() as Item[];

  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
          Items{" "}
          <span
            style={{
              fontSize: "0.875rem",
              color: "#888",
              fontWeight: "normal",
            }}
          >
            (React Server Component)
          </span>
        </h1>
        <Link
          href="/admin"
          style={{
            padding: "0.5rem 1rem",
            background: "#3b82f6",
            color: "white",
            borderRadius: "4px",
            textDecoration: "none",
            fontSize: "0.875rem",
          }}
        >
          Open Admin
        </Link>
      </div>

      {items.length === 0 ? (
        <p style={{ color: "#888", textAlign: "center" }}>
          No items yet.{" "}
          <Link href="/admin" style={{ color: "#3b82f6" }}>
            Create some in the admin panel.
          </Link>
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                padding: "1rem",
              }}
            >
              <strong>{item.title}</strong>
              <p style={{ margin: "0.25rem 0 0", color: "#555" }}>
                {item.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
