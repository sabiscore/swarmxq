"use client";

import { log } from "@/lib/logger";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    log.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 gap-4 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative">
          <AlertTriangle className="h-8 w-8 text-status-error" />
          <div
            className="absolute inset-0"
            style={{ animation: "border-flash-error 2s ease-in-out infinite" }}
          />
        </div>
        <div>
          <div className="text-sm font-mono font-semibold text-text-primary mb-1">
            Something went sideways
          </div>
          <div className="text-xs font-mono text-text-muted max-w-sm">
            Try again. If the problem persists, confirm that the API and event stream are available.
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={reset}
        className="gap-1.5"
      >
        <RefreshCw className="h-3 w-3" />
        Try again
      </Button>
    </div>
  );
}
