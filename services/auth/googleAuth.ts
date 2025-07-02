/**
 * @file services/auth/googleAuth.ts
 * @description Google OAuth helpers to fetch the user\'s Gemini API key.
 */
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { GOOGLE_CLIENT_ID } from '../../constants';
import { setApiKey } from '../apiClient';

const CODE_VERIFIER_KEY = 'whispersInTheDark_codeVerifier';

/** Returns true when a Google OAuth client ID is provided. */
export const isGoogleAuthAvailable = (): boolean => GOOGLE_CLIENT_ID.trim().length > 0;

const createOAuthClient = (): OAuth2Client =>
  new OAuth2Client({ clientId: GOOGLE_CLIENT_ID, redirectUri: window.location.origin + window.location.pathname });

/**
 * Starts the OAuth flow by redirecting the browser to the consent page.
 */
export const loginWithGoogle = async (): Promise<void> => {
  if (!isGoogleAuthAvailable()) {
    console.error('GOOGLE_CLIENT_ID is not configured; cannot use Google login.');
    return;
  }
  const client = createOAuthClient();
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  try {
    sessionStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);
  } catch {
    // ignore storage errors
  }
  const url = client.generateAuthUrl({
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    prompt: 'consent',
    access_type: 'online',
    code_challenge: codeChallenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });
  window.location.href = url;
};

/**
 * Handles a redirect from Google OAuth and fetches the user\'s API key.
 */
export const maybeCompleteOAuth = async (): Promise<void> => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const codeVerifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  if (!code || !codeVerifier) return;

  const client = createOAuthClient();
  try {
    const { tokens } = await client.getToken({ code, codeVerifier });
    const token = tokens.access_token;
    if (!token) return;
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
  } catch (err) {
    console.error('Error completing Google OAuth:', err);
  } finally {
    sessionStorage.removeItem(CODE_VERIFIER_KEY);
    params.delete('code');
    params.delete('scope');
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }
};
