"use client";

import type { LabClearanceResult } from "@/services/admin";

const SERVICE_TYPE_LABEL: Record<string, string> = {
  borrow: "Peminjaman Alat",
  booking: "Peminjaman Lab",
  pengujian: "Pengujian Sampel",
};

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(isoString));
}

function getFilenameTimestamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("");
}

export async function generateLabClearancePdf(data: LabClearanceResult): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 56;
  const contentW = pageW - margin * 2;

  // ── Header ──────────────────────────────────────────────────────────────
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageW, 72, "F");

  pdf.setTextColor(248, 250, 252);
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.text("LABORATORIUM CSL", pageW / 2, 28, { align: "center" });

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Pusat Sains dan Komputasi — Institut Teknologi Bandung", pageW / 2, 44, {
    align: "center",
  });
  pdf.text("Jl. Ganesha No.10, Bandung, Jawa Barat 40132", pageW / 2, 58, { align: "center" });

  // ── Title ────────────────────────────────────────────────────────────────
  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(13);
  pdf.setFont("helvetica", "bold");
  pdf.text("SURAT KETERANGAN BEBAS TANGGUNGAN", pageW / 2, 104, { align: "center" });
  pdf.setFontSize(11);
  pdf.text("LABORATORIUM", pageW / 2, 120, { align: "center" });

  // ── Divider ──────────────────────────────────────────────────────────────
  pdf.setDrawColor(15, 23, 42);
  pdf.setLineWidth(1.5);
  pdf.line(margin, 132, pageW - margin, 132);
  pdf.setLineWidth(0.5);
  pdf.line(margin, 136, pageW - margin, 136);

  // ── Intro text ───────────────────────────────────────────────────────────
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(30, 41, 59);
  const introText =
    "Yang bertanda tangan di bawah ini, menerangkan bahwa mahasiswa/pengguna berikut:";
  pdf.text(introText, margin, 160);

  // ── User info table ───────────────────────────────────────────────────────
  const infoRows: [string, string][] = [
    ["Nama Lengkap", data.fullName],
    ["NIM / ID", data.idNumber ?? "-"],
    ["Email", data.email],
    ["Program Studi / Departemen", data.department ?? "-"],
    ["Angkatan", data.batch ?? "-"],
    // ["Peran", data.role],
  ];

  let curY = 172;
  for (const [label, value] of infoRows) {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, margin + 8, curY);
    pdf.setFont("helvetica", "normal");
    pdf.text(`: ${value}`, margin + 170, curY);
    curY += 16;
  }

  curY += 8;

  // ── Status badge ──────────────────────────────────────────────────────────
  if (data.isClear) {
    pdf.setFillColor(220, 252, 231);
    pdf.setDrawColor(22, 163, 74);
  } else {
    pdf.setFillColor(254, 226, 226);
    pdf.setDrawColor(220, 38, 38);
  }
  pdf.setLineWidth(1);
  pdf.roundedRect(margin, curY, contentW, 36, 4, 4, "FD");

  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(data.isClear ? 21 : 185, data.isClear ? 128 : 28, data.isClear ? 61 : 28);
  const statusText = data.isClear
    ? "BEBAS TANGGUNGAN LABORATORIUM"
    : "MASIH MEMILIKI TANGGUNGAN LABORATORIUM";
  pdf.text(statusText, pageW / 2, curY + 22, { align: "center" });
  curY += 52;

  // ── Conclusion paragraph ─────────────────────────────────────────────────
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(30, 41, 59);

  if (data.isClear) {
    const conclusionText = pdf.splitTextToSize(
      "dinyatakan BEBAS TANGGUNGAN terhadap semua layanan laboratorium, meliputi peminjaman alat, peminjaman ruangan, dan pengujian sampel. Surat keterangan ini diberikan untuk dipergunakan sebagaimana mestinya.",
      contentW,
    ) as string[];
    pdf.text(conclusionText, margin, curY);
    curY += conclusionText.length * 14 + 8;
  } else {
    pdf.text(
      `dinyatakan BELUM BEBAS TANGGUNGAN dengan ${data.summary.totalActive} layanan aktif berikut:`,
      margin,
      curY,
    );
    curY += 20;

    autoTable(pdf, {
      startY: curY,
      head: [["Kode", "Jenis Layanan", "Keterangan", "Status", "Batas Waktu"]],
      body: data.activeServices.map((s) => [
        s.code,
        SERVICE_TYPE_LABEL[s.type] ?? s.type,
        s.label,
        s.status,
        s.endTime ? formatDate(s.endTime) : "-",
      ]),
      styles: { fontSize: 8, cellPadding: 4, valign: "middle" },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [248, 250, 252],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      bodyStyles: { textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    curY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  // ── Footer / TTD ──────────────────────────────────────────────────────────
  const today = formatDate(new Date().toISOString());
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(30, 41, 59);

  const rightX = pageW - margin;
  pdf.text(`Bandung, ${today}`, rightX, curY + 16, { align: "right" });
  pdf.text("Pengelola Laboratorium CSL,", rightX, curY + 30, { align: "right" });
  curY += 90;
  pdf.setFont("helvetica", "bold");
  pdf.text("(________________________)", rightX, curY, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(
    `Digenerate otomatis oleh sistem CSL pada ${new Intl.DateTimeFormat("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date())} WIB`,
    margin,
    curY + 32,
  );

  pdf.save(`surat-bebas-lab-${data.idNumber ?? data.fullName.replace(/\s+/g, "-")}-${getFilenameTimestamp()}.pdf`);
}
