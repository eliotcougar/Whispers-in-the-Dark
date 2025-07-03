interface VersionBadgeProps {
  readonly version: string;
  readonly sourceInfo?: string;
}

function VersionBadge({ version, sourceInfo }: VersionBadgeProps) {
  return (
    <p className='text-sm text-slate-300 absolute bottom-4 right-4'>
      <span>{'Version: ' + version}</span>

      <br />

      <span>{sourceInfo ? `${sourceInfo}` : null}</span>
    </p>
  );
}

VersionBadge.defaultProps = {
  sourceInfo: undefined,
};

export default VersionBadge;
