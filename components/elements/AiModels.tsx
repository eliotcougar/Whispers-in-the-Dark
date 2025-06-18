import TextBox from './TextBox';
import { GEMINI_MODEL_NAME } from '../../constants';

function AiModels() {
  const textModel = GEMINI_MODEL_NAME;
  const imageModel = 'imagen-3.0-generate-002';
  const fallbackImageModel = 'gemini-2.0-flash-preview-image-generation';

  return (
    <TextBox
      contentFontClass="leading-relaxed space-y-3"
      header="AI Models & Disclaimers"
    >
      <p>
        This game is powered by Google&apos;s Gemini large language models:
      </p>

      <ul className="list-disc list-inside ml-4">
        <li>
          Text Generation: 
          {' '}

          <strong>
            {textModel}
          </strong>
        </li>

        <li>
          Image Generation: 
          {' '}

          <strong>
            {imageModel}
          </strong>

          {' '}

          <em className="text-sm">
            (fallback
            {fallbackImageModel}
            )
          </em>
        </li>
      </ul>

      <p>
        <strong>
          AI Unpredictability:
        </strong>

        {' '}
        As with any generative AI, the responses can sometimes be unpredictable, creative in unexpected ways, or may not perfectly adhere to all instructions or context. This is part of the charm and challenge of an AI-driven adventure!
      </p>

      <p>
        <strong>
          API Quotas:
        </strong>

        {' '}
        The use of these AI models is subject to API call limits and quotas. If you (or the environment this app is running in) exceed these daily quotas, the game&apos;s AI features (text generation, image visualization) may temporarily stop working until the quota resets.
      </p>
    </TextBox>
  );
}

export default AiModels;
