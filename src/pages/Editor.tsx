// pages/Editor.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Panel, PanelGroup } from 'react-resizable-panels';

import { IconSaveStatus, IconArrowLeft } from '../assets/Icons';
import EditorToolbar from '../components/EditorToolbar';
import SuggestionsSidebar from '../components/SuggestionsSidebar';
import InlineCard from '../components/InlineCard';
import './Editor.css';

import { AnalysisExtension, type AnalysisSuggestion } from '../lib/AnalysisExtension';

type Document = Database['public']['Tables']['documents']['Row'];

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const Editor: React.FC = () => {
  const { user } = useAuthStore();
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  const [documentData, setDocumentData] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [suggestions, setSuggestions] = useState<AnalysisSuggestion[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'analyzing' | 'complete' | 'error'>('idle');
  const [selectedSuggestion, setSelectedSuggestion] = useState<AnalysisSuggestion | null>(null);
  const [hoveredSuggestion, setHoveredSuggestion] = useState<AnalysisSuggestion | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [selectedTone, setSelectedTone] = useState('formal');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [documentStats, setDocumentStats] = useState({ words: 0, characters: 0, readingTime: 0 });

  const editorRef = useRef<HTMLDivElement>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const debouncedSave = useCallback(debounce(async (content: string) => {
    if (!documentId) return;
    setSaveStatus('saving');
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) throw error;
      setSaveStatus('saved');
      setLastSaveTime(new Date());
    } catch (error) {
      console.error('Error saving document:', error);
      setSaveStatus('error');
    }
  }, 2000), [documentId]);

  const debouncedAnalysis = useCallback(debounce(async (text: string) => {
    if (!text.trim() || text.length < 20) {
      setSuggestions([]);
      setAnalysisStatus('idle');
      return;
    }
    setAnalysisStatus('analyzing');
    try {
      const { data, error } = await supabase.functions.invoke('analyze', {
        body: {
          text,
          tone: selectedTone
        }
      });
      if (error) throw error;
      setSuggestions(data || []);
      setAnalysisStatus('complete');
    } catch (error) {
      console.error('Error analyzing document:', error);
      setAnalysisStatus('error');
    }
  }, 2000), [selectedTone]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false,
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      AnalysisExtension.configure({
          suggestions: [],
          onSuggestionClick: (suggestion, element) => {
            setSelectedSuggestion(suggestion);
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          },
          onSuggestionHover: (suggestion, element) => {
            setHoveredSuggestion(suggestion);
            if (element && suggestion) {
              const rect = element.getBoundingClientRect();
              setHoverPosition({
                x: rect.left + rect.width / 2,
                y: rect.top
              });
            }
          },
          selectedSuggestion: null,
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      const words = text.split(/\s+/).filter(Boolean).length;
      const characters = text.length;
      const readingTime = Math.ceil(words / 200);
      setDocumentStats({ words, characters, readingTime });

      debouncedSave(html);
      debouncedAnalysis(text);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-full mx-auto',
        spellcheck: 'false',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const analysisExtension = editor.extensionManager.extensions.find(ext => ext.name === 'analysis');
    if (analysisExtension) {
      analysisExtension.options.suggestions = suggestions;
      analysisExtension.options.selectedSuggestion = selectedSuggestion;
      editor.view.dispatch(editor.view.state.tr);
    }
  }, [suggestions, selectedSuggestion, editor]);

  const handleAcceptSuggestion = (suggestionToAccept: AnalysisSuggestion) => {
    if (!editor) return;
    const { startIndex, endIndex, suggestion, originalText } = suggestionToAccept;

    const { from, to } = editor.state.selection;
    editor.chain().focus()
      .insertContentAt({ from: startIndex, to: endIndex }, suggestion)
      .run();

    const lengthDifference = suggestion.length - originalText.length;
    setSuggestions(current =>
      current
        .filter(s => s.startIndex !== suggestionToAccept.startIndex)
        .map(s => {
          if (s.startIndex > suggestionToAccept.startIndex) {
            return {
              ...s,
              startIndex: s.startIndex + lengthDifference,
              endIndex: s.endIndex + lengthDifference,
            };
          }
          return s;
        })
    );
    setSelectedSuggestion(null);
    setHoveredSuggestion(null);
  };

  const handleDismissSuggestion = (suggestionToDismiss: AnalysisSuggestion) => {
    setSuggestions(current => current.filter(s => s.startIndex !== suggestionToDismiss.startIndex));
    setSelectedSuggestion(null);
    setHoveredSuggestion(null);
  };

  const handleNavigateSuggestions = (direction: 'prev' | 'next') => {
    if (!suggestions.length) return;
    const currentIndex = selectedSuggestion
      ? suggestions.findIndex(s => s.startIndex === selectedSuggestion.startIndex)
      : -1;
    let newIndex = direction === 'prev'
      ? (currentIndex - 1 + suggestions.length) % suggestions.length
      : (currentIndex + 1) % suggestions.length;
    setSelectedSuggestion(suggestions[newIndex]);
  };

  const handleAIRewrite = (action: 'paraphrase' | 'shorten' | 'expand') => {
    console.log(`AI Rewrite triggered with action: ${action} and tone: ${selectedTone}`);
  };

  const addTestSuggestions = () => {
    const testSuggestions: AnalysisSuggestion[] = [
      { type: 'spelling', originalText: 'test', suggestion: 'testing', explanation: 'This is a test spelling suggestion', startIndex: 0, endIndex: 4 },
      { type: 'grammar', originalText: 'is', suggestion: 'are', explanation: 'This is a test grammar suggestion', startIndex: 5, endIndex: 7 }
    ];
    setSuggestions(testSuggestions);
  };

  useEffect(() => {
    if (!user || !editor) return;
    const fetchDocument = async () => {
      if (!documentId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();
        if (error) throw error;
        if (data) {
          setDocumentData(data);
          setEditedTitle(data.title);
          if (editor.isEditable) {
            editor.commands.setContent(data.content || '', false);
            const initialText = editor.getText();
            if (initialText) {
              debouncedAnalysis(initialText);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [documentId, navigate, user, editor, debouncedAnalysis]);

  const updateTitle = async () => {
    if (!documentId || !editedTitle.trim()) return;
    try {
      const { error } = await supabase
        .from('documents')
        .update({ title: editedTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', documentId);
      if (error) throw error;
      setDocumentData(prev => prev ? { ...prev, title: editedTitle.trim() } : null);
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  if (!documentData) return <div className="flex items-center justify-center h-screen"><p>Document not found.</p></div>;

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={75} minSize={50}>
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 bg-white border-b border-gray-200 p-4">
              <div className='max-w-4xl mx-auto flex items-center justify-between'>
                <div className="flex items-center space-x-4">
                  <button onClick={() => navigate('/dashboard')} className="p-2 rounded-full hover:bg-gray-100" title="Back to Dashboard">
                    <IconArrowLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  {isEditingTitle ? (
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onBlur={updateTitle}
                      onKeyDown={(e) => e.key === 'Enter' && updateTitle()}
                      className="text-2xl font-bold p-1 -m-1 border-b-2 border-blue-500 outline-none"
                      autoFocus
                    />
                  ) : (
                    <h1 onClick={() => setIsEditingTitle(true)} className="text-2xl font-bold cursor-pointer">{documentData.title}</h1>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{saveStatus}</span>
                    <IconSaveStatus status={saveStatus} />
                  </div>
                  {lastSaveTime && <span className="text-xs text-gray-400">Last saved: {lastSaveTime.toLocaleTimeString()}</span>}
                </div>
              </div>
            </div>

            {editor && (
              <EditorToolbar
                editor={editor}
                analysisStatus={analysisStatus}
                selectedTone={selectedTone}
                onToneChange={setSelectedTone}
                onAIRewrite={(action) => handleAIRewrite(action!)}
                onTestSuggestions={addTestSuggestions}
              />
            )}

            <div className="flex-1 p-6 overflow-y-auto" ref={editorRef}>
              <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg rounded-lg min-h-full">
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </Panel>

        <SuggestionsSidebar
          suggestions={suggestions}
          selectedSuggestion={selectedSuggestion}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
          onSelect={setSelectedSuggestion}
          analysisStatus={analysisStatus}
          isVisible={sidebarVisible}
          onToggleVisibility={() => setSidebarVisible(!sidebarVisible)}
          documentStats={documentStats}
        />
      </PanelGroup>

      {hoveredSuggestion && (
        <InlineCard
          suggestion={hoveredSuggestion}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
          onNavigate={handleNavigateSuggestions}
          hasPrevious={suggestions.length > 1}
          hasNext={suggestions.length > 1}
          position={hoverPosition}
        />
      )}
    </div>
  );
};

export default Editor;