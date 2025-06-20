import type { SVGProps } from "react";
function SvgRealityShift({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
  return (<svg
    fill="none"
    height={height}
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
          >
    <path
      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L1.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.25 12 17 13.75 15.75 12H13.5l1.25-1.25L16 9l1.25 1.75zM16 16.75l.813 2.846L15 18.75l-.813 2.846-.812-2.846-1.5.938L14.063 18l-1.188-1.5.938-1.5 1.188 1.5-1.188 1.5z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>)
}
export default SvgRealityShift;
