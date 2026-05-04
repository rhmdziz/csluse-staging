"use client";

type PreviewableDocumentLike = {
  mimeType?: string | null;
  originalName?: string | null;
  url?: string | null;
  document_url?: string | null;
};

const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".svg",
];

function getDocumentUrl(document: PreviewableDocumentLike) {
  return String(document.url || document.document_url || "");
}

export function isImageDocumentFile(document: PreviewableDocumentLike) {
  const mimeType = String(document.mimeType || "").toLowerCase();
  const fileName = String(document.originalName || "").toLowerCase();

  return (
    mimeType.startsWith("image/") ||
    IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension))
  );
}

export function isPdfDocumentFile(document: PreviewableDocumentLike) {
  const mimeType = String(document.mimeType || "").toLowerCase();
  const fileName = String(document.originalName || "").toLowerCase();

  return mimeType === "application/pdf" || fileName.endsWith(".pdf");
}

export function isPreviewableDocumentFile(document: PreviewableDocumentLike) {
  return isImageDocumentFile(document) || isPdfDocumentFile(document);
}

export function downloadDocumentFile(document: PreviewableDocumentLike) {
  const url = getDocumentUrl(document);
  if (!url) return;

  const link = window.document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.download = document.originalName || "document";
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}
