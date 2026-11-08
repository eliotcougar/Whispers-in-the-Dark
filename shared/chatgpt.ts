export interface ChatGPTProfile {
  readonly id: string;
  readonly label: string;
  readonly connected: boolean;
  readonly sharing: boolean;
}

export interface ChatGPTModel {
  readonly slug: string;
  readonly displayName: string;
}

export interface ChatGPTStatus {
  readonly profiles: Array<ChatGPTProfile>;
  readonly activeProfileId: string | null;
  readonly pending: boolean;
  readonly error: string | null;
}

export interface ChatGPTTextRequest {
  readonly model: string;
  readonly prompt: string;
  readonly instructions: string;
}

export interface ChatGPTTextResult {
  readonly text: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export const CHATGPT_USAGE_URL = 'https://chatgpt.com/settings/usage';
