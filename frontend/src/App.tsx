import { useAuth } from './hooks/useAuth';
import AuthScreen from './components/auth/AuthScreen';
import AppLayout from './components/layout/AppLayout';

export default function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return <AppLayout />;
}
