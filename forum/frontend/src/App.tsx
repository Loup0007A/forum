import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForumHome from './pages/ForumHome';
import ForumPage from './pages/ForumPage';
import ThreadPage from './pages/ThreadPage';
import NewThreadPage from './pages/NewThreadPage';
import ProfilePage from './pages/ProfilePage';
import MessagesPage from './pages/MessagesPage';
import AdminPage from './pages/AdminPage';
import SearchPage from './pages/SearchPage';

// Layout
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" state={{ from: location }} replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user || !['MODERATOR', 'ADMIN'].includes(user.role)) {
    return <Navigate to="/forum" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { checkAuth, user, isLoading } = useAuthStore();
  useSocket(); // Initialize socket when logged in

  useEffect(() => { checkAuth(); }, []);

  if (isLoading) return <LoadingScreen />;

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={user ? <Navigate to="/forum" replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/forum" replace /> : <RegisterPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/forum" element={<ForumHome />} />
        <Route path="/forum/:slug" element={<ForumPage />} />
        <Route path="/thread/:slug" element={<ThreadPage />} />
        <Route path="/new-thread/:forumId" element={<NewThreadPage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/admin/*" element={<AdminRoute><AdminPage /></AdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
