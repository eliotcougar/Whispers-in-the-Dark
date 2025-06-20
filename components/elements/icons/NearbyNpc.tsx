import type { SVGProps } from "react";
function SvgNearbyNpc({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
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

    <path d="M6.605 13.688a.5.5 0 0 1 .707-.707 4.5 4.5 0 0 0 6.364 0 .5.5 0 0 1 .707.707 5.5 5.5 0 0 1-7.778 0" />

    <path d="M3.732 11.268a.5.5 0 0 1 .707-.707 7.5 7.5 0 0 0 10.607 0 .5.5 0 0 1 .707.707 8.5 8.5 0 0 1-11.02 0l-.001-.001zM1.121 8.146a.5.5 0 0 1 .707-.707 8.796 8.796 0 0 1 12.466 0 .5.5 0 0 1-.707.707c-2.94-2.94-7.819-2.94-10.759 0a.5.5 0 0 1-.707-.707.5.5 0 0 1-1.001.707z" />
  </svg>)
}
export default SvgNearbyNpc;
