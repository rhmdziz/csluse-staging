"use client";

type PdfColumn<TRow> = {
  header: string;
  cell: (row: TRow) => string;
};

type ExportAdminRecordPdfOptions<TRow> = {
  title: string;
  filename: string;
  subtitle?: string;
  columns: PdfColumn<TRow>[];
  rows: TRow[];
};

type ExportAdminRecordExcelOptions<TRow> = {
  title: string;
  filename: string;
  columns: PdfColumn<TRow>[];
  rows: TRow[];
};

function getExportTimestamp(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "-",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join("");
}

function getNormalizedFilename(filename: string) {
  return filename.replace(/\.(pdf|xlsx)$/i, "");
}

async function loadPdfModules() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  return { jsPDF, autoTable };
}

async function loadExcelModule() {
  return import("xlsx");
}

export async function exportAdminRecordPdf<TRow>({
  title,
  filename,
  subtitle,
  columns,
  rows,
}: ExportAdminRecordPdfOptions<TRow>) {
  const { jsPDF, autoTable } = await loadPdfModules();
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a3",
  });

  const now = new Date();
  const generatedAt = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const filenameTimestamp = getExportTimestamp(now);
  const normalizedFilename = getNormalizedFilename(filename);

  pdf.setFontSize(16);
  pdf.text(title, 24, 32);

  pdf.setFontSize(10);
  const metaText = subtitle
    ? `${subtitle} | Dibuat ${generatedAt} WIB`
    : `Dibuat ${generatedAt} WIB`;
  pdf.text(metaText, 24, 48);

  autoTable(pdf, {
    startY: 62,
    head: [columns.map((column) => column.header)],
    body: rows.map((row) => columns.map((column) => column.cell(row))),
    theme: "grid",
    styles: {
      fontSize: 6.5,
      cellPadding: 4,
      valign: "middle",
      textColor: [15, 23, 42],
      lineColor: [15, 23, 42],
      lineWidth: 0.5,
      fillColor: false,
    },
    headStyles: {
      fillColor: false,
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 7,
    },
    bodyStyles: {
      textColor: [15, 23, 42],
    },
    margin: {
      left: 24,
      right: 24,
      top: 24,
      bottom: 24,
    },
    didDrawPage: (data) => {
      pdf.setFontSize(8);
      pdf.text(
        `Halaman ${data.pageNumber}`,
        data.settings.margin.left,
        pdf.internal.pageSize.height - 12,
      );
    },
  });

  pdf.save(`${normalizedFilename}-${filenameTimestamp}.pdf`);
}

export async function exportAdminRecordExcel<TRow>({
  title,
  filename,
  columns,
  rows,
}: ExportAdminRecordExcelOptions<TRow>) {
  const XLSX = await loadExcelModule();
  const now = new Date();
  const filenameTimestamp = getExportTimestamp(now);
  const normalizedFilename = getNormalizedFilename(filename);
  const sheetName = title.slice(0, 31);
  const worksheetData = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.header, column.cell(row)])),
  );

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || "Data");
  XLSX.writeFile(workbook, `${normalizedFilename}-${filenameTimestamp}.xlsx`);
}
