"use client";

import { Network } from "lucide-react";

const ORGANIZATION_STRUCTURE_PDF_SRC = "/documents/pdf/Struktur CSL.pdf";

export default function DashboardOrganizationStructurePage() {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Bagan Struktur Organisasi
            </h2>
            <p className="text-xs text-slate-500">
              Dokumen struktur organisasi CSL.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <iframe
              src={ORGANIZATION_STRUCTURE_PDF_SRC}
              title="Bagan Struktur Organisasi CSL"
              className="h-[75vh] w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
