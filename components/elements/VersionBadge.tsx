interface VersionBadgeProps {
  readonly version: string;
  readonly sourceInfo?: string;
}

function VersionBadge({ version, sourceInfo }: VersionBadgeProps) {
  return (
    <span className='text-sm text-slate-300 absolute bottom-4 right-4'>
      {'Version: ' + version}
      {sourceInfo ? ` – ${sourceInfo}` : null}
    </span>
  );
}

VersionBadge.defaultProps = {
  sourceInfo: undefined,
};

export default VersionBadge;
