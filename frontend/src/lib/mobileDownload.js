/**
 * mobileDownload.js
 * Handles file downloads/saves on both web browsers and native Android (Capacitor).
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

export async function savePDF(pdfInstance, filename = 'document.pdf') {
  if (Capacitor.isNativePlatform()) {
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
      console.error('Mobile PDF share failed:', e);
      alert('PDF Error: ' + (e.message || JSON.stringify(e)));
      pdfInstance.save(filename);
    }
  } else {
    pdfInstance.save(filename);
  }
}

export async function saveBlob(blob, filename) {
  if (Capacitor.isNativePlatform()) {
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
      console.error('Mobile blob share failed:', e);
      alert('Blob Error: ' + (e.message || JSON.stringify(e)));
      triggerBlobDownload(blob, filename);
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
