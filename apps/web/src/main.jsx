import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/index.css';
import App from './app/App.jsx';
import { ThemeProvider } from './app/ThemeProvider.jsx';
import { LayoutProvider } from './app/LayoutProvider.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <LayoutProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </LayoutProvider>
    </ThemeProvider>
  </StrictMode>,
);
