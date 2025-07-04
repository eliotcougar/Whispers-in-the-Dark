import type { SVGProps } from "react";
function SvgMenu({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
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
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>)
}
export default SvgMenu;
