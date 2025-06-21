// src/components/CitationModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import { BookOpenIcon, XMarkIcon } from '@heroicons/react/24/solid'; // Using BookOpenIcon
import { Transition } from '@headlessui/react';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => Promise<void>;
  position?: { top: number; left: number } | null;
}

const CitationModal: React.FC<CitationModalProps> = ({ isOpen, onClose, onSubmit, position }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setQuery('');
      setIsLoading(false);
      // Focus the input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    await onSubmit(query);
    // The parent component will handle closing the modal
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <Transition
      show={isOpen}
      enter="transition ease-out duration-200"
      enterFrom="opacity-0 scale-95"
      enterTo="opacity-100 scale-100"
      leave="transition ease-in duration-150"
      leaveFrom="opacity-100 scale-100"
      leaveTo="opacity-0 scale-95"
    >
      <div 
        className="fixed z-50"
        style={{
          top: position?.top || '50%',
          left: position?.left || '50%',
          transform: 'translate(-50%, -50%)',
          width: '360px',
        }}
      >
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpenIcon className="w-5 h-5 text-white" />
              <h3 className="text-white font-semibold text-sm">Generate Citation</h3>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4">
            <div className="space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                Describe a source (e.g., "The Pragmatic Programmer book by Hunt and Thomas" or a DOI/URL).
              </p>

              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-gray-400 resize-none"
                  placeholder="e.g., The Catcher in the Rye"
                  rows={3}
                  disabled={isLoading}
                />
                {isLoading && (
                  <div className="absolute right-3 top-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  </div>
                )}
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  );
};

export default CitationModal;