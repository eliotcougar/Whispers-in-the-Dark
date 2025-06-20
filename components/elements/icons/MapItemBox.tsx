import type { SVGProps } from "react";
function SvgMapItemBox({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
  return (<svg
    fill="none"
    height={height}
    stroke="currentColor"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
          >
    <path
      d="m12 3 9 4.5-9 4.5-9-4.5z"
      fill="#f8e7c0"
      strokeLinejoin="round"
    />

    <path
      d="m3 7.5 9 4.5v9l-9-4.5zM21 7.5 12 12v9l9-4.5z"
      fill="#e2c48d"
      strokeLinejoin="round"
    />

    <path
      d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3"
      strokeLinejoin="round"
    />
  </svg>)
}
export default SvgMapItemBox;
