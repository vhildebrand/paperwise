// src/pages/Landing.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconFile, IconSparkles, IconShieldCheck, IconFeather, IconCode, IconLatex, IconBrain, IconZap } from '../assets/Icons';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const features = [
    {
      icon: <IconBrain className="h-8 w-8 text-white" />,
      title: 'AI-Powered Writing Assistant',
      description: 'Get intelligent suggestions for grammar, style, and academic tone. Perfect your research papers with contextual feedback.',
    },
    {
      icon: <IconCode className="h-8 w-8 text-white" />,
      title: 'Markdown Support',
      description: 'Write with clean, distraction-free markdown syntax. Perfect for academic papers, research notes, and technical documentation.',
    },
    {
      icon: <IconLatex className="h-8 w-8 text-white" />,
      title: 'LaTeX Integration',
      description: 'Embed mathematical equations and scientific notation seamlessly. Ideal for STEM research and academic publications.',
    },
    {
      icon: <IconZap className="h-8 w-8 text-white" />,
      title: 'Real-time Collaboration',
      description: 'Work together with colleagues on research papers. Track changes and maintain version control for academic projects.',
    },
    {
      icon: <IconShieldCheck className="h-8 w-8 text-white" />,
      title: 'Academic Security',
      description: 'Your research and academic work is protected with enterprise-grade security. Cloud sync with end-to-end encryption.',
    },
    {
      icon: <IconFeather className="h-8 w-8 text-white" />,
      title: 'Distraction-Free Editor',
      description: 'Focus on your research with a clean, minimalist interface designed specifically for academic writing.',
    },
  ];

  const useCases = [
    {
      title: "Research Papers",
      description: "Write and format academic papers with proper citations and references",
      icon: "📄"
    },
    {
      title: "Thesis & Dissertations",
      description: "Manage large academic documents with structured chapters and sections",
      icon: "🎓"
    },
    {
      title: "Lab Reports",
      description: "Create detailed scientific reports with data analysis and conclusions",
      icon: "🧪"
    },
    {
      title: "Conference Papers",
      description: "Prepare submissions for academic conferences and journals",
      icon: "🏛️"
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
              <IconFile className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              PaperWise
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors duration-200"
            >
              Log In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-lg"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="relative py-20 sm:py-28 text-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-full opacity-20 animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200 to-indigo-200 rounded-full opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
          </div>
          
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight mb-6">
                The AI-Powered Academic
                <br />
                <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Writing Platform
                </span>
              </h2>
              <p className="mt-6 max-w-3xl mx-auto text-xl text-gray-600 leading-relaxed">
                Transform your academic writing with intelligent AI assistance, seamless markdown editing, 
                and powerful LaTeX support. Perfect for researchers, students, and academics.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={() => navigate('/signup')}
                  className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-xl shadow-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
                >
                  <IconSparkles className="w-5 h-5 mr-2" />
                  Start Writing for Free
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center px-8 py-4 border-2 border-gray-300 text-lg font-medium rounded-xl text-gray-700 bg-white hover:bg-gray-50 transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Log In to Continue
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Perfect for Academic Writing</h3>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Whether you're writing research papers, thesis documents, or lab reports, 
                PaperWise provides the tools you need to excel in your academic pursuits.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {useCases.map((useCase, index) => (
                <div 
                  key={index}
                  className="group bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-xl"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="text-4xl mb-4">{useCase.icon}</div>
                  <h4 className="text-xl font-semibold text-gray-900 mb-3">{useCase.title}</h4>
                  <p className="text-gray-600 leading-relaxed">{useCase.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 text-white relative overflow-hidden">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}></div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className="text-3xl font-bold tracking-tight mb-4">Everything You Need for Academic Excellence</h3>
              <p className="text-xl text-indigo-200 max-w-3xl mx-auto">
                Powerful features designed specifically for researchers, students, and academics 
                to enhance their writing productivity and quality.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div 
                  key={index} 
                  className="group text-center p-8 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-2"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-white/20 mx-auto mb-6 group-hover:bg-white/30 transition-all duration-300">
                    {feature.icon}
                  </div>
                  <h4 className="text-xl font-semibold mb-4">{feature.title}</h4>
                  <p className="text-indigo-200 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h3 className="text-3xl font-bold text-gray-900 mb-4">See PaperWise in Action</h3>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Experience the power of AI-assisted academic writing with our intuitive editor.
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <IconFile className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">Interactive Demo Coming Soon</p>
                  <p className="text-gray-500 text-sm mt-2">Experience the full editor with AI suggestions</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-20 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
          <div className="text-center max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-3xl font-bold tracking-tight mb-6">Ready to Transform Your Academic Writing?</h3>
            <p className="text-xl text-indigo-200 mb-8 max-w-2xl mx-auto">
              Join thousands of researchers, students, and academics who are already using PaperWise 
              to enhance their writing productivity and quality.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => navigate('/signup')}
                className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-lg font-medium rounded-xl text-white bg-transparent hover:bg-white hover:text-indigo-600 transition-all duration-200 transform hover:scale-105"
              >
                <IconSparkles className="w-5 h-5 mr-2" />
                Get Started Free
              </button>
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-xl text-indigo-600 bg-white hover:bg-gray-100 transition-all duration-200 transform hover:scale-105"
              >
                Log In Now
              </button>
            </div>
            <p className="text-indigo-200 text-sm mt-6">No credit card required • Free forever for basic use</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                  <IconFile className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold">PaperWise</h3>
              </div>
              <p className="text-gray-400 max-w-md">
                The AI-powered academic writing platform designed for researchers, students, and academics.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} PaperWise. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;