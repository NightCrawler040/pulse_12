export function formatShortName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  
  const lastName = parts[0];
  const firstName = parts[1];
  const patronymic = parts.length > 2 ? parts[2] : null;
  
  let shortName = `${lastName} ${firstName[0].toUpperCase()}.`;
  if (patronymic) {
    shortName += `${patronymic[0].toUpperCase()}.`;
  }
  
  return shortName;
}
