import type { SVGProps } from 'react';
function SvgJournalPen({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
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
        d="M16.862 3.487a1.125 1.125 0 0 1 1.591 1.591l-9 9a1.125 1.125 0 0 1-.433.266L6 15l.656-2.976a1.125 1.125 0 0 1 .266-.433l9-9Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M19.5 10.5V18A2.25 2.25 0 0 1 17.25 20.25H6.75A2.25 2.25 0 0 1 4.5 18V6.75A2.25 2.25 0 0 1 6.75 4.5H14.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export default SvgJournalPen;
