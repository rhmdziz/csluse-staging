"use client";

import type { LabClearanceDetail } from "@/services/lab-clearance";

const HEADER_FONT = "helvetica";
const BODY_FONT = "times";
const LOGO_SRC = "/logo/prasmul.jpg";
const BODY_FONT_SIZE = 12;
const HEADER_LABEL_FONT_SIZE = 10;
const HEADER_TITLE_FONT_SIZE = 13;
const HEADER_META_FONT_SIZE = 10;
const BODY_ITEM_SPACING = 21;

let logoPromise: Promise<HTMLImageElement | null> | null = null;

let pdfLibsPromise: Promise<[
  { default: typeof import("jspdf").default },
  { default: typeof import("jspdf-autotable").default },
]> | null = null;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function sanitizeFilenamePart(value: string | null | undefined) {
  if (!value) return "";

  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_");
}

function drawInlineCollaborativeStemText(
  pdf: InstanceType<typeof import("jspdf").default>,
  x: number,
  y: number,
  beforeText: string,
  afterText = "",
) {
  pdf.setFont(BODY_FONT, "normal");
  pdf.text(beforeText, x, y);
  const beforeWidth = pdf.getTextWidth(beforeText);

  pdf.setFont(BODY_FONT, "italic");
  pdf.text("Collaborative STEM Laboratories", x + beforeWidth, y);
  const italicWidth = pdf.getTextWidth("Collaborative STEM Laboratories");

  if (afterText) {
    pdf.setFont(BODY_FONT, "normal");
    pdf.text(afterText, x + beforeWidth + italicWidth, y);
  }
}

function drawInlineTextSegments(
  pdf: InstanceType<typeof import("jspdf").default>,
  x: number,
  y: number,
  segments: Array<{ text: string; style: "normal" | "italic" | "bold" }>,
) {
  let cursorX = x;

  for (const segment of segments) {
    pdf.setFont(BODY_FONT, segment.style);
    pdf.text(segment.text, cursorX, y);
    cursorX += pdf.getTextWidth(segment.text);
  }
}

function getInlineCollaborativeStemWidth(
  pdf: InstanceType<typeof import("jspdf").default>,
  beforeText: string,
  afterText = "",
) {
  pdf.setFont(BODY_FONT, "normal");
  const beforeWidth = pdf.getTextWidth(beforeText);
  pdf.setFont(BODY_FONT, "italic");
  const italicWidth = pdf.getTextWidth("Collaborative STEM Laboratories");
  pdf.setFont(BODY_FONT, "normal");
  const afterWidth = afterText ? pdf.getTextWidth(afterText) : 0;

  return beforeWidth + italicWidth + afterWidth;
}

function getInlineSegmentsWidth(
  pdf: InstanceType<typeof import("jspdf").default>,
  segments: Array<{ text: string; style: "normal" | "italic" | "bold" }>,
) {
  let totalWidth = 0;

  for (const segment of segments) {
    pdf.setFont(BODY_FONT, segment.style);
    totalWidth += pdf.getTextWidth(segment.text);
  }

  return totalWidth;
}

function drawWrappedCollaborativeStemText(
  pdf: InstanceType<typeof import("jspdf").default>,
  x: number,
  y: number,
  maxWidth: number,
  beforeText: string,
  afterText = "",
) {
  const beforeWords = beforeText.split(/(\s+)/).filter(Boolean);
  const italicWords = "Collaborative STEM Laboratories".split(" ");
  const afterWords = afterText.split(/(\s+)/).filter(Boolean);

  const segments: Array<{ text: string; style: "normal" | "italic" }> = [
    ...beforeWords.map((text) => ({ text, style: "normal" as const })),
    ...italicWords.map((text, index) => ({
      text: index < italicWords.length - 1 ? `${text} ` : text,
      style: "italic" as const,
    })),
    ...afterWords.map((text) => ({ text, style: "normal" as const })),
  ];

  let cursorX = x;
  let cursorY = y;

  for (const segment of segments) {
    pdf.setFont(BODY_FONT, segment.style);
    const segmentWidth = pdf.getTextWidth(segment.text);

    if (cursorX > x && cursorX + segmentWidth > x + maxWidth) {
      cursorX = x;
      cursorY += 14;
    }

    pdf.text(segment.text, cursorX, cursorY);
    cursorX += segmentWidth;
  }

  return cursorY;
}

async function loadLogoImage(): Promise<HTMLImageElement | null> {
  if (logoPromise) return logoPromise;

  logoPromise = (async () => {
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load logo image"));
        img.src = LOGO_SRC;
      });

      return image;
    } catch {
      return null;
    }
  })();

  return logoPromise;
}

async function loadPdfLibs() {
  if (!pdfLibsPromise) {
    pdfLibsPromise = Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
  }

  return pdfLibsPromise;
}

export async function buildSuratBebasPdf(detail: LabClearanceDetail): Promise<{
  blob: Blob;
  blobUrl: string;
  filename: string;
}> {
  const [{ default: jsPDF }, { default: autoTable }] = await loadPdfLibs();

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 56;
  const contentW = pageW - margin * 2;
  const logo = await loadLogoImage();

  const requester = detail.requested_by_detail;
  const reviewer = detail.reviewed_by_detail;
  const histories = detail.booking_histories ?? [];

  const requesterName = requester?.full_name ?? "-";
  const idNumber = requester?.id_number ?? "-";
  const department = requester?.department ?? "-";
  const reviewerName = reviewer?.full_name ?? "-";

  let y = margin;

  // ─── Header table ────────────────────────────────────────────────────────
  const logoW = 80;
  const midW = 220;
  const rightW = contentW - logoW - midW; // ~183pt
  const headerH = 66;
  const rightRowH = headerH / 3;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);

  // Outer border
  pdf.rect(margin, y, contentW, headerH);
  // Logo | middle divider
  pdf.line(margin + logoW, y, margin + logoW, y + headerH);
  // Middle | right divider
  pdf.line(margin + logoW + midW, y, margin + logoW + midW, y + headerH);
  // Middle column split: top row for "Form", bottom area spans two rows for title
  pdf.line(margin + logoW, y + rightRowH, margin + logoW + midW, y + rightRowH);
  // Right column – 3 rows
  pdf.line(margin + logoW + midW, y + rightRowH, margin + contentW, y + rightRowH);
  pdf.line(margin + logoW + midW, y + rightRowH * 2, margin + contentW, y + rightRowH * 2);

  if (logo) {
    const maxLogoW = logoW - 20;
    const maxLogoH = headerH - 16;
    const scale = Math.min(maxLogoW / logo.width, maxLogoH / logo.height);
    const drawW = logo.width * scale;
    const drawH = logo.height * scale;
    const drawX = margin + (logoW - drawW) / 2;
    const drawY = y + (headerH - drawH) / 2;

    pdf.addImage(logo, "JPEG", drawX, drawY, drawW, drawH);
  }

  // Middle cell – "Form" label + title
  pdf.setFontSize(HEADER_LABEL_FONT_SIZE);
  pdf.setFont(HEADER_FONT, "normal");
  pdf.text("Form", margin + logoW + midW / 2, y + rightRowH * 0.5, {
    align: "center",
    baseline: "middle",
  });
  pdf.setFontSize(HEADER_TITLE_FONT_SIZE);
  pdf.setFont(HEADER_FONT, "bold");
  pdf.text("Bebas Laboratorium", margin + logoW + midW / 2, y + rightRowH * 2, {
    align: "center",
    baseline: "middle",
  });

  // Right column – form metadata
  pdf.setFont(HEADER_FONT, "normal");
  pdf.setFontSize(HEADER_META_FONT_SIZE);
  const rightMidX = margin + logoW + midW + rightW / 2;
  pdf.text("No.: F.LAB.STEM-015A", rightMidX, y + rightRowH * 0.5, { align: "center", baseline: "middle" });
  pdf.text("Revisi: 2", rightMidX, y + rightRowH * 1.5, { align: "center", baseline: "middle" });
  pdf.text("Tanggal: 16-12-2019", rightMidX, y + rightRowH * 2.5, { align: "center", baseline: "middle" });

  y += headerH + 52;

  // ─── Title ───────────────────────────────────────────────────────────────
  pdf.setFontSize(BODY_FONT_SIZE + 2);
  pdf.setFont(BODY_FONT, "bold");
  pdf.setTextColor(0, 0, 0);
  pdf.text("BEBAS PENGGUNAAN LABORATORIUM", pageW / 2, y, { align: "center" });
  y += 52;

  // ─── Intro line ──────────────────────────────────────────────────────────
  pdf.setFontSize(BODY_FONT_SIZE);
  pdf.setFont(BODY_FONT, "normal");
  pdf.text("Saya yang bertanda tangan di bawah ini:", margin, y);
  y += 20;

  // ─── Requester info ──────────────────────────────────────────────────────
  const labelW = 130;
  const rows: [string, string][] = [
    ["Nama", requesterName],
    ["NIM*)", idNumber],
    ["Program Studi/ Unit", department],
  ];
  for (const [label, value] of rows) {
    pdf.setFont(BODY_FONT, "normal");
    pdf.text(label, margin, y);
    pdf.text(":", margin + labelW, y);
    pdf.text(value, margin + labelW + 12, y);
    y += BODY_ITEM_SPACING;
  }
  y += 10;

  // ─── Usage section ───────────────────────────────────────────────────────
  if (histories.length === 0) {
    y += BODY_ITEM_SPACING;
  } else if (histories.length === 1) {
    const h = histories[0];
    const originalBodyFontSize = BODY_FONT_SIZE;
    const singleHistorySegments = [
      { text: "menggunakan fasilitas ", style: "normal" as const },
      { text: "Collaborative STEM Laboratories", style: "italic" as const },
      { text: ` ruang ${h.lab_room_name}`, style: "normal" as const },
    ];
    const singleHistoryLineWidth = getInlineSegmentsWidth(pdf, singleHistorySegments);
    const singleHistoryFontSize =
      singleHistoryLineWidth > contentW
        ? Math.max(8, Math.floor((originalBodyFontSize * contentW) / singleHistoryLineWidth))
        : originalBodyFontSize;

    pdf.setFontSize(singleHistoryFontSize);
    drawInlineTextSegments(pdf, margin, y, singleHistorySegments);
    pdf.setFontSize(originalBodyFontSize);
    y += BODY_ITEM_SPACING;
    pdf.text("untuk keperluan Skripsi/TA", margin, y);
    y += BODY_ITEM_SPACING;
    pdf.text(
      `yang dilakukan pada tanggal ${formatDateShort(h.start_date)} s/d ${formatDateShort(h.end_date)}`,
      margin,
      y,
    );
    y += BODY_ITEM_SPACING;
  } else {
    drawInlineCollaborativeStemText(pdf, margin, y, "menggunakan fasilitas ", " pada ruang-ruang berikut:");
    y += 18;

    autoTable(pdf, {
      startY: y,
      head: [["No.", "Ruang Lab", "Tanggal Mulai", "Tanggal Selesai"]],
      body: histories.map((h, i) => [
        String(i + 1),
        h.lab_room_name,
        formatDate(h.start_date),
        formatDate(h.end_date),
      ]),
      theme: "grid",
      styles: {
        font: BODY_FONT,
        fontSize: BODY_FONT_SIZE - 1.5,
        cellPadding: 4,
        valign: "middle",
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: false,
        textColor: [0, 0, 0],
        fontStyle: "bold",
        fontSize: BODY_FONT_SIZE - 1.5,
        lineColor: [0, 0, 0],
      },
      columnStyles: { 0: { cellWidth: 28, halign: "center" } },
      margin: { left: margin, right: margin },
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }

  if (histories.length > 0) {
    y += 10;
  }

  // ─── TELAH BEBAS paragraph (bold prefix + normal rest) ───────────────────
  pdf.setFont(BODY_FONT, "bold");
  pdf.text("TELAH BEBAS", margin, y);
  const boldW = pdf.getTextWidth("TELAH BEBAS");
  const restPrefix = " dari peminjaman fasilitas (utuh dan bersih) dan administrasi ";
  const restX = margin + boldW;
  pdf.setFont(BODY_FONT, "normal");
  pdf.text(restPrefix, restX, y);
  const restPrefixW = pdf.getTextWidth(restPrefix);
  const italicX = restX + restPrefixW;
  pdf.setFont(BODY_FONT, "italic");
  pdf.text("Collaborative STEM", italicX, y);
  y += BODY_ITEM_SPACING;
  pdf.text("Laboratories.", margin, y);
  y += 34;

  // ─── Signature area ──────────────────────────────────────────────────────
  const today = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
  pdf.setFontSize(BODY_FONT_SIZE);
  pdf.setFont(BODY_FONT, "normal");
  pdf.text(`Tangerang, ${today}`, pageW - margin, y, { align: "right" });
  y += 34;

  const leftSigX = margin + contentW * 0.2;
  const rightSigX = margin + contentW * 0.75;

  pdf.text("Mengetahui,", leftSigX, y, { align: "center" });
  y += BODY_ITEM_SPACING;
  pdf.text("Laboran", leftSigX, y, { align: "center" });
  pdf.text("Pemohon", rightSigX, y, { align: "center" });
  y += 72;

  pdf.text(`( ${reviewerName} )`, leftSigX, y, { align: "center" });
  pdf.text(`( ${requesterName} )`, rightSigX, y, { align: "center" });
  y += 28;

  // ─── Footnote ────────────────────────────────────────────────────────────
  pdf.setFontSize(BODY_FONT_SIZE - 2);
  pdf.setFont(BODY_FONT, "normal");
  pdf.text("Ket: -*) Diisi apabila pemohon adalah mahasiswa", margin, y);

  // ─── Output ──────────────────────────────────────────────────────────────
  const blob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  const filenameParts = [
    "Surat Bebas Lab CSL",
    sanitizeFilenamePart(requesterName),
    sanitizeFilenamePart(idNumber),
  ].filter(Boolean);
  const filename = `${filenameParts.join("_")}.pdf`;
  return { blob, blobUrl, filename };
}
