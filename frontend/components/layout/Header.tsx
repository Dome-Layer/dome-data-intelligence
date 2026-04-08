import Link from "next/link";
import { DomeLogo } from "./DomeLogo";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-dome-bg/90 backdrop-blur-sm border-b border-dome-border">
      <div className="px-4 lg:pr-[396px] h-16 flex items-center">
        <div className="max-w-4xl mx-auto w-full flex items-center">
          <Link href="/" aria-label="Home">
            <DomeLogo width={100} />
          </Link>
        </div>
      </div>
    </header>
  );
}
