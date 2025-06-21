import type { SVGProps } from "react";
function SvgCompanion({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
  return (<svg
    fill="currentColor"
    height={height}
    viewBox="0 0 20 20"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      clipRule="evenodd"
      d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-7 9a7 7 0 1 1 14 0z"
      fillRule="evenodd"
    />
  </svg>)
}
export default SvgCompanion;
