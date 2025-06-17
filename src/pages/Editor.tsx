// You'll need to install Lexical packages first:
// npm install lexical @lexical/react @lexical/rich-text @lexical/history

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';


import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import type { EditorState, LexicalEditor } from 'lexical';

type Document = Database['public']['Tables']['documents']['Row'];

// --- Lexical Configuration ---
const theme = {
  // Your custom theme for underlining, etc. will go here
  // For now, we'll use default styles.
  ltr: 'ltr',
  rtl: 'rtl',
  placeholder: 'editor-placeholder',
  paragraph: 'editor-paragraph',
};

const editorConfig = {
  namespace: 'ClarityWriteEditor',
  theme,
  onError(error: Error) {
    throw error;
  },
};

// --- Editor Component ---
const Editor: React.FC = () => {
  const { user } = useAuthStore();
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // This will eventually hold suggestions from the API
  // const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    // 1. Add this guard clause
    if (!user) return; 

    // Fetch the document from Supabase when the component mounts
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
        }
      } catch (error) {
        console.error('Error fetching document:', error);
        alert('Could not load the document.');
        navigate('/'); // Redirect to dashboard on error
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [documentId, navigate, user]); // 2. Add 'user' to the dependency array

  
  const saveDocument = useCallback(async (content: string) => {
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
  }, [documentId]);

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

  // --- Handler for Editor Changes ---
  const handleOnChange = (editorState: EditorState, editor: LexicalEditor) => {
    // This function will be called on every change in the editor.
    // It's the perfect place to implement debouncing for autosaving and AI analysis.
    
    // 1. GET PLAIN TEXT
    const plainText = editorState.read(() => editor.getRootElement()?.textContent || '');

    // 2. DEBOUNCE AND AUTOSAVE (To be implemented)
    // Example: debounce(async () => {
    //   await supabase.from('documents').update({ content: plainText, updated_at: new Date().toISOString() }).eq('id', documentId);
    //   console.log('Document saved!');
    // }, 2000);

    // 3. DEBOUNCE AND FETCH SUGGESTIONS (To be implemented)
    // Example: debounce(async () => {
    //   const { data } = await supabase.functions.invoke('analyze-text', {
    //     body: { text: plainText },
    //   });
    //   setSuggestions(data.suggestions);
    // }, 1000);

    saveDocument(plainText);
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading Editor...</div>;
  }

  return (
    <LexicalComposer initialConfig={editorConfig}>
      <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10">
        <div className="w-full max-w-4xl px-4">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/')} className="text-indigo-600 hover:text-indigo-800">
              &larr; Back to Dashboard
            </button>
            <div className="flex items-center space-x-2">
              {saveStatus === 'saving' && <span className="text-sm text-gray-500">Saving...</span>}
              {saveStatus === 'saved' && <span className="text-sm text-green-500">All changes saved</span>}
              {saveStatus === 'error' && <span className="text-sm text-red-500">Error saving</span>}
            </div>
          </div>
          
          <div className="mb-6">
            {isEditingTitle ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={updateTitle}
                  onKeyDown={(e) => e.key === 'Enter' && updateTitle()}
                  className="text-3xl font-bold text-gray-800 bg-transparent border-b-2 border-indigo-500 focus:outline-none focus:border-indigo-700"
                  autoFocus
                />
              </div>
            ) : (
              <h1 
                className="text-3xl font-bold text-gray-800 cursor-pointer hover:text-indigo-600"
                onClick={() => setIsEditingTitle(true)}
              >
                {document?.title}
              </h1>
            )}
          </div>
        </div>
        <div className="editor-container relative bg-white shadow-lg rounded-lg w-full max-w-4xl p-12">
          <RichTextPlugin
            contentEditable={<ContentEditable className="editor-input outline-none min-h-[70vh]" />}
            placeholder={<div className="editor-placeholder absolute top-12 left-12 text-gray-400 pointer-events-none">Start writing...</div>}
            ErrorBoundary={LexicalErrorBoundary as any}
          />
          <OnChangePlugin onChange={handleOnChange} />
          <HistoryPlugin />
        </div>
        {/* Later, a sidebar or component here will display the suggestions */}
      </div>
    </LexicalComposer>
  );
};

export default Editor;
