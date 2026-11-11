"use client";

import { useEffect } from "react";

export default function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const registerSw = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          if (!reg) return;
          if (reg.waiting && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent("auditx_sw_waiting", { detail: { registration: reg } }));
          }
          reg.addEventListener?.("updatefound", () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                window.dispatchEvent(new CustomEvent("auditx_sw_waiting", { detail: { registration: reg } }));
              }
            });
          });
          reg.update?.().catch(() => {});
        })
        .catch(() => {});
    };

    if (document.readyState === "complete") {
      registerSw();
    } else {
      window.addEventListener("load", registerSw, { once: true });
      return () => window.removeEventListener("load", registerSw);
    }
  }, []);

  return null;
}

