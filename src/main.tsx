import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { installAuthorizedFetch } from './lib/auth';
import { initializeTheme } from './lib/theme';

installAuthorizedFetch();
initializeTheme();

createRoot(document.getElementById('root')!).render(
  <App />,
);
