import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

import { registerServiceWorker } from './serviceWorker';

createRoot(document.getElementById('root')!).render(
  <App />
);

registerServiceWorker();

