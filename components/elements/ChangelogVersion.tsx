
interface ChangelogVersionProps {
  readonly title: string;
  readonly items: ReadonlyArray<string>;
}

function ChangelogVersion({ title, items }: ChangelogVersionProps) {
  return (
    <div>
      <h3 className="text-xl font-medium text-sky-400 mb-2">
        {title}
      </h3>

      <ul className="list-disc list-inside ml-4 space-y-1">
        {items.map(item => (
          <li key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ChangelogVersion;
