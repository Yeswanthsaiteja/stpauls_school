export function getCurrentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = Jan, 5 = Jun)

  if (month >= 5) {
    // June to Dec -> e.g. June 2026 => "2026-27"
    return `${year}-${(year + 1).toString().slice(2)}`;
  } else {
    // Jan to May -> e.g. May 2026 => "2025-26"
    return `${year - 1}-${year.toString().slice(2)}`;
  }
}
