import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Uploads a file to Firebase Storage and returns the public download URL.
 * @param {File} file - The file to upload (from an input element).
 * @param {string} path - The storage path (e.g., 'student-photos/123.jpg').
 * @returns {Promise<string>} The download URL.
 */
export async function uploadToStorage(file, path) {
  if (!file) throw new Error('No file provided for upload.');
  if (!storage) throw new Error('Firebase Storage is not initialized.');

  try {
    const fileRef = ref(storage, path);
    // Upload the file
    await uploadBytes(fileRef, file);
    // Get the public download URL
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file to storage:', error);
    throw new Error(`Failed to upload file to storage: ${error.message}`);
  }
}
