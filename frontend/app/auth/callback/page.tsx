"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { signIn } = useAuth();

  useEffect(() => {
    // Supabase redirects with the token in the URL fragment:
    // /#access_token=...&token_type=bearer&expires_in=...
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const expiresIn = params.get("expires_in");

    if (accessToken) {
      const expiresAt = expiresIn
        ? new Date(Date.now() + parseInt(expiresIn, 10) * 1000).toISOString()
        : undefined;
      signIn(accessToken, expiresAt);
    }

    router.replace("/");
  }, [router, signIn]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "12px" }}>
      <span className="spinner" />
      <span className="eyebrow">Signing in…</span>
    </div>
  );
}
