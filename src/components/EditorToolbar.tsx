// src/components/EditorToolbar.tsx
import React from 'react';
import type { Editor } from '@tiptap/react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon, SparklesIcon } from '@heroicons/react/24/outline';
import {
  IconBold, IconItalic, IconUnderline, IconList, IconListOrdered,
  IconH1, IconH2, IconBlockquote, IconCode, IconSaveStatus,
  IconStrikethrough, IconTable, IconLatex, IconUndo, IconRedo
} from '../assets/Icons';
import { getReadabilityLevel } from '../lib/readability';

interface Props {
  editor: Editor | null;
  analysisStatus: 'idle' | 'analyzing' | 'complete' | 'error';
  selectedTone: string;
  onToneChange: (tone: string) => void;
  onAIRewrite: (action?: 'paraphrase' | 'shorten' | 'expand') => void;
  onTestSuggestions?: () => void;
  saveStatus: 'saved' | 'saving' | 'error';
  lastSaveTime: Date | null;
  analysisDuration: number;
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

// ... (ToneSelector and AIRewriteMenu components remain the same)
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

const AIRewriteMenu = ({ onAction }: { 
  onAction: (action: 'paraphrase' | 'shorten' | 'expand') => void;
}) => {
  const actions = [
    { key: 'paraphrase', label: 'Paraphrase', description: 'Rewrite with different words', icon: '🔄' },
    { key: 'shorten', label: 'Shorten', description: 'Make it more concise', icon: '✂️' },
    { key: 'expand', label: 'Expand', description: 'Add more detail and context', icon: '↔️' }
  ] as const;

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        <SparklesIcon className="w-4 h-4" />
        <span className="ml-1 hidden sm:inline">AI Rewrite</span>
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
        <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg focus:outline-none">
          <div className="py-1">
            <div className="px-4 py-2">
              <p className="text-sm font-medium text-gray-900">AI Rewrite Actions</p>
              <p className="text-sm text-gray-500">Select an action to apply to your text.</p>
            </div>
            {actions.map((action) => (
              <Menu.Item key={action.key}>
                {({ active }) => (
                  <button
                    onClick={() => onAction(action.key)}
                    className={`${active ? 'bg-gray-100' : ''} block w-full text-left px-4 py-3 text-sm text-gray-700`}
                  >
                    <div className="flex items-center">
                      <span className="text-xl mr-3">{action.icon}</span>
                      <div>
                        <div className="font-medium">{action.label}</div>
                        <div className="text-xs text-gray-500">{action.description}</div>
                      </div>
                    </div>
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


const EditorToolbar: React.FC<Props> = ({ 
  editor, 
  analysisStatus, 
  selectedTone, 
  onToneChange, 
  onAIRewrite,
  onTestSuggestions,
  saveStatus,
  lastSaveTime,
  analysisDuration
}) => {
  if (!editor) {
    return null;
  }

  const handleAIRewrite = (action: 'paraphrase' | 'shorten' | 'expand') => {
    onAIRewrite(action);
  };

  return (
    <div className="bg-white/95 backdrop-blur-lg border-b border-gray-200 px-4 sm:px-6 py-3 z-20 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Left side - Formatting tools */}
        <div className="flex items-center space-x-1 flex-wrap">
        <div className="flex items-center space-x-1">
            <ToolbarButton
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                title="Undo (Ctrl+Z)"
            >
                <IconUndo />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                title="Redo (Ctrl+Y)"
            >
                <IconRedo />
            </ToolbarButton>
        </div>
        <Divider />
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
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              disabled={!editor.can().chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              title="Strikethrough (Ctrl+Shift+X)"
            >
              <IconStrikethrough />
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
            <ToolbarButton
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                title="Insert Table"
            >
                <IconTable />
            </ToolbarButton>
            <ToolbarButton
                // --- THIS IS THE FIX ---
                onClick={() => editor.chain().focus().insertContent('$$  $$').run()}
                // -----------------------
                title="Insert LaTeX Block"
            >
                <IconLatex />
            </ToolbarButton>
          </div>
        </div>

        {/* Right side - AI tools, status, and stats */}
        <div className="flex items-center space-x-3">
          {/* Save and Analysis Status */}
          <div className="flex items-center space-x-3">
            {analysisStatus === 'analyzing' && (
              <div className="flex items-center space-x-1 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                <span className="text-xs text-blue-700 font-medium">Analyzing</span>
                <span className="text-xs text-blue-600">({analysisDuration}s)</span>
              </div>
            )}
            {lastSaveTime && (
              <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-200">
                Last saved: {lastSaveTime.toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Tone Selector */}
          <div className="hidden sm:block">
            <ToneSelector selectedTone={selectedTone} onToneChange={onToneChange} />
          </div>

          {/* AI Rewrite Menu */}
          <AIRewriteMenu onAction={handleAIRewrite} />
        </div>
      </div>
    </div>
  );
};

export default EditorToolbar;