"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToolHeader } from "@dome-layer/dome-ui";

export function Header() {
  // The dashboard renders full-width; everything else (upload, saved) is centered.
  // Match the header's width to the content below it so the logo/actions line up.
  const pathname = usePathname();
  const width = pathname?.startsWith("/dashboard") ? "fluid" : "contained";

  return (
    <ToolHeader
      toolName="Data Intelligence"
      width={width}
      navLinks={[{ label: "Saved", href: "/saved" }]}
      renderLink={({ href, children, ...rest }) => (
        <Link href={href} {...rest}>
          {children}
        </Link>
      )}
    />
  );
}
