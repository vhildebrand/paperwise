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
import SuggestionPopup from '../components/SuggestionPopup';

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

  const [activeSuggestion, setActiveSuggestion] = useState<{data: any, rect: DOMRect} | null>(null);

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


  const handleSuggestionClick = (suggestion: any, element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      setActiveSuggestion({ data: suggestion, rect });
  };

  const handleAcceptSuggestion = () => {
      if (!editor || !activeSuggestion) return;
      const { startIndex, endIndex, suggestion } = activeSuggestion.data;

      // Apply the change to the editor
      editor.chain().focus()
        .insertContentAt({ from: startIndex + 1, to: endIndex + 1 }, suggestion)
        .run();

      // Remove this suggestion from the list
      setSuggestions(current => current.filter(s => s.startIndex !== startIndex));
      setActiveSuggestion(null);
  };

  const handleDismissSuggestion = () => {
      if (!activeSuggestion) return;
      // Just remove it from the list for this session
      setSuggestions(current => current.filter(s => s.startIndex !== activeSuggestion.data.startIndex));
      setActiveSuggestion(null);
  };

  // --- TipTap Editor Instance ---
  // Wrap extensions in useMemo to reconfigure when suggestions change
  const editorExtensions = useMemo(() => [
    StarterKit.configure({ 
      history: false,
      heading: {
          levels: [1, 2, 3],
      }
    }),
    Underline,
    AnalysisExtension.configure({
        suggestions,
        onSuggestionClick: handleSuggestionClick,
    }),
  ], [suggestions]); // Dependency array is key!

  // --- TipTap Editor Instance ---
  const editor = useEditor({
    extensions: editorExtensions,
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      debouncedSave(html);
      debouncedAnalysis(text); // Analyze the text for spelling and grammar errors, need to play with debounce time
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-full',
        spellcheck: 'false', // Disable browser spell check
      },
    },
  }, [editorExtensions]); // Add editorExtensions as dependency

  // --- Data Fetching and Content Loading Effect ---
  useEffect(() => {
    if (!user) return;
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
          if (editor && editor.isEditable) {
            editor.commands.setContent(data.content || '', false);
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
      return <div>Loading Editor...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 font-sans" onClick={() => activeSuggestion && setActiveSuggestion(null)}>
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0">
        {/* Header content remains the same */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 min-w-0">
             <button onClick={() => navigate('/')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm hidden sm:block">
                &larr; Back to Dashboard
             </button>
             <div className="h-6 w-px bg-gray-300 hidden sm:block"></div>
             {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && updateTitle()}
                onBlur={updateTitle}
                className="text-lg font-bold px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto"
                autoFocus
              />
            ) : (
              <h1 
                className="text-lg font-bold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded truncate"
                onClick={() => setIsEditingTitle(true)}
              >
                {documentData?.title || 'Untitled Document'}
              </h1>
            )}
          </div>
          <div className="flex items-center space-x-4">
             <IconSaveStatus status={saveStatus} />
          </div>
        </div>
      </header>
      
      <EditorToolbar editor={editor} />

      <main className="flex-1 overflow-y-auto relative">
          {activeSuggestion && (
            <SuggestionPopup
              suggestion={activeSuggestion.data}
              onAccept={handleAcceptSuggestion}
              onDismiss={handleDismissSuggestion}
              style={{ 
                  top: activeSuggestion.rect.bottom + window.scrollY + 5, 
                  left: activeSuggestion.rect.left + window.scrollX 
              }}
            />
          )}
        <div className="max-w-4xl mx-auto p-4 sm:p-8 md:p-12">
            <EditorContent editor={editor} />
        </div>
      </main>
    </div>
  );
};

export default Editor;