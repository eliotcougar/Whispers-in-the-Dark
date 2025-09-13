import type { SVGProps } from 'react';

function SvgCoin({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      height={height}
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
      width={width}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8.25l3 3.75-3 3.75-3-3.75 3-3.75Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default SvgCoin;
