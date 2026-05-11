"use client";

import { useEffect } from "react";
import { getToken, getAuthSiteUrl } from "@/lib/auth";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  useEffect(() => {
    if (!getToken()) {
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `${getAuthSiteUrl()}/login?redirect=${returnUrl}`;
    }
  }, []);

  if (typeof window !== "undefined" && !getToken()) {
    return null;
  }

  return <>{children}</>;
}
