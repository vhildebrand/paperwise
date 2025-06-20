// src/pages/Signup.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { IconFile, IconCheckCircle, IconEnvelope, IconArrowPath } from '../assets/Icons';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, resendVerificationEmail, error, loading } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Call signUp and wait for the result
    const result = await signUp(email, password, name);

    // Handle the result
    if (result.success) {
      if (result.needsVerification) {
        // Show verification message instead of navigating
        setShowVerificationMessage(true);
      } else {
        // User is fully verified, navigate to dashboard
        navigate('/dashboard');
      }
    }
    // If it failed, do nothing. The `error` state in the store
    // will cause the error message to display in the UI.
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    
    const success = await resendVerificationEmail(email);
    
    if (success) {
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000); // Hide success message after 3 seconds
    }
    
    setResendLoading(false);
  };

  // If showing verification message, render that instead of the form
  if (showVerificationMessage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <IconEnvelope className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">
              Check your email
            </h2>
            <p className="text-gray-600">
              We've sent a verification link to <strong>{email}</strong>
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-2xl shadow-lg">
            <div className="space-y-6">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 mb-4">
                  <IconCheckCircle className="w-4 h-4 text-green-500" />
                  <span>Account created successfully</span>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                  Please check your email and click the verification link to complete your account setup. 
                  Once verified, you'll be able to create and manage your documents.
                </p>
              </div>
              
              {/* Resend verification section */}
              <div className="border-t border-gray-200 pt-6">
                <p className="text-sm text-gray-600 mb-4 text-center">
                  Didn't receive the email? Check your spam folder or resend the verification link.
                </p>
                <button
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? (
                    <>
                      <IconArrowPath className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <IconArrowPath className="w-4 h-4" />
                      Resend verification email
                    </>
                  )}
                </button>
                {resendSuccess && (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-green-600 font-medium">
                      Verification email sent successfully!
                    </p>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Sign in after verification
                </button>
                <button
                  onClick={() => setShowVerificationMessage(false)}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Back to signup
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <IconFile className="mx-auto h-12 w-auto text-indigo-600" />
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
                Create your account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
                Or{' '}
                <button onClick={() => navigate('/login')} className="font-medium text-indigo-600 hover:text-indigo-500">
                    sign in to an existing account
                </button>
            </p>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-lg">
            {/* The onSubmit handler is still async, but now correctly handles the flow */}
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700 font-medium">{error}</div>
                </div>
              )}
               <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Alex Doe"/>
              </div>
              <div>
                <label htmlFor="email-signup" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input id="email-signup" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="you@example.com"/>
              </div>
              <div>
                <label htmlFor="password-signup" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input id="password-signup" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="••••••••"/>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;