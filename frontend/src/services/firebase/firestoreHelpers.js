/**
 * firestoreHelpers.js
 * Wraps Firestore calls. Returns fallback (default []) on error.
 * NO demoStore. NO localStorage. Pure Firestore.
 */
export async function safe(fn, fallback = []) {
  try {
    return await fn();
  } catch (err) {
    const code = err?.code || '';
    console.error('[Firestore]', code, err?.message);
    return fallback;
  }
}
