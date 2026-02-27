import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { Layout } from './components/Layout';
import { LoginPage } from './components/pages/LoginPage';
import { RegisterPage } from './components/pages/RegisterPage';
import { GuildPage } from './components/pages/GuildPage';
import { DirectMessagesPage } from './components/pages/DirectMessagesPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { InvitePage } from './components/pages/InvitePage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route
          path="/invite/:code"
          element={<InvitePage />}
        />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<DirectMessagesPage />} />
          <Route path="channels/@me" element={<DirectMessagesPage />} />
          <Route path="channels/@me/:conversationId" element={<DirectMessagesPage />} />
          <Route path="dm/:threadId" element={<DirectMessagesPage />} />
          <Route path="channels/:guildId" element={<GuildPage />} />
          <Route path="channels/:guildId/:channelId" element={<GuildPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}