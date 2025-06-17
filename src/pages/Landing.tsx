// src/pages/Landing.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IconFile, IconSparkles, IconShieldCheck, IconFeather } from '../assets/Icons'; // Assuming you add these new icons to your Icons.tsx file

const Landing: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <IconSparkles className="h-8 w-8 text-white" />,
      title: 'AI-Powered Suggestions',
      description: 'Get real-time feedback on grammar, spelling, style, and clarity to refine your writing effortlessly.',
    },
    {
      icon: <IconFeather className="h-8 w-8 text-white" />,
      title: 'Distraction-Free Editor',
      description: 'A clean, intuitive interface that lets you focus on what matters most: your words.',
    },
    {
      icon: <IconShieldCheck className="h-8 w-8 text-white" />,
      title: 'Secure Cloud Sync',
      description: 'Your documents are saved securely in the cloud and accessible from anywhere, anytime.',
    },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <IconFile className="h-8 w-8 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">ClarityWrite</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="py-20 sm:py-28 text-center bg-gray-50/70">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight">
              Elevate Your Writing. <span className="text-indigo-600">Effortlessly.</span>
            </h2>
            <p className="mt-6 max-w-2xl mx-auto text-lg text-gray-600">
              ClarityWrite is your AI-powered partner for crafting clear, compelling, and error-free documents. Go from rough draft to polished prose in record time.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <button
                onClick={() => navigate('/signup')}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                Get Started for Free
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Log In
              </button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 sm:py-24 bg-indigo-700 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h3 className="text-3xl font-bold tracking-tight">Everything You Need to Write with Confidence</h3>
              <p className="mt-4 text-lg text-indigo-200">
                Powerful features designed to help you shine.
              </p>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12">
              {features.map((feature, index) => (
                <div key={index} className="text-center">
                  <div className="flex items-center justify-center h-16 w-16 rounded-xl bg-indigo-500 mx-auto mb-6">
                    {feature.icon}
                  </div>
                  <h4 className="text-xl font-semibold">{feature.title}</h4>
                  <p className="mt-2 text-indigo-200">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-20 sm:py-28 bg-gray-50/70">
            <div className="text-center max-w-3xl mx-auto">
                <h3 className="text-3xl font-bold tracking-tight text-gray-900">Ready to Transform Your Writing?</h3>
                <p className="mt-4 text-lg text-gray-600">Create an account and start writing with clarity today. No credit card required.</p>
                <div className="mt-8">
                     <button
                        onClick={() => navigate('/signup')}
                        className="inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-lg font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                    >
                        Sign Up Now
                    </button>
                </div>
            </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} ClarityWrite. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;