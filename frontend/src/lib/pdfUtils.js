// PDF + certificate utilities (lazy-imports jspdf).
import { savePDF } from './mobileDownload';

export async function downloadElementAsPDF(elementId, filename = 'document.pdf') {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');
  const el = document.getElementById(elementId);
  if (!el) return;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  const img = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 10;
  const marginY = 10;
  const ratio = Math.min((pageW - marginX * 2) / canvas.width, (pageH - marginY * 2) / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(img, 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h);
  await savePDF(pdf, filename);
}


export function nextReceiptNo(existing = []) {
  const nums = existing
    .map((r) => Number(String(r.receiptNo || '').replace(/\D/g, '')))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 200) + 1;
  return `RCPT${String(next).padStart(5, '0')}`;
}

export const CLASS_OPTIONS = ['Nursery', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
export const SECTION_OPTIONS = ['A', 'B', 'C', 'D'];
