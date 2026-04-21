import { AdminSampleTestingDocumentsContent } from "@/components/admin/documents/content";

export default function AdminSampleTestingDocumentsPage() {
  return (
    <AdminSampleTestingDocumentsContent
      config={{
        title: "Dokumen Pengujian Sampel",
        description:
          "Lihat seluruh dokumen pengujian sampel dalam satu tabel admin.",
        documentTypes: [
          "testing_agreement",
          "signed_testing_agreement",
          "invoice",
          "payment_proof",
          "receipt",
          "test_result_letter",
        ],
        emptyMessage: "Belum ada dokumen pengujian sampel yang tersedia.",
      }}
    />
  );
}
