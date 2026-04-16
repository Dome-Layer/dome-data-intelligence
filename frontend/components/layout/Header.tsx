"use client";

import Link from "next/link";
import { DomeLogo } from "./DomeLogo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/context/AuthContext";

export function Header() {
  const { isAuthenticated, signOut } = useAuth();

  return (
    <header className="site-header sticky top-0 z-40 px-6 md:px-8">
      <div className="h-16 flex items-center justify-between">
        <Link href="/" aria-label="Home">
          <DomeLogo width={100} />
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link
            href="/saved"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-body-sm)",
              fontWeight: 500,
              lineHeight: "1.25rem",
              color: "var(--color-text-secondary)",
              textDecoration: "none",
              transition: "color 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
          >
            Saved
          </Link>

          {isAuthenticated ? (
            <button
              onClick={async () => {
                await signOut();
                window.location.href = "https://domelayer.com/login";
              }}
              className="btn btn-neutral"
              style={{ padding: "12px 24px", fontSize: "var(--text-body-sm)" }}
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => {
                const returnUrl = encodeURIComponent(window.location.href);
                window.location.href = `https://domelayer.com/login?redirect=${returnUrl}`;
              }}
              className="btn btn-primary"
              style={{ padding: "12px 24px", fontSize: "var(--text-body-sm)" }}
            >
              Sign in
            </button>
          )}

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
