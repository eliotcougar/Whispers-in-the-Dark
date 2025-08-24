interface BackstoryItemProps {
  readonly label: string;
  readonly text: string;
}

function BackstoryItem({ label, text }: BackstoryItemProps) {
  return (
    <p>
      <span className="font-semibold text-sky-300">
        {label}
      </span>
      {': '}
      {text}
    </p>
  );
}

export default BackstoryItem;
