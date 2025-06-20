import type { SVGProps } from "react";
function SvgTrash({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
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
      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12.56 0c1.153 0 2.243.032 3.223.094M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>)
}
export default SvgTrash;
