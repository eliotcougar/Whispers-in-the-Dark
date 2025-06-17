
/**
 * @file Collection of small React components rendering SVG icons used across
 * the user interface.
 */
import * as React from 'react';

/** Icon used for performing a manual reality shift. */
export const RealityShiftIcon: React.FC<{ readonly className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L1.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.25 12L17 13.75l-1.25-1.75L13.5 12l1.25-1.25L16 9l1.25 1.75L18.25 12zM16 16.75l.813 2.846L15 18.75l-.813 2.846L13.375 18.75l-1.5.938L14.063 18l-1.188-1.5.938-1.5 1.188 1.5-1.188 1.5z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Icon showing an in-game currency coin. */
export const CoinIcon: React.FC<{ readonly className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.25 7.756a4.5 4.5 0 1 0 0 8.488M7.5 10.5h5.25m-5.25 3h5.25M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Icon button for opening the visualizer. */
export const VisualizeIcon: React.FC<{ readonly className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" strokeLinecap="round" strokeLinejoin="round" />

    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Icon representing the knowledge base book. */
export const BookOpenIcon: React.FC<{ readonly className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6-2.292m0 0V3.75m0 16.5V18" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Icon for toggling menus. */
export const MenuIcon: React.FC<{ readonly className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Icon that opens the info modal. */
export const InfoIcon: React.FC<{ readonly className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Icon representing stored theme memories. */
export const ScrollIcon: React.FC<{ readonly className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Icon used to open the map view. */
export const MapIcon: React.FC<{ readonly className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    {/* Left panel */}
    <polygon fill="none" points="3,20 3,5 9,3 9,18" stroke="currentColor" strokeWidth="1.2" />

    {/* Center panel */}
    <polygon fill="none" points="9,18 9,3 15,5 15,20" stroke="currentColor" strokeWidth="1.2" />

    {/* Right panel */}
    <polygon fill="none" points="15,20 15,5 21,7 21,22" stroke="currentColor" strokeWidth="1.2" />

    {/* Fold lines */}
    <line stroke="#b6c2d1" strokeWidth="0.8" x1="9" x2="9" y1="3" y2="18" />

    <line stroke="#b6c2d1" strokeWidth="0.8" x1="15" x2="15" y1="5" y2="20" />

    {/* Outline */}
    <polyline fill="none" points="3,20 3,5 9,3 15,5 21,7 21,22 15,20 9,18 3,20" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

/** Icon representing the player's inventory. */
export const InventoryIcon: React.FC = () => (
  <svg className="h-5 w-5 mr-2 inline-block text-amber-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v2h2a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h2V4zm0 4v10h10V8H5zm2-2h6V4H7v2z" />
  </svg>
);

/** Trash can icon for discarding items. */
export const TrashIcon: React.FC<{ readonly className?: string }> = ({ className = "w-4 h-4 inline-block mr-1" }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12.56 0c1.153 0 2.243.032 3.223.094M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Icon representing the game log. */
export const LogIcon: React.FC = () => (
  <svg className="h-5 w-5 mr-2 inline-block text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Icon representing a companion character. */
export const CompanionIcon: React.FC<{ readonly className?: string }> = ({ className = "h-4 w-4 inline-block mr-1 text-green-400" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
  </svg>
);

/** Icon indicating a nearby NPC. */
export const NearbyNPCIcon: React.FC<{ readonly className?: string }> = ({ className = "h-4 w-4 inline-block mr-1 text-sky-400" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path clipRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" fillRule="evenodd" />

    <path d="M6.605 13.688a.5.5 0 01.707-.707 4.5 4.5 0 006.364 0 .5.5 0 01.707.707 5.5 5.5 0 01-7.778 0z" />

    <path d="M3.732 11.268a.5.5 0 01.707-.707 7.5 7.5 0 0010.607 0 .5.5 0 01.707.707 8.5 8.5 0 01-11.02 0 .502.502 0 01-.001-.001zM1.121 8.146a.5.5 0 01.707-.707c3.453-3.453 9.013-3.453 12.466 0a.5.5 0 01-.707.707c-2.94-2.94-7.819-2.94-10.759 0a.5.5 0 01-.707-.707A.5.5 0 011.12 8.146z" />
  </svg>
);

/** Small icon of an isometric box for map item indicators. */
export const MapItemBoxIcon: React.FC<{ readonly className?: string; readonly size?: number }> = ({ className = '', size = 12 }) => (
  <svg
    className={className}
    fill="none"
    height={size}
    stroke="currentColor"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Top face */}
    <polygon fill="#f8e7c0" points="12,3 21,7.5 12,12 3,7.5" stroke="currentColor" strokeLinejoin="round" />

    {/* Left face */}
    <polygon fill="#e2c48d" points="3,7.5 12,12 12,21 3,16.5" stroke="currentColor" strokeLinejoin="round" />

    {/* Right face */}
    <polygon fill="#e2c48d" points="21,7.5 12,12 12,21 21,16.5" stroke="currentColor" strokeLinejoin="round" />

    {/* Box outline */}
    <polyline fill="none" points="12,3 21,7.5 21,16.5 12,21 3,16.5 3,7.5 12,3" stroke="currentColor" strokeLinejoin="round" />

  </svg>
);

/** Small wheel icon for vehicle indicators on the map. */
export const MapWheelIcon: React.FC<{ readonly className?: string; readonly size?: number }> = ({ className = '', size = 12 }) => (
  <svg
    className={className}
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Rim */}
    <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="2" />

    {/* Central hub */}
    <circle cx="12" cy="12" fill="currentColor" r="4" strokeWidth="0" />

    {/* 4 Spokes */}
    <g stroke="currentColor" strokeWidth="2">
      <line x1="12" x2="12" y1="12" y2="2" />

      <line x1="12" x2="20.142" y1="12" y2="17.071" />

      <line x1="12" x2="12" y1="12" y2="22" />

      <line x1="12" x2="3.858" y1="12" y2="17.071" />
    </g>
  </svg>
);
