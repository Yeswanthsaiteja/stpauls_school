/**
 * mobileDownload.js
 * Handles file downloads/saves on both web browsers and native Android (Capacitor).
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

let _isSharing = false;

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

export async function savePDF(pdfInstance, filename = 'document.pdf') {
  if (Capacitor.isNativePlatform()) {
    if (_isSharing) return; // Prevent double-trigger silently
    _isSharing = true;
    try {
      const dataUri = pdfInstance.output('datauristring');
      const base64Data = dataUri.split(',')[1];
      
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache
      });
      
      await Share.share({
        title: filename,
        url: savedFile.uri,
        dialogTitle: 'Save or Share PDF'
      });
    } catch (e) {
      // Silently ignore "sharing already in progress" errors — no popup
      const msg = e?.message || JSON.stringify(e);
      if (!msg.includes('progress') && !msg.includes('cancel') && !msg.includes('dismiss')) {
        console.error('Mobile PDF share failed:', msg);
      }
    } finally {
      // Reset sharing flag after a short delay to debounce rapid taps
      setTimeout(() => { _isSharing = false; }, 1000);
    }
  } else {
    pdfInstance.save(filename);
  }
}

export async function saveBlob(blob, filename) {
  if (Capacitor.isNativePlatform()) {
    if (_isSharing) return; // Prevent double-trigger silently
    _isSharing = true;
    try {
      const base64String = await blobToBase64(blob);
      const base64Data = base64String.split(',')[1];

      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache
      });
      
      await Share.share({
        title: filename,
        url: savedFile.uri,
        dialogTitle: 'Save or Share File'
      });
    } catch (e) {
      // Silently ignore "sharing already in progress" errors — no popup
      const msg = e?.message || JSON.stringify(e);
      if (!msg.includes('progress') && !msg.includes('cancel') && !msg.includes('dismiss')) {
        console.error('Mobile blob share failed:', msg);
        triggerBlobDownload(blob, filename);
      }
    } finally {
      setTimeout(() => { _isSharing = false; }, 1000);
    }
  } else {
    triggerBlobDownload(blob, filename);
  }
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
