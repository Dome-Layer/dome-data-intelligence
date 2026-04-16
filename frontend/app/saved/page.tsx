"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listSavedDashboards, deleteSavedDashboard, type SavedDashboard } from "@/lib/api";
import AuthGuard from "@/components/AuthGuard";

function DashboardRow({
  item,
  onDelete,
}: {
  item: SavedDashboard;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteSavedDashboard(item.id);
      onDelete(item.id);
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const savedAt = new Date(item.saved_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "16px",
      padding: "16px",
      borderBottom: "0.5px solid var(--color-border-subtle)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {item.label && (
          <p style={{ fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)", marginBottom: "2px" }}>
            {item.label}
          </p>
        )}
        <p style={{
          fontSize: "var(--text-body-sm)",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          marginBottom: "4px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {item.filename}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
            {item.column_count} columns
          </span>
          <span style={{ fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>·</span>
          <span style={{ fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
            {item.chart_count} charts
          </span>
          <span style={{ fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>·</span>
          <span style={{ fontSize: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
            {savedAt}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <Link
          href={`/dashboard/${item.session_id}`}
          className="btn btn-neutral"
          style={{ padding: "6px 12px", fontSize: "var(--text-caption)" }}
        >
          View
        </Link>

        {confirmDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn btn-primary"
              style={{ padding: "6px 12px", fontSize: "var(--text-caption)" }}
            >
              {deleting ? "Deleting…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="btn btn-neutral"
              style={{ padding: "6px 12px", fontSize: "var(--text-caption)" }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={handleDelete}
            className="btn btn-neutral"
            style={{ padding: "6px 12px", fontSize: "var(--text-caption)" }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function SavedPage() {
  const [items, setItems] = useState<SavedDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSavedDashboards()
      .then((res) => {
        setItems(res.dashboards);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load saved dashboards.");
        setLoading(false);
      });
  }, [isAuthenticated]);

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <AuthGuard>
    <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "48px 32px" }}>
      <div style={{ marginBottom: "32px" }}>
        <p className="eyebrow" style={{ marginBottom: "8px" }}>Library</p>
        <h1 style={{
          fontSize: "var(--text-h2)",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          margin: 0,
        }}>
          Saved dashboards
        </h1>
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "48px 0" }}>
          <span className="spinner" />
          <span className="eyebrow">Loading</span>
        </div>
      )}

      {error && (
        <div style={{
          background: "var(--color-error-subtle)",
          border: "0.5px solid var(--color-error-border)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
        }}>
          <p className="eyebrow" style={{ color: "var(--color-error)", marginBottom: "4px" }}>Error</p>
          <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-text-secondary)" }}>{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{
          background: "var(--color-bg-muted)",
          border: "0.5px solid var(--color-border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "48px 32px",
          textAlign: "center",
        }}>
          <p style={{ fontSize: "var(--text-body-sm)", color: "var(--color-text-secondary)", marginBottom: "16px" }}>
            No saved dashboards yet. Upload a file and save your dashboard to see it here.
          </p>
          <Link href="/" style={{ color: "var(--color-accent)", fontSize: "var(--text-body-sm)", textDecoration: "none" }}>
            ← Upload a file
          </Link>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div style={{
          background: "var(--color-bg-base)",
          border: "0.5px solid var(--color-border-default)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}>
          {items.map((item) => (
            <DashboardRow key={item.id} item={item} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
