import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { IconSaveStatus, IconBold, IconItalic, IconUnderline, IconList, IconListOrdered, IconSparkles } from '../assets/Icons';

type Document = Database['public']['Tables']['documents']['Row'];

interface EditorState {
  content: string;
  selectionStart: number;
  selectionEnd: number;
}

// --- Main Editor Component ---
const Editor: React.FC = () => {
  const { user } = useAuthStore();
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [editorState, setEditorState] = useState<EditorState>({
    content: '',
    selectionStart: 0,
    selectionEnd: 0
  });

  // --- Grammar/Spell Check State ---
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isChecking, setIsChecking] = useState(false);


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

  // --- Debounced Save Function ---
  const debouncedSave = useCallback(
    debounce(async (content: string) => {
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
      } catch (error) {
        console.error('Error saving document:', error);
        setSaveStatus('error');
      }
    }, 1000),
    [documentId]
  );

  // --- Data Fetching Effect ---
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
          setDocument(data);
          setEditedTitle(data.title);
          setEditorState(prev => ({ ...prev, content: data.content || '' }));
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
  }, [documentId, navigate, user]);

  // --- Title Update Function ---
  const updateTitle = async () => {
    if (!documentId || !editedTitle.trim()) return;
    try {
      const { error } = await supabase
        .from('documents')
        .update({ 
          title: editedTitle.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);

      if (error) throw error;
      setDocument(prev => prev ? { ...prev, title: editedTitle.trim() } : null);
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Error updating title:', error);
      alert('Failed to update title.');
    }
  };
  
  // --- Content Change Handler ---
  // CORRECTED: This now correctly calls the debounced save function.
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart, selectionEnd } = e.target;
    setEditorState({ content: value, selectionStart, selectionEnd });
    debouncedSave(value);
  };
  
  // --- Grammar Check Handler (Placeholder) ---
  const handleGrammarCheck = async () => {
    setIsChecking(true);
    setSuggestions([]);
    
    // Simulate an API call to a grammar checking service
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Placeholder suggestions
    const dummySuggestions = [
        "Suggestion 1: Consider rephrasing for clarity.",
        "Suggestion 2: Potential spelling error found.",
        "Suggestion 3: Sentence may be a run-on."
    ];
    setSuggestions(dummySuggestions);
    setIsChecking(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0">
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
                        {document?.title || 'Untitled Document'}
                    </h1>
                )}
            </div>
            <div className="flex items-center space-x-4">
                <IconSaveStatus status={saveStatus} />
            </div>
        </div>
      </header>

      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 sm:px-6 py-2 sticky top-0 sm:top-[65px] z-10">
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
                {/* Formatting buttons can be added back here if markdown syntax helpers are desired */}
            </div>
            <div>
                 <button 
                    onClick={handleGrammarCheck}
                    disabled={isChecking}
                    className="inline-flex items-center gap-2 px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                    <IconSparkles className="w-4 h-4" />
                    {isChecking ? 'Checking...' : 'Check Document'}
                </button>
            </div>
        </div>
      </div>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-px overflow-hidden">
        {/* Markdown Input */}
        <div className="h-full overflow-y-auto bg-white">
          <textarea
            ref={textareaRef}
            value={editorState.content}
            onChange={handleContentChange} // CORRECTED: Now calls the proper handler
            className="w-full h-full min-h-[calc(100vh-220px)] p-8 bg-transparent focus:outline-none resize-none font-mono text-base text-gray-800 leading-relaxed placeholder-gray-400"
            placeholder="Write your markdown here..."
          />
        </div>

        {/* Markdown Preview */}
        <div className="h-full overflow-y-auto bg-white p-8 prose prose-gray lg:prose-lg max-w-none">
          <ReactMarkdown
                // Add `remarkBreaks` to the array
                remarkPlugins={[remarkGfm, remarkBreaks]} 
                components={{
                  h1: ({children}) => <h1 className="text-3xl font-bold text-gray-900 mb-4 mt-6">{children}</h1>,
                  h2: ({children}) => <h2 className="text-2xl font-bold text-gray-900 mb-3 mt-5">{children}</h2>,
                  h3: ({children}) => <h3 className="text-xl font-bold text-gray-900 mb-2 mt-4">{children}</h3>,
                  h4: ({children}) => <h4 className="text-lg font-bold text-gray-900 mb-2 mt-3">{children}</h4>,
                  h5: ({children}) => <h5 className="text-base font-bold text-gray-900 mb-1 mt-2">{children}</h5>,
                  h6: ({children}) => <h6 className="text-sm font-bold text-gray-900 mb-1 mt-2">{children}</h6>,
                  ul: ({children}) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
                  li: ({children}) => <li className="text-gray-700">{children}</li>,
                  p: ({children}) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
                  blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-4">{children}</blockquote>,
                  code: ({children}) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
                  pre: ({children}) => <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                  strong: ({children}) => <strong className="font-bold">{children}</strong>,
                  em: ({children}) => <em className="italic">{children}</em>,
                }}
            >
                {editorState.content || "## Preview\n\nYour rendered markdown will appear here."}
            </ReactMarkdown>
        </div>
      </main>

      {/* Suggestions Panel */}
      {suggestions.length > 0 && (
          <footer className="bg-gray-100 border-t border-gray-200 p-4 shrink-0">
              <h3 className="text-sm font-semibold mb-2 text-gray-800">Grammar & Spelling Suggestions</h3>
              <ul className="space-y-2">
                  {suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-gray-700 p-2 bg-yellow-100 border border-yellow-200 rounded-md">
                        {suggestion}
                      </li>
                  ))}
              </ul>
          </footer>
      )}
    </div>
  );
};

export default Editor;