interface VersionBadgeProps {
  readonly version: string;
}

function VersionBadge({ version}: VersionBadgeProps) {
  return (
    <span className='text-xs text-slate-500 absolute bottom-4 right-4'>
      {'Version: ' + version}
    </span>
  );
}

VersionBadge.defaultProps = {
};

export default VersionBadge;
