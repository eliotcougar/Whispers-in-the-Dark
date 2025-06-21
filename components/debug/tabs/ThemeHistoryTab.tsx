import DebugSection from '../DebugSection';
import type { ThemeHistoryState } from '../../../types';

interface ThemeHistoryTabProps {
  readonly themeHistory: ThemeHistoryState;
}

function ThemeHistoryTab({ themeHistory }: ThemeHistoryTabProps) {
  return (<DebugSection
    content={themeHistory}
    maxHeightClass="max-h-[70vh]"
    title="Current Theme History"
  />)
}

export default ThemeHistoryTab;
