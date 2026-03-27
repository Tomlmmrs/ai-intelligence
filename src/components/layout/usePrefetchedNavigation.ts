"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function usePrefetchedNavigation() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  const prefetch = (href: string) => {
    router.prefetch(href);
  };

  return {
    isPending,
    navigate,
    prefetch,
  };
}
