declare global {
  interface GoogleTokenClient {
    requestAccessToken: () => void;
  }

  interface GoogleOauth2 {
    initTokenClient: (config: {
      client_id: string;
      scope: string;
      callback: (resp: { access_token?: string; error?: string }) => void;
    }) => GoogleTokenClient;
  }

  interface GoogleAccounts {
    oauth2?: GoogleOauth2;
  }

  interface GoogleNamespace {
    accounts?: GoogleAccounts;
  }

  interface Window {
    google?: GoogleNamespace;
    GOOGLE_CLIENT_ID?: string;
  }
}

export {};
