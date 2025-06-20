import type { SVGProps } from "react";
function SvgInventory({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
  return (<svg
    fill="currentColor"
    height={height}
    viewBox="0 0 20 20"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
          >
    <path d="M5 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2zm0 4v10h10V8zm2-2h6V4H7z" />
  </svg>)
}
export default SvgInventory;
