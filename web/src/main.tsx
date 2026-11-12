import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { connectEmulators, isConfigured } from './lib/firebase';
import './styles.css';

if (isConfigured) connectEmulators();

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
