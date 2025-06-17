import React from 'react';
import { DEVELOPER } from '../../constants';

interface FooterProps {
  isBlurred: boolean;
  isDebugViewVisible: boolean;
  setIsDebugViewVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const Footer: React.FC<FooterProps> = ({
  isBlurred,
  isDebugViewVisible,
  setIsDebugViewVisible,
}) => (
  <footer
    className={`w-full max-w-screen-xl mt-12 text-center text-slate-500 text-sm ${
      isBlurred ? 'filter blur-sm pointer-events-none' : ''
    }`}
  >
    <div className="flex justify-between items-center">
      <p className="text-left">
        &copy; {new Date().getFullYear()}. Developed by {DEVELOPER}, Codex, and

        Gemini. <br />Powered by Gemini.
      </p>

      <button
        aria-label="Open Debug View"
        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs rounded shadow-md transition-colors"
        onClick={() => setIsDebugViewVisible(!isDebugViewVisible)}
      >
        Debug
      </button>
    </div>
  </footer>
);

export default Footer;
