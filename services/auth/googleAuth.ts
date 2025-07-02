/**
 * @file services/auth/googleAuth.ts
 * @description Google OAuth helpers using the Google Identity Services library.
 */
import {
  getGoogleClientId,
  setGoogleClientId,
} from '../../constants';
import { setApiKey } from '../apiClient';

let tokenClient: { requestAccessToken: () => void } | null = null;

const loadClientIdFromMetadata = async (): Promise<string> => {
  try {
    const resp = await fetch('/metadata.json');
    if (resp.ok) {
      const data: unknown = await resp.json();
      const id = (data as { googleClientId?: unknown }).googleClientId;
      if (typeof id === 'string' && id.trim()) {
        setGoogleClientId(id.trim());
        return id.trim();
      }
    }
  } catch (err: unknown) {
    console.error('Failed to load Google client ID from metadata:', err);
  }
  return '';
};

/** Returns true when a Google OAuth client ID is provided. */
export const isGoogleAuthAvailable = (): boolean => getGoogleClientId().trim().length > 0;

const loadGoogleScript = async (): Promise<void> => {
  if (window.google?.accounts?.oauth2) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => { resolve(); };
    script.onerror = () => { reject(new Error('Failed to load Google Identity Services')); };
    document.head.append(script);
  });
};

const fetchApiKey = async (token: string): Promise<void> => {
  try {
    const resp = await fetch('https://aistudio.googleapis.com/v1alpha/userAPIKey', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      const data: unknown = await resp.json();
      const key = (data as { apiKey?: unknown }).apiKey;
      if (typeof key === 'string') {
        setApiKey(key);
      } else {
        console.error('Google AI Studio response missing apiKey field.');
      }
    } else {
      console.error('Failed to fetch API key from Google AI Studio.');
    }
  } catch (err: unknown) {
    console.error('Error fetching API key from Google AI Studio:', err);
  }
};

/** Initiates OAuth flow using Google Identity Services. */
export const loginWithGoogle = async (): Promise<void> => {
  let clientId = getGoogleClientId();
  if (!clientId.trim()) {
    clientId = await loadClientIdFromMetadata();
    if (!clientId.trim()) {
      console.error('GOOGLE_CLIENT_ID is not configured; cannot use Google login.');
      return;
    }
  }
  await loadGoogleScript();
  const googleObj = window.google as
    | {
        accounts?: {
          oauth2?: {
            initTokenClient: (config: {
              client_id: string;
              scope: string;
              callback: (resp: { access_token?: string; error?: string }) => void;
            }) => GoogleTokenClient;
          };
        };
      }
    | undefined;
  if (!googleObj?.accounts?.oauth2?.initTokenClient) {
    console.error('Google Identity Services not available.');
    return;
  }
  const client = tokenClient ??
    googleObj.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      callback: (resp: { access_token?: string; error?: string }) => {
        void (async () => {
          if (resp.error || typeof resp.access_token !== 'string') {
            console.error('Google login failed.');
            return;
          }
          await fetchApiKey(resp.access_token);
        })();
      },
    });
  tokenClient = client;
  client.requestAccessToken();
};

/** Placeholder retained for compatibility; no-op with token flow. */
export const maybeCompleteOAuth = async (): Promise<void> => {
  /* no-op */
};
