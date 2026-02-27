import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await api.login(username, password);
      login(data.user, data.token, data.matrixAccessToken, data.matrixDeviceId);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-tertiary p-4">
      <div className="w-full max-w-md rounded-lg bg-background-secondary p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-text-normal">Welcome back!</h1>
          <p className="mt-2 text-text-muted">We're so excited to see you again!</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded bg-text-danger/10 p-3 text-sm text-text-danger">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-text-muted">
              Username <span className="text-text-danger">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-text-muted">
              Password <span className="text-text-danger">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
            <Link
              to="/forgot-password"
              className="mt-1 block text-sm text-text-link hover:underline"
            >
              Forgot your password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full py-3"
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>

          <p className="text-sm text-text-muted">
            Need an account?{' '}
            <Link to="/register" className="text-text-link hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
