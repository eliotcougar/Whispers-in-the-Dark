import type { SVGProps } from "react";
function SvgMap({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
  return (<svg
    fill="none"
    height={height}
    viewBox="0 0 24 24"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
          >
    <path
      d="M3 20V5l6-2v15zM9 18V3l6 2v15zM15 20V5l6 2v15z"
      stroke="currentColor"
      strokeWidth={1.2}
    />

    <path
      d="M9 3v15M15 5v15"
      stroke="#b6c2d1"
      strokeWidth={0.8}
    />

    <path
      d="M3 20V5l6-2 6 2 6 2v15l-6-2-6-2-6 2"
      stroke="currentColor"
      strokeWidth={1.2}
    />
  </svg>)
}
export default SvgMap;
