// pages/Editor.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
// import { SpellCheckExtension } from '../lib/spellCheckExtension';

import { IconSaveStatus } from '../assets/Icons';
import EditorToolbar from '../components/EditorToolbar';
import './Editor.css';

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

const Editor: React.FC = () => {
  const { user } = useAuthStore();
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  const [documentData, setDocumentData] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

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

  // --- TipTap Editor Instance ---
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // The collaboration extensions are not used in this setup
        history: false,
        heading: {
            levels: [1, 2, 3],
        }
      }),
      Underline,
      // SpellCheckExtension, // Temporarily disabled to fix typing issue
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      debouncedSave(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-full',
      },
    },
  });

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
    <div className="h-screen flex flex-col bg-gray-50 font-sans">
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

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-8 md:p-12">
            <EditorContent editor={editor} />
        </div>
      </main>
    </div>
  );
};

export default Editor;