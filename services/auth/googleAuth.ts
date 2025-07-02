/**
 * @file services/auth/googleAuth.ts
 * @description Google authentication helpers to fetch the user's Gemini API key.
 */
import { setApiKey } from '../apiClient';
import { GOOGLE_CLIENT_ID } from '../../constants';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id: {
          initialize: (options: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Returns true when a Google OAuth client ID is provided. */
export const isGoogleAuthAvailable = (): boolean => GOOGLE_CLIENT_ID.trim().length > 0;

const loadGoogleScript = (): Promise<void> => {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[data-google-identity]')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('Failed to load Google Identity script'));
    };
    document.head.append(script);
  });
  return scriptPromise;
};

/**
 * Prompts the user to sign in with Google and fetches their Gemini API key.
 */
export const loginWithGoogle = async (): Promise<void> => {
  if (!isGoogleAuthAvailable()) {
    console.error('GOOGLE_CLIENT_ID is not configured; cannot use Google login.');
    return;
  }
  await loadGoogleScript();
  if (!window.google?.accounts?.id) {
    console.error('Google Identity Services failed to initialize.');
    return;
  }
  return new Promise(resolve => {
    window.google?.accounts?.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: ({ credential }) => {
        void (async () => {
          try {
            const resp = await fetch(
              'https://aistudio.googleapis.com/v1alpha/userAPIKey',
              { headers: { Authorization: `Bearer ${credential}` } },
            );
            if (!resp.ok) {
              console.error('Failed to fetch API key from Google AI Studio.');
              resolve();
              return;
            }
            const data: unknown = await resp.json();
            const key = (data as { apiKey?: unknown }).apiKey;
            if (typeof key === 'string') {
              setApiKey(key);
            } else {
              console.error('Google AI Studio response missing apiKey field.');
            }
          } catch (err) {
            console.error('Error retrieving Gemini API key:', err);
          } finally {
            resolve();
          }
        })();
      },
    });
    window.google?.accounts?.id.prompt();
  });
};
