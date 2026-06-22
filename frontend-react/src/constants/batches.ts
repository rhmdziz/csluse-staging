const BATCH_MIN_YEAR = 2000;
const BATCH_MAX_YEAR = 2100;
const BATCH_PAST_OFFSET = 4;
const BATCH_FUTURE_OFFSET = 6;

function buildBatchOptions(baseYear = new Date().getFullYear()) {
  const startYear = Math.max(BATCH_MIN_YEAR, baseYear - BATCH_PAST_OFFSET);
  const endYear = Math.min(BATCH_MAX_YEAR, baseYear + BATCH_FUTURE_OFFSET);

  return Array.from({ length: endYear - startYear + 1 }, (_, index) =>
    String(startYear + index),
  );
}

function isValidBatchValue(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}$/.test(normalized)) return false;

  const year = Number(normalized);
  return year >= BATCH_MIN_YEAR && year <= BATCH_MAX_YEAR;
}

const BATCH_VALUES = buildBatchOptions();
const BATCH_OPTIONS = [...BATCH_VALUES];

export {
  BATCH_MAX_YEAR,
  BATCH_MIN_YEAR,
  BATCH_OPTIONS,
  BATCH_VALUES,
  buildBatchOptions,
  isValidBatchValue,
};
