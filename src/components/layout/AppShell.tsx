"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [navOpen, setNavOpen] = useState(false);
  const [desktopNavVisible, setDesktopNavVisible] = useState(true);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname, searchKey]);

  useEffect(() => {
    if (!navOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [navOpen]);

  return (
    <div className="min-h-screen bg-background">
      <Header
        mobileNavOpen={navOpen}
        onToggleMobileNav={() => setNavOpen((current) => !current)}
        desktopNavVisible={desktopNavVisible}
        onToggleDesktopNav={() => setDesktopNavVisible((current) => !current)}
      />
      <div className="flex min-h-[calc(100dvh-4rem)]">
        <Sidebar
          open={navOpen}
          onClose={() => setNavOpen(false)}
          desktopVisible={desktopNavVisible}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
