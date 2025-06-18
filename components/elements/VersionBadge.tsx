interface VersionBadgeProps {
  readonly version: string;
  readonly className?: string;
}

function VersionBadge({ version, className = '' }: VersionBadgeProps) {
  return (
    <span className={`text-xs text-slate-500 ${className}`}>
      {'Version: ' + version}
    </span>
  );
}

VersionBadge.defaultProps = {
  className: '',
};

export default VersionBadge;
