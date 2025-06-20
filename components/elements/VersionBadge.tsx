interface VersionBadgeProps {
  readonly version: string;
}

function VersionBadge({ version}: VersionBadgeProps) {
  return (
    <span className='text-sm text-slate-300 absolute bottom-4 right-4'>
      {'Version: ' + version}
    </span>
  );
}

VersionBadge.defaultProps = {
};

export default VersionBadge;
