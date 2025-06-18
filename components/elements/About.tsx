import TextBox from './TextBox';

function About() {
  return (
    <TextBox
      contentFontClass="leading-relaxed"
      header='About "Whispers in the Dark"'
    >
      <p>
        Welcome to &quot;Whispers in the Dark,&quot; an AI-powered text adventure game where you navigate a constantly shifting reality.
        Your choices directly shape your fate as you uncover secrets, manage your inventory, and survive the challenges
        presented by an enigmatic Dungeon Master, powered by Google&apos;s Gemini AI. Each reality shift brings a new theme,
        new quests, and new dangers. You can also choose to start a &quot;Custom Game&quot; in a specific theme with random reality shifts disabled.
      </p>
    </TextBox>
  );
}

export default About;
