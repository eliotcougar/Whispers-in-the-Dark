import type { FC } from 'react';

interface VersionBadgeProps {
  readonly version: string;
  readonly className?: string;
}

const VersionBadge: FC<VersionBadgeProps> = ({ version, className = '' }) => (
  <span className={`text-xs text-slate-500 ${className}`}>
    Version:
    {' '}

    {version}
  </span>
);

VersionBadge.defaultProps = { className: '' };

export default VersionBadge;
