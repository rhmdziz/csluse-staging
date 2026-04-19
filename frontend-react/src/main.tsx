import React, { useEffect } from "react";

import ReactDOM from "react-dom/client";

// Auto-reload when Vite fails to fetch a lazy-loaded chunk (e.g. after a new build or dev server restart)
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RouterProvider } from "react-router-dom";

import { toast } from "sonner";

import { router } from "@/routes/router";

import { Toaster, TooltipProvider } from "@/components/ui";

import "@/styles/globals.css";

const queryClient = new QueryClient();

function SessionExpiryNotifier() {
  useEffect(() => {
    const handleSessionExpired = () => {
      toast.error("Sesi Anda telah berakhir. Silakan login kembali.");
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, []);

  return null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={120}>
        <SessionExpiryNotifier />
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
