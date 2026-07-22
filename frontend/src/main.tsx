import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import './styles/axero.css';
import './styles/material-expressive.css';
import './styles/theme-overrides.css';
import './styles/sidebar-nav.css';
import './styles/admin-collaborators.css';
import './styles/documents.css';
import './styles/directory.css';
import './styles/announcements.css';
import './styles/collaborator.css';
import './styles/intranet-app.css';
import './styles/notifications.css';
import './styles/service-desk.css';
import './styles/meetings.css';
import './styles/events.css';
import './styles/requests.css';
import './styles/ti-inventory.css';
import './styles/learning.css';
import './styles/learning-manage.css';
import './styles/chat.css';
import './styles/org-chart.css';
import './styles/dashboard.css';
import './styles/intranet-responsive.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
