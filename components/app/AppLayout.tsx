import type { ChangeEvent, ComponentProps, ReactNode, RefObject } from 'react';
import AppHeader from './AppHeader';
import ErrorDisplay from '../ErrorDisplay';
import ItemChangeAnimator from '../inventory/ItemChangeAnimator';
import Footer from './Footer';

interface ErrorBanner {
  readonly id: string;
  readonly isVisible: boolean;
  readonly message: string;
  readonly handleRetry: () => void;
}

interface FileInputProps {
  readonly accept: string;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly inputRef: RefObject<HTMLInputElement | null>;
}

interface AppLayoutProps {
  readonly headerProps: ComponentProps<typeof AppHeader>;
  readonly errorBanners: Array<ErrorBanner>;
  readonly isBlurred: boolean;
  readonly children: ReactNode;
  readonly itemAnimatorProps: ComponentProps<typeof ItemChangeAnimator>;
  readonly footerProps: ComponentProps<typeof Footer>;
  readonly fileInputProps: FileInputProps;
}

function AppLayout({
  headerProps,
  errorBanners,
  isBlurred,
  children,
  itemAnimatorProps,
  footerProps,
  fileInputProps,
}: AppLayoutProps) {
  const visibleBanners = errorBanners.filter(banner => banner.isVisible);
  const { hasGameBeenInitialized, theme } = headerProps;
  const {
    currentTurnNumber,
    isGameBusy,
    lastTurnChanges,
  } = itemAnimatorProps;
  const {
    isBlurred: isFooterBlurred,
    isDebugViewVisible,
    setIsDebugViewVisible,
  } = footerProps;
  const {
    accept,
    onChange: handleFileInputChange,
    inputRef,
  } = fileInputProps;

  return (
    <>
      <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 flex flex-col items-center">
        <AppHeader
          hasGameBeenInitialized={hasGameBeenInitialized}
          theme={theme}
        />

        {visibleBanners.map(banner => (
          <div
            className="w-full max-w-3xl my-4"
            key={banner.id}
          >
            <ErrorDisplay
              message={banner.message}
              onRetry={banner.handleRetry}
            />
          </div>
        ))}

        <main className={`w-full max-w-screen-xl grid grid-cols-1 lg:grid-cols-4 gap-3 flex-grow ${isBlurred ? 'filter blur-sm pointer-events-none' : ''}`}>
          {children}
        </main>

        <ItemChangeAnimator
          currentTurnNumber={currentTurnNumber}
          isGameBusy={isGameBusy}
          lastTurnChanges={lastTurnChanges}
        />

        <Footer
          isBlurred={isFooterBlurred}
          isDebugViewVisible={isDebugViewVisible}
          setIsDebugViewVisible={setIsDebugViewVisible}
        />
      </div>

      <input
        accept={accept}
        aria-hidden="true"
        className="hidden"
        onChange={handleFileInputChange}
        ref={inputRef}
        type="file"
      />
    </>
  );
}

export default AppLayout;
