import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/auth';

export function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const data = await api.register(username, password, displayName || undefined);
      login(data.user, data.token, data.matrixAccessToken, data.matrixDeviceId);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-tertiary p-4">
      <div className="w-full max-w-md rounded-lg bg-background-secondary p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-text-normal">Create an account</h1>
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
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              className="input"
              placeholder="your_username"
              pattern="[a-z0-9_-]+"
              required
            />
            <p className="mt-1 text-xs text-text-muted">
              Only lowercase letters, numbers, underscores, and hyphens
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-text-muted">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input"
              placeholder="How others will see you"
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
              minLength={8}
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-text-muted">
              Confirm Password <span className="text-text-danger">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full py-3"
          >
            {isLoading ? 'Creating account...' : 'Continue'}
          </button>

          <p className="text-sm text-text-muted">
            <Link to="/login" className="text-text-link hover:underline">
              Already have an account?
            </Link>
          </p>

          <p className="text-xs text-text-muted">
            By registering, you agree to Conact's Terms of Service and Privacy Policy.
          </p>
        </form>
      </div>
    </div>
  );
}
