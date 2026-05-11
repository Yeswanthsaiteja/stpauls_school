import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (n, locale = 'en-IN') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

export const formatDate = (d, locale = 'en-IN') => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
};

export const exportToCSV = (rows, filename = 'export.csv') => {
  if (!rows || !rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [
    keys.join(','),
    ...rows.map((r) =>
      keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const getWhatsAppUrl = (phone, message) => {
  const cleaned = String(phone || '').replace(/[^0-9+]/g, '');
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message || '')}`;
};

export const generateAdmissionNo = (year) => {
  const y = year || new Date().getFullYear();
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `ADM${y}${seq}`;
};

export const calcGrade = (marks, total) => {
  const p = (Number(marks) / Number(total)) * 100;
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B';
  if (p >= 60) return 'C';
  if (p >= 40) return 'D';
  return 'F';
};
