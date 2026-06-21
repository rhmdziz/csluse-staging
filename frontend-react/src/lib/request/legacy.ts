const LEGACY_IMPORT_CODE_PREFIXES = ["CSLUSE020", "CSL", "EX-PL", "EX-PS"];

export function isLegacyImportedCode(code: string | null | undefined) {
  const normalizedCode = String(code ?? "")
    .trim()
    .toUpperCase();

  return LEGACY_IMPORT_CODE_PREFIXES.some((prefix) => normalizedCode.startsWith(prefix));
}
