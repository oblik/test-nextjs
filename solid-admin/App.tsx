// @ts-nocheck — IDE uses React's global JSX types; babel-preset-solid handles actual compilation
import { createResource, createSignal, For, Show } from "solid-js";
import { render } from "solid-js/web";

interface Item {
  id: number;
  title: string;
  content: string;
}

async function fetchItems(): Promise<Item[]> {
  const res = await fetch("/api/items");
  return res.json();
}

function App() {
  const [items, { refetch }] = createResource(fetchItems);
  const [title, setTitle] = createSignal("");
  const [content, setContent] = createSignal("");
  const [editingId, setEditingId] = createSignal<number | null>(null);
  const [saving, setSaving] = createSignal(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!title() || !content()) return;
    setSaving(true);

    const id = editingId();
    if (id !== null) {
      await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title(), content: content() }),
      });
    } else {
      await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title(), content: content() }),
      });
    }

    setTitle("");
    setContent("");
    setEditingId(null);
    setSaving(false);
    refetch();
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setTitle(item.title);
    setContent(item.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  async function handleDelete(id: number) {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    refetch();
  }

  return (
    <div
      style={{
        "max-width": "640px",
        margin: "0 auto",
        padding: "2rem",
        "font-family": "system-ui, sans-serif",
      }}
    >
      <div>
        <a
          href="/"
          style={{
            padding: "0.5rem 1rem",
            background: editingId() !== null ? "#f59e0b" : "#3b82f6",
            color: "white",
            border: "none",
            "border-radius": "4px",
            cursor: "pointer",
          }}
        >
          Back to Next.js
        </a>
      </div>

      <h1
        style={{
          "font-size": "1.5rem",
          "font-weight": "bold",
          "margin-bottom": "1.5rem",
        }}
      >
        Admin Panel{" "}
        <span
          style={{
            "font-size": "0.875rem",
            color: "#888",
            "font-weight": "normal",
          }}
        >
          (SolidJS)
        </span>
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{
          "margin-bottom": "2rem",
          display: "flex",
          "flex-direction": "column",
          gap: "0.5rem",
        }}
      >
        <input
          type="text"
          placeholder="Title"
          value={title()}
          onInput={(e) => setTitle(e.currentTarget.value)}
          style={{
            padding: "0.5rem",
            border: "1px solid #ccc",
            "border-radius": "4px",
          }}
        />
        <textarea
          placeholder="Content"
          value={content()}
          onInput={(e) => setContent(e.currentTarget.value)}
          rows={3}
          style={{
            padding: "0.5rem",
            border: "1px solid #ccc",
            "border-radius": "4px",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="submit"
            disabled={saving()}
            style={{
              padding: "0.5rem 1rem",
              background: editingId() !== null ? "#f59e0b" : "#3b82f6",
              color: "white",
              border: "none",
              "border-radius": "4px",
              cursor: "pointer",
            }}
          >
            {saving()
              ? "Saving..."
              : editingId() !== null
              ? "Update"
              : "Create"}
          </button>
          <Show when={editingId() !== null}>
            <button
              type="button"
              onClick={cancelEdit}
              style={{
                padding: "0.5rem 1rem",
                background: "#6b7280",
                color: "white",
                border: "none",
                "border-radius": "4px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </Show>
        </div>
      </form>

      <Show when={items.loading}>
        <p style={{ color: "#888" }}>Loading...</p>
      </Show>

      <Show when={items.error}>
        <p style={{ color: "red" }}>Failed to load items.</p>
      </Show>

      <ul
        style={{
          "list-style": "none",
          padding: "0",
          display: "flex",
          "flex-direction": "column",
          gap: "0.75rem",
        }}
      >
        <For each={items()}>
          {(item) => (
            <li
              style={{
                border: "1px solid #e5e7eb",
                "border-radius": "6px",
                padding: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  "justify-content": "space-between",
                  "align-items": "flex-start",
                }}
              >
                <div>
                  <strong>{item.title}</strong>
                  <p style={{ margin: "0.25rem 0 0", color: "#555" }}>
                    {item.content}
                  </p>
                </div>
                <div
                  style={{ display: "flex", gap: "0.5rem", "flex-shrink": "0" }}
                >
                  <button
                    onClick={() => startEdit(item)}
                    style={{
                      padding: "0.25rem 0.5rem",
                      background: "#f59e0b",
                      color: "white",
                      border: "none",
                      "border-radius": "4px",
                      cursor: "pointer",
                      "font-size": "0.75rem",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      padding: "0.25rem 0.5rem",
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      "border-radius": "4px",
                      cursor: "pointer",
                      "font-size": "0.75rem",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          )}
        </For>
      </ul>

      <Show when={!items.loading && items()?.length === 0}>
        <p
          style={{
            color: "#888",
            "text-align": "center",
            "margin-top": "1rem",
          }}
        >
          No items yet. Create one above.
        </p>
      </Show>
    </div>
  );
}

export function mount(container: HTMLElement) {
  return render(() => <App />, container);
}
