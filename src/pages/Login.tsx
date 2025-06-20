import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { IconFile } from '../assets/Icons';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, error, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Call signUp and wait for the true/false result
    const success = await signIn(email, password);

    // Only navigate if the signup was successful
    if (success) {
      navigate('/dashboard');
    }
    // If it failed, do nothing. The `error` state in the store
    // will cause the error message to display in the UI.
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <IconFile className="mx-auto h-12 w-auto text-indigo-600" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
                Sign in to ClarityWrite
            </h2>
            <p className="mt-2 text-sm text-gray-600">
                Or{' '}
                <button onClick={() => navigate('/signup')} className="font-medium text-indigo-600 hover:text-indigo-500">
                    create a new account
                </button>
            </p>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-lg">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700 font-medium">{error}</div>
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default Login;