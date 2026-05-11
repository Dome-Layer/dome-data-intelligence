"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getAuthSiteUrl } from "@/lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Cookie was already set by domelayer.com/auth/callback.
    // Just verify it exists and redirect home.
    if (getToken()) {
      router.replace("/");
    } else {
      // Cookie not found — send to central login
      window.location.href = `${getAuthSiteUrl()}/login?redirect=${encodeURIComponent(window.location.origin)}`;
    }
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg-base, #fff)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          width: "24px",
          height: "24px",
          border: "2px solid #E8E8E8",
          borderTopColor: "#0080FF",
          borderRadius: "50%",
          animation: "spin 600ms linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
