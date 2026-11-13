"use client";

import React, { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function TerminalRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "terminal");
    router.replace(`/?${params.toString()}`);
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#0C1017] flex items-center justify-center text-slate-400 text-xs font-mono">
      Memuat Terminal...
    </div>
  );
}

export default function TerminalPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0C1017]" />}>
      <TerminalRedirectContent />
    </Suspense>
  );
}
