"use client";

import { log } from "@/lib/logger";
import { useEffect } from "react";
import { Server, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SystemError({ error, reset }: ErrorProps) {
  useEffect(() => {
    log.error("[SystemPage] Error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded border border-status-error/35 bg-status-error/10">
        <Server className="h-7 w-7 text-status-error" aria-hidden="true" />
      </div>

      <div className="max-w-sm space-y-2">
        <h2 className="text-base font-semibold text-text-primary">
          System metrics unavailable
        </h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          Try again. If the problem persists, confirm that the API is available.
        </p>
      </div>

      <Button type="button" onClick={reset} className="gap-1.5">
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Retry
      </Button>
    </div>
  );
}
