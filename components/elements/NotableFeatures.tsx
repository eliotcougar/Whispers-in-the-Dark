import TextBox from './TextBox';

function NotableFeatures() {
  return (
    <TextBox
      contentFontClass="leading-relaxed space-y-3"
      header="Notable Features"
    >
      <p>
        <strong>
          Image Visualizer:
        </strong>

        {' '}
        Click the &quot;eye&quot; icon to generate an AI-powered image representing the current scene. It uses Imagen 3, and the daily quota is not very big. If you use it up, it will fall back to Gemini 2.0 Image Generation Preview
      </p>

      <p>
        <strong>
          Knowledge Base:
        </strong>

        {' '}
        Click the &quot;book&quot; icon to view details about all Places and Characters you&apos;ve discovered across different themes.
      </p>

      <p>
        <strong>
          History:
        </strong>

        {' '}
        This panel shows your Game Log and a summary of themes you&apos;ve previously experienced.
      </p>

      <p>
        <strong>
          Map Display:
        </strong>

        {' '}
        Use the map icon to view a dynamic graph of locations within the current theme, showing connections and your current position.
      </p>
    </TextBox>
  );
}

export default NotableFeatures;
