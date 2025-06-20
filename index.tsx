
/**
 * @file index.tsx
 * @description Entry point for the React application.
 */
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/app/App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
