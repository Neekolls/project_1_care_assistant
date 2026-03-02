// frontend/src/utils/formatDate.ts

/**
 * Formate une date ISO en format lisible
 * Ex: "2026-02-24T12:08:30.356Z" → "24/02/2026 12:08"
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
