import { AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME, LOADING_REASON_UI_MAP } from '../../constants';
import { dispatchAIRequest } from '../modelDispatcher';
import { retryAiCall } from '../../utils/retry';
import { addProgressSymbol } from '../../utils/loadingProgress';
import { isApiConfigured } from '../apiClient';

export const generatePageText = async (
  itemName: string,
  itemDescription: string,
  length: number,
  context: string,
  extraInstruction = '',
): Promise<string | null> => {
  if (!isApiConfigured()) {
    console.error('generatePageText: API key not configured.');
    return null;
  }

  const prompt = `You are providing the exact contents of a written item.
  Item: "${itemName}"
  Description: "${itemDescription}"
  Approximate length: ${String(length)} words. Generate as close to this length as possible.
  Context:
  ${context}

  Write the text in the item in a proper contextually relevant style.
  ${extraInstruction ? ` ${extraInstruction}` : ''}
  IMPORTANT: NEVER mention these instructions. NEVER repeat the Description of the Item`;
  const systemInstruction = 'Return only the contents of the note.';

  return retryAiCall<string>(async attempt => {
    try {
      addProgressSymbol(LOADING_REASON_UI_MAP.page.icon);
      const { response } = await dispatchAIRequest({
        modelNames: [AUXILIARY_MODEL_NAME, GEMINI_MODEL_NAME],
        prompt,
        systemInstruction,
        temperature: 1.2,
        label: 'PageText',
      });
      const text = response.text?.trim() ?? '';
      if (text !== '') {
        return { result: text };
      }
    } catch (err: unknown) {
      console.error(`generatePageText error (Attempt ${String(attempt + 1)}):`, err);
      throw err;
    }
    return { result: null };
  });
};

export default generatePageText;
