// src/components/EditorToolbar.tsx
import React, { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon, SparklesIcon } from '@heroicons/react/24/outline';
import {
  IconBold, IconItalic, IconUnderline, IconList, IconListOrdered,
  IconH1, IconH2, IconBlockquote, IconCode, IconSaveStatus
} from '../assets/Icons';

interface Props {
  editor: Editor | null;
  analysisStatus: 'idle' | 'analyzing' | 'complete' | 'error';
  selectedTone: string;
  onToneChange: (tone: string) => void;
  onAIRewrite: () => void;
  onTestSuggestions?: () => void;
}

const ToolbarButton = ({ onClick, disabled, title, isActive, children, className = "" }: any) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`p-2 rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-800 data-[active=true]:bg-indigo-100 data-[active=true]:text-indigo-600 disabled:opacity-50 transition-colors ${className}`}
        data-active={isActive}
    >
        {children}
    </button>
);

const Divider = () => <div className="w-px h-6 bg-gray-300 mx-2"></div>;

const ToneSelector = ({ selectedTone, onToneChange }: { selectedTone: string; onToneChange: (tone: string) => void }) => {
  const tones = [
    { value: 'formal', label: 'Formal', description: 'Professional and academic' },
    { value: 'friendly', label: 'Friendly', description: 'Casual and approachable' },
    { value: 'creative', label: 'Creative', description: 'Expressive and artistic' },
    { value: 'technical', label: 'Technical', description: 'Precise and detailed' },
    { value: 'conversational', label: 'Conversational', description: 'Natural and engaging' }
  ];

  const currentTone = tones.find(t => t.value === selectedTone) || tones[0];

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        <span className="hidden sm:inline">Tone:</span>
        <span className="sm:ml-1 font-medium">{currentTone.label}</span>
        <ChevronDownIcon className="w-4 h-4 ml-2" />
      </Menu.Button>
      <Transition
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg focus:outline-none">
          <div className="py-1">
            {tones.map((tone) => (
              <Menu.Item key={tone.value}>
                {({ active }) => (
                  <button
                    onClick={() => onToneChange(tone.value)}
                    className={`${
                      active ? 'bg-gray-100' : ''
                    } ${
                      selectedTone === tone.value ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                    } block w-full text-left px-4 py-2 text-sm`}
                  >
                    <div className="font-medium">{tone.label}</div>
                    <div className="text-xs text-gray-500">{tone.description}</div>
                  </button>
                )}
              </Menu.Item>
            ))}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

const AIRewriteModal = ({ isOpen, onClose, onAction }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onAction: (action: 'paraphrase' | 'shorten' | 'expand') => void;
}) => {
  if (!isOpen) return null;

  const actions = [
    { key: 'paraphrase', label: 'Paraphrase', description: 'Rewrite with different words', icon: '🔄' },
    { key: 'shorten', label: 'Shorten', description: 'Make it more concise', icon: '✂️' },
    { key: 'expand', label: 'Expand', description: 'Add more detail and context', icon: '📝' }
  ] as const;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                <SparklesIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  AI Rewrite Options
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Choose how you'd like to rewrite the selected text:
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {actions.map((action) => (
                <button
                  key={action.key}
                  onClick={() => onAction(action.key)}
                  className="w-full flex items-center p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-2xl mr-3">{action.icon}</span>
                  <div>
                    <div className="font-medium text-gray-900">{action.label}</div>
                    <div className="text-sm text-gray-500">{action.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditorToolbar: React.FC<Props> = ({ 
  editor, 
  analysisStatus, 
  selectedTone, 
  onToneChange, 
  onAIRewrite,
  onTestSuggestions
}) => {
  const [showAIRewriteModal, setShowAIRewriteModal] = useState(false);

  if (!editor) {
    return null;
  }

  const handleAIRewrite = () => {
    const { from, to } = editor.state.selection;
    if (from === to) {
      // No text selected, show modal
      setShowAIRewriteModal(true);
    } else {
      // Text selected, trigger rewrite
      onAIRewrite();
    }
  };

  return (
    <>
      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 sm:px-6 py-2 z-20">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Left side - Formatting tools */}
          <div className="flex items-center space-x-1 flex-wrap">
            {/* Text formatting */}
            <div className="flex items-center space-x-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                isActive={editor.isActive('bold')}
                title="Bold (Ctrl+B)"
              >
                <IconBold />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                isActive={editor.isActive('italic')}
                title="Italic (Ctrl+I)"
              >
                <IconItalic />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                disabled={!editor.can().chain().focus().toggleUnderline().run()}
                isActive={editor.isActive('underline')}
                title="Underline (Ctrl+U)"
              >
                <IconUnderline />
              </ToolbarButton>
            </div>

            <Divider />

            {/* Headings */}
            <div className="flex items-center space-x-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                isActive={editor.isActive('heading', { level: 1 })}
                title="Heading 1"
              >
                <IconH1 />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                isActive={editor.isActive('heading', { level: 2 })}
                title="Heading 2"
              >
                <IconH2 />
              </ToolbarButton>
            </div>

            <Divider />
            
            {/* Lists and blocks */}
            <div className="flex items-center space-x-1">
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                isActive={editor.isActive('bulletList')}
                title="Bullet List"
              >
                <IconList />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                isActive={editor.isActive('orderedList')}
                title="Numbered List"
              >
                <IconListOrdered />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                isActive={editor.isActive('blockquote')}
                title="Blockquote"
              >
                <IconBlockquote />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                isActive={editor.isActive('codeBlock')}
                title="Code Block"
              >
                <IconCode />
              </ToolbarButton>
            </div>

            {/* Test button for debugging */}
            {onTestSuggestions && (
              <>
                <Divider />
                <ToolbarButton
                  onClick={onTestSuggestions}
                  title="Test Suggestions (Debug)"
                  className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                >
                  🧪 Test
                </ToolbarButton>
              </>
            )}
          </div>

          {/* Right side - AI tools and status */}
          <div className="flex items-center space-x-3">
            {/* Tone Selector */}
            <div className="hidden sm:block">
              <ToneSelector selectedTone={selectedTone} onToneChange={onToneChange} />
            </div>

            {/* AI Rewrite Button */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {analysisStatus === 'analyzing' && 'Analyzing...'}
                {analysisStatus === 'complete' && 'Analysis complete'}
                {analysisStatus === 'error' && 'Analysis error'}
              </span>
              <ToolbarButton
                onClick={handleAIRewrite}
                title="AI Rewrite"
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700"
              >
                <SparklesIcon className="w-4 h-4" />
                <span className="ml-1 hidden sm:inline">AI Rewrite</span>
              </ToolbarButton>
            </div>
          </div>
        </div>
      </div>

      <AIRewriteModal
        isOpen={showAIRewriteModal}
        onClose={() => setShowAIRewriteModal(false)}
        onAction={(action) => {
          console.log('AI Rewrite action:', action);
          setShowAIRewriteModal(false);
          onAIRewrite();
        }}
      />
    </>
  );
};

export default EditorToolbar;