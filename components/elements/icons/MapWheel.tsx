import type { SVGProps } from "react";
function SvgMapWheel({ height = '1em', width = '1em' }: SVGProps<SVGSVGElement>) {
  return (<svg
    fill="none"
    height={height}
    viewBox="0 0 24 24"
    width={width}
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx={12}
      cy={12}
      r={10}
      stroke="currentColor"
      strokeWidth={2}
    />

    <circle
      cx={12}
      cy={12}
      fill="currentColor"
      r={4}
    />

    <g
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 12V2M12 12l8.142 5.071M12 12v10M12 12l-8.142 5.071" />
    </g>
  </svg>)
}
export default SvgMapWheel;
