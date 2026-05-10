"use client";

import { useEffect } from "react";

import { getBrowserTelemetry } from "./client";

// Mounts window.__pdTelemetry so QA can fire the row-13 canary ping from the
// browser console of any public-build artifact. Public surface is intentionally
// narrow: canaryPing only. Full SDK access stays through the typed import.
//
// Window typing lives at the bottom; we widen `Window` rather than `globalThis`
// so server-side bundles keep their usual typing.

declare global {
  interface Window {
    __pdTelemetry?: {
      canaryPing: (label?: string) => void;
    };
  }
}

export function TelemetryBoot(): null {
  useEffect(() => {
    const t = getBrowserTelemetry();
    window.__pdTelemetry = {
      canaryPing: (label) => t.canaryPing(label),
    };
    return () => {
      if (window.__pdTelemetry) delete window.__pdTelemetry;
    };
  }, []);
  return null;
}
