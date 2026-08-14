/**
 * Format angka ke mata uang Rupiah
 * Contoh: 50000 -> Rp 50.000
 */
export function formatIDR(amount: number): string {
  if (isNaN(amount)) return "Rp 0";
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Parse JSON dengan aman untuk menghindari aplikasi crash
 * Sangat berguna untuk kolom Ingredients_JSON dari Sheets
 */
export function safeParseJSON<T>(str: any): T | any[] {
  if (!str) return [];
  if (typeof str !== 'string') return str; 
  try { 
    return JSON.parse(str); 
  } catch (e) { 
    console.error("Gagal parse JSON:", e);
    return []; 
  }
}

/**
 * Helper untuk inisial nama (Misal: Nadzira Rifqi -> NR)
 * Bisa dipakai untuk avatar di sidebar
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}
