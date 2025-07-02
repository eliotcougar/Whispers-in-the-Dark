/**
 * @file services/auth/googleAuth.ts
 * @description Minimal Google OAuth helpers implemented without external libraries.
 */
import { GOOGLE_CLIENT_ID } from '../../constants';
import { setApiKey } from '../apiClient';

const CODE_VERIFIER_KEY = 'whispersInTheDark_codeVerifier';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/** Returns true when a Google OAuth client ID is provided. */
export const isGoogleAuthAvailable = (): boolean => GOOGLE_CLIENT_ID.trim().length > 0;

const generateRandomString = (length: number): string => {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => ALPHABET[b % ALPHABET.length]).join('');
};

const base64UrlEncode = (data: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const sha256 = async (text: string): Promise<string> => {
  const encoded = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(hash);
};

const getRedirectUri = (): string => `${window.location.origin}${window.location.pathname}`;

/** Starts the OAuth flow by redirecting the browser to the consent page. */
export const loginWithGoogle = async (): Promise<void> => {
  if (!isGoogleAuthAvailable()) {
    console.error('GOOGLE_CLIENT_ID is not configured; cannot use Google login.');
    return;
  }
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await sha256(codeVerifier);
  try {
    sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);
  } catch {
    // ignore storage errors
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    prompt: 'consent',
    access_type: 'online',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

/** Handles a redirect from Google OAuth and fetches the user's API key. */
export const maybeCompleteOAuth = async (): Promise<void> => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  if (!code || !codeVerifier) return;

  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        code,
        code_verifier: codeVerifier,
        redirect_uri: getRedirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    const tokenData: unknown = await tokenResp.json();
    const token = (tokenData as { access_token?: unknown }).access_token;
    if (typeof token !== 'string') return;

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
    console.error('Error completing Google OAuth:', err);
  } finally {
    sessionStorage.removeItem(CODE_VERIFIER_KEY);
    params.delete('code');
    params.delete('scope');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }
};
