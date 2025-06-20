// src/components/EditorToolbar.tsx
import React, { Fragment } from 'react';
import type { Editor } from '@tiptap/react';
import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon, SparklesIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import {
  IconBold, IconItalic, IconUnderline, IconList, IconListOrdered,
  IconH1, IconH2, IconBlockquote, IconCode, IconSaveStatus,
  IconStrikethrough, IconTable, IconLatex, IconUndo, IconRedo
} from '../assets/Icons';

interface AnalysisSettings {
    formality: string;
    audience: string;
    domain: string;
}

interface Props {
  editor: Editor | null;
  analysisStatus: 'idle' | 'analyzing' | 'complete' | 'error';
  analysisSettings: AnalysisSettings;
  onAnalysisSettingsChange: (settings: AnalysisSettings) => void;
  onAIRewrite: (action: 'paraphrase' | 'shorten' | 'expand') => void;
  onGenerateLatex: () => void;
  aiRewriteStatus: 'idle' | 'rewriting';
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
        className={`p-2 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800 data-[active=true]:bg-indigo-100 data-[active=true]:text-indigo-600 disabled:opacity-50 transition-all duration-200 ${className}`}
        data-active={isActive}
    >
        {children}
    </button>
);

const Divider = () => <div className="w-px h-6 bg-gray-300 mx-2"></div>;

// --- NEW ADVANCED ANALYSIS SETTINGS MENU ---
const AnalysisSettingsMenu = ({ settings, onChange }: { 
    settings: AnalysisSettings; 
    onChange: (settings: AnalysisSettings) => void; 
}) => {
    const options: Record<keyof AnalysisSettings, Array<{value: string, label: string, description: string, icon: string}>> = {
        formality: [
            { value: 'informal', label: 'Informal', description: 'Casual, friendly tone', icon: '😊' },
            { value: 'neutral', label: 'Neutral', description: 'Balanced, professional', icon: '😐' },
            { value: 'formal', label: 'Formal', description: 'Academic, sophisticated', icon: '🎓' }
        ],
        audience: [
            { value: 'general', label: 'General', description: 'Wide audience', icon: '👥' },
            { value: 'knowledgeable', label: 'Knowledgeable', description: 'Some background', icon: '🧠' },
            { value: 'expert', label: 'Expert', description: 'Specialized knowledge', icon: '🔬' }
        ],
        domain: [
            { value: 'Academic', label: 'Academic', description: 'Research, papers', icon: '📚' },
            { value: 'Business', label: 'Business', description: 'Professional documents', icon: '💼' },
            { value: 'General', label: 'General', description: 'Everyday writing', icon: '📝' },
            { value: 'Email', label: 'Email', description: 'Communication', icon: '📧' },
            { value: 'Casual', label: 'Casual', description: 'Personal writing', icon: '💬' },
            { value: 'Creative', label: 'Creative', description: 'Artistic expression', icon: '🎨' }
        ],
    };

    const handleSettingChange = (key: keyof AnalysisSettings, value: string) => {
        onChange({ ...settings, [key]: value });
    };

    const getCurrentSetting = (key: keyof AnalysisSettings) => {
        return options[key].find(opt => opt.value === settings[key]);
    };

    return (
        <Menu as="div" className="relative inline-block text-left">
            <Menu.Button className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-sm">
                <Cog6ToothIcon className="w-4 h-4 text-gray-500" />
                <span className="ml-2 hidden sm:inline">Analysis Settings</span>
                <ChevronDownIcon className="w-4 h-4 ml-2 text-gray-400" />
            </Menu.Button>
            <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items className="absolute right-0 z-50 mt-2 w-80 origin-top-right bg-white border border-gray-200 rounded-xl shadow-xl focus:outline-none overflow-hidden max-h-96">
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center">
                            <Cog6ToothIcon className="w-4 h-4 mr-2 text-indigo-600" />
                            Writing Analysis Settings
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">Customize how your text is analyzed</p>
                    </div>
                    
                    <div className="p-4 space-y-4 max-h-64 overflow-y-auto">
                        {Object.keys(options).map(key => {
                            const currentSetting = getCurrentSetting(key as keyof AnalysisSettings);
                            return (
                                <div key={key} className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                        {key}
                                    </label>
                                    <div className="grid grid-cols-1 gap-1">
                                        {options[key as keyof AnalysisSettings].map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => handleSettingChange(key as keyof AnalysisSettings, option.value)}
                                                className={`flex items-center p-2 rounded-lg text-left transition-all duration-200 ${
                                                    settings[key as keyof AnalysisSettings] === option.value
                                                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-900'
                                                        : 'hover:bg-gray-50 border border-transparent hover:border-gray-200 text-gray-700'
                                                }`}
                                            >
                                                <span className="text-lg mr-3">{option.icon}</span>
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium">{option.label}</div>
                                                    <div className="text-xs text-gray-500">{option.description}</div>
                                                </div>
                                                {settings[key as keyof AnalysisSettings] === option.value && (
                                                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                        <div className="flex items-center justify-between text-xs text-gray-600">
                            <span>Current settings:</span>
                            <div className="flex items-center space-x-2">
                                <span className="px-2 py-1 bg-white rounded-md border border-gray-200">
                                    {getCurrentSetting('formality')?.label}
                                </span>
                                <span className="px-2 py-1 bg-white rounded-md border border-gray-200">
                                    {getCurrentSetting('audience')?.label}
                                </span>
                                <span className="px-2 py-1 bg-white rounded-md border border-gray-200">
                                    {getCurrentSetting('domain')?.label}
                                </span>
                            </div>
                        </div>
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
};


const AIRewriteMenu = ({ onAction, status, disabled }: { 
  onAction: (action: 'paraphrase' | 'shorten' | 'expand') => void;
  status: 'idle' | 'rewriting';
  disabled: boolean;
}) => {
  const actions = [
    { key: 'paraphrase', label: 'Paraphrase', description: 'Rewrite with different words', icon: '🔄' },
    { key: 'shorten', label: 'Shorten', description: 'Make it more concise', icon: '✂️' },
    { key: 'expand', label: 'Expand', description: 'Add more detail and context', icon: '↔️' }
  ] as const;

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button 
        disabled={disabled || status === 'rewriting'}
        className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
      >
        {status === 'rewriting' ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        ) : (
            <SparklesIcon className="w-4 h-4" />
        )}
        <span className="ml-2 hidden sm:inline">{status === 'rewriting' ? 'Rewriting...' : 'AI Rewrite'}</span>
        <ChevronDownIcon className="w-4 h-4 ml-2" />
      </Menu.Button>
      <Transition
        enter="transition ease-out duration-200"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-150"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-50 mt-2 w-72 origin-top-right bg-white border border-gray-200 rounded-xl shadow-xl focus:outline-none overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center">
              <SparklesIcon className="w-4 h-4 mr-2 text-indigo-600" />
              AI Rewrite Actions
            </h3>
            <p className="text-xs text-gray-600 mt-1">Select an action to apply to your highlighted text</p>
          </div>
          
          <div className="py-2">
            {actions.map((action) => (
              <Menu.Item key={action.key}>
                {({ active }) => (
                  <button
                    onClick={() => onAction(action.key)}
                    className={`${active ? 'bg-indigo-50' : ''} block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 transition-colors duration-200`}
                  >
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{action.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{action.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{action.description}</div>
                      </div>
                    </div>
                  </button>
                )}
              </Menu.Item>
            ))}
          </div>
          
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              {disabled ? 'Select text to enable AI rewrite' : 'Highlight text to use AI rewrite'}
            </p>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};


const EditorToolbar: React.FC<Props> = ({ 
  editor, 
  analysisStatus, 
  analysisSettings,
  onAnalysisSettingsChange,
  onAIRewrite,
  onGenerateLatex,
  aiRewriteStatus,
  saveStatus,
  lastSaveTime,
  analysisDuration
}) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="bg-white/95 backdrop-blur-lg border-b border-gray-200 px-4 sm:px-6 py-3 z-20 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Left side - Formatting tools */}
        <div className="flex items-center space-x-2 flex-wrap">
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
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold"><IconBold /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic"><IconItalic /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={!editor.can().chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline"><IconUnderline /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough"><IconStrikethrough /></ToolbarButton>
          </div>

          <Divider />

          {/* Headings */}
          <div className="flex items-center space-x-1">
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1"><IconH1 /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2"><IconH2 /></ToolbarButton>
          </div>

          <Divider />
          
          {/* Lists and blocks */}
          <div className="flex items-center space-x-1">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List"><IconList /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List"><IconListOrdered /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Blockquote"><IconBlockquote /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code Block"><IconCode /></ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table"><IconTable /></ToolbarButton>
            <ToolbarButton onClick={onGenerateLatex} title="Generate LaTeX with AI (Ctrl+M)"><IconLatex /></ToolbarButton>
          </div>
        </div>

        {/* Right side - AI tools, status, and stats */}
        <div className="flex items-center space-x-3">
          {analysisStatus === 'analyzing' && (
            <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <span className="text-xs text-blue-700 font-medium">Analyzing</span>
              <span className="text-xs text-blue-600">({analysisDuration}s)</span>
            </div>
          )}
          {lastSaveTime && (
            <div className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
              Last saved: {lastSaveTime.toLocaleTimeString()}
            </div>
          )}
          
          <AnalysisSettingsMenu settings={analysisSettings} onChange={onAnalysisSettingsChange} />
          
          <AIRewriteMenu onAction={onAIRewrite} status={aiRewriteStatus} disabled={editor.state.selection.empty} />
        </div>
      </div>
    </div>
  );
};

export default EditorToolbar;