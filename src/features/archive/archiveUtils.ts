export const ARCHIVE_RETENTION_YEARS = 5;

export const getCurrentFiscalYear = (now: Date = new Date()): number => {
  const month = now.getMonth(); // 0-based
  const year = now.getFullYear();
  return month >= 3 ? year : year - 1;
};

export const getArchiveYears = (now: Date = new Date()): number[] => {
  const currentFiscalYear = getCurrentFiscalYear(now);
  return Array.from({ length: ARCHIVE_RETENTION_YEARS }, (_, index) => currentFiscalYear - index);
};

export const isArchiveYearWithinRetention = (year: number, now: Date = new Date()): boolean => {
  const years = getArchiveYears(now);
  return years.includes(year);
};

export const formatArchiveLabel = (year: number): string => `${year}年度アーカイブ`;
