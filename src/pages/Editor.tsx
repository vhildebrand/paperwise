// pages/Editor.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';

import { IconSaveStatus } from '../assets/Icons';
import EditorToolbar from '../components/EditorToolbar';
import './Editor.css';

import { AnalysisExtension } from '../lib/AnalysisExtension';
import SuggestionsSidebar from '../components/SuggestionsSidebar';

type Document = Database['public']['Tables']['documents']['Row'];

// --- Debounce Utility ---
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


type AnalysisSuggestion = {
  type: 'spelling' | 'grammar' | 'style';
  originalText: string;
  suggestion: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
};

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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ 
        history: false,
        heading: {
            levels: [1, 2, 3],
        }
      }),
      Underline,
      AnalysisExtension.configure({
          suggestions: [], // Start with empty
          onSuggestionClick: (suggestion, _element) => setSelectedSuggestion(suggestion),
          selectedSuggestion: null,
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      debouncedSave(html);
      debouncedAnalysis(text);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-full mx-auto bg-white p-8 shadow-sm rounded-lg min-h-full',
        spellcheck: 'false',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    const newExtensions = [
        StarterKit.configure({ 
            history: false,
            heading: {
                levels: [1, 2, 3],
            }
        }),
        Underline,
        AnalysisExtension.configure({
            suggestions,
            onSuggestionClick: (suggestion, _element) => setSelectedSuggestion(suggestion),
            selectedSuggestion,
        }),
    ];

    // This is not ideal, but it's the simplest way to update the decorations
    // without a major refactor of the AnalysisExtension.
    editor.setOptions({
        extensions: newExtensions
    });
  }, [suggestions, editor, selectedSuggestion]);

  // --- Debounced Save Function ---
  const debouncedSave = useCallback(
    debounce(async (content: string) => {
      if (!documentId) return;
      setSaveStatus('saving');
      try {
        const { error } = await supabase
          .from('documents')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('id', documentId);

        if (error) throw error;
        setSaveStatus('saved');
      } catch (error) {
        console.error('Error saving document:', error);
        setSaveStatus('error');
      }
    }, 1500),
    [documentId]
  );

  // --- Debounced Analysis Function ---
  const debouncedAnalysis = useCallback(
    debounce(async (text: string) => {
      console.log('Analysis triggered with text length:', text.length);
      if (!text.trim() || text.length < 20) { // Avoid analyzing very short texts
        console.log('Text too short, skipping analysis');
        setSuggestions([]);
        return;
      };
      console.log('Starting analysis...');
      setAnalysisStatus('analyzing');
      try {
        console.log('Calling Supabase function...');
        const { data, error } = await supabase.functions.invoke('analyze', {
          body: { text },
        });

        if (error) throw error;

        console.log('Analysis result:', data);
        setSuggestions(data);
        setAnalysisStatus('complete');
      } catch (error) {
        console.error('Error analyzing document:', error);
        setAnalysisStatus('idle'); // or 'error'
      }
    }, 2000), // 2-second debounce after user stops typing
    []
  );

  const handleAcceptSuggestion = (suggestionToAccept: AnalysisSuggestion) => {
      if (!editor) return;
      const { startIndex, endIndex, suggestion } = suggestionToAccept;

      // Apply the change to the editor
      editor.chain().focus()
        .insertContentAt({ from: startIndex + 1, to: endIndex + 1 }, suggestion)
        .run();

      // Remove this suggestion from the list
      setSuggestions(current => current.filter(s => s.startIndex !== startIndex));
      setSelectedSuggestion(null);
  };

  const handleDismissSuggestion = (suggestionToDismiss: AnalysisSuggestion) => {
      // Just remove it from the list for this session
      setSuggestions(current => current.filter(s => s.startIndex !== suggestionToDismiss.startIndex));
      setSelectedSuggestion(null);
  };

  // --- Data Fetching and Content Loading Effect ---
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
          // Set TipTap content only after it's fetched
          if (editor.isEditable) {
            editor.commands.setContent(data.content || '', false);
            // Trigger analysis on load
            const initialText = editor.getText();
            if (initialText) {
              debouncedAnalysis(initialText);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        alert('Could not load the document.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [documentId, navigate, user, editor]);

  // Debug effect to log suggestions changes
  useEffect(() => {
    console.log('Suggestions updated:', suggestions);
  }, [suggestions]);
  
  // --- Title Update Function ---
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
      alert('Failed to update title.');
    }
  };

  if (loading) {
      return <div>Loading document...</div>;
  }

  if (!documentData) {
    return <div>Document not found.</div>;
  }

  const handleTitleClick = () => {
    setIsEditingTitle(true);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedTitle(e.target.value);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      updateTitle();
    }
    if (e.key === 'Escape') {
      setEditedTitle(documentData.title);
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Bar */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 p-4">
            <div className='max-w-4xl mx-auto flex items-center justify-between'>
                <div className="flex items-center space-x-4">
                    {isEditingTitle ? (
                        <input
                            type="text"
                            value={editedTitle}
                            onChange={handleTitleChange}
                            onBlur={updateTitle}
                            onKeyDown={handleTitleKeyDown}
                            className="text-2xl font-bold p-1 -m-1 border-b-2 border-blue-500 outline-none"
                            autoFocus
                        />
                    ) : (
                        <h1 onClick={handleTitleClick} className="text-2xl font-bold cursor-pointer">
                            {documentData.title}
                        </h1>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{saveStatus}</span>
                    <IconSaveStatus status={saveStatus} />
                </div>
            </div>
        </div>

        {/* Editor Toolbar */}
        {editor && <EditorToolbar editor={editor} analysisStatus={analysisStatus} />}

        {/* Editor Canvas */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <EditorContent editor={editor} />
          </div>
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="w-96 bg-white border-l border-gray-200 flex flex-col">
        <SuggestionsSidebar
            suggestions={suggestions}
            selectedSuggestion={selectedSuggestion}
            onAccept={handleAcceptSuggestion}
            onDismiss={handleDismissSuggestion}
            onSelect={setSelectedSuggestion}
        />
      </aside>
    </div>
  );
};

export default Editor;