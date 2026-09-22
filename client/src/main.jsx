import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppProvider } from './hooks/useApp';
import { useTheme } from './hooks/useTheme';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';
function ThemedToaster() { const { theme } = useTheme(); return <Toaster position="bottom-right" richColors theme={theme}/>; }
createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><BrowserRouter><AppProvider><App/><ThemedToaster/></AppProvider></BrowserRouter></ErrorBoundary></React.StrictMode>);
