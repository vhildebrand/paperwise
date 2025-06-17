// You'll need to install Lexical packages first:
// npm install lexical @lexical/react @lexical/rich-text @lexical/history

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import { IconSaveStatus, IconBold, IconItalic, IconUnderline, IconList, IconListOrdered } from '../assets/Icons';


type Document = Database['public']['Tables']['documents']['Row'];

interface EditorState {
  content: string;
  selectionStart: number;
  selectionEnd: number;
}

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

  // Debounced save function
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

  // Debounce utility function
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

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value, selectionStart, selectionEnd } = e.target;
    setEditorState({ content: value, selectionStart, selectionEnd });
    debouncedSave(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { value, selectionStart, selectionEnd } = e.currentTarget;
      const newValue = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd);
      setEditorState({ 
        content: newValue, 
        selectionStart: selectionStart + 2, 
        selectionEnd: selectionStart + 2 
      });
      debouncedSave(newValue);
    }
  };

  const applyFormatting = (format: string) => {
    if (!textareaRef.current) return;
    
    const { value, selectionStart, selectionEnd } = textareaRef.current;
    let newValue = value;
    let newSelectionStart = selectionStart;
    let newSelectionEnd = selectionEnd;

    switch (format) {
      case 'bold':
        newValue = value.substring(0, selectionStart) + 
                  `**${value.substring(selectionStart, selectionEnd)}**` + 
                  value.substring(selectionEnd);
        newSelectionStart = selectionStart + 2;
        newSelectionEnd = selectionEnd + 2;
        break;
      case 'italic':
        newValue = value.substring(0, selectionStart) + 
                  `*${value.substring(selectionStart, selectionEnd)}*` + 
                  value.substring(selectionEnd);
        newSelectionStart = selectionStart + 1;
        newSelectionEnd = selectionEnd + 1;
        break;
      case 'underline':
        newValue = value.substring(0, selectionStart) + 
                  `__${value.substring(selectionStart, selectionEnd)}__` + 
                  value.substring(selectionEnd);
        newSelectionStart = selectionStart + 2;
        newSelectionEnd = selectionEnd + 2;
        break;
      case 'bullet-list':
        const lines = value.split('\n');
        const currentLine = value.substring(0, selectionStart).split('\n').length - 1;
        if (lines[currentLine] && !lines[currentLine].startsWith('- ')) {
          lines[currentLine] = `- ${lines[currentLine]}`;
          newValue = lines.join('\n');
          newSelectionStart = selectionStart + 2;
          newSelectionEnd = selectionEnd + 2;
        }
        break;
      case 'numbered-list':
        const numberedLines = value.split('\n');
        const currentLineNum = value.substring(0, selectionStart).split('\n').length - 1;
        if (numberedLines[currentLineNum] && !numberedLines[currentLineNum].match(/^\d+\.\s/)) {
          numberedLines[currentLineNum] = `1. ${numberedLines[currentLineNum]}`;
          newValue = numberedLines.join('\n');
          newSelectionStart = selectionStart + 3;
          newSelectionEnd = selectionEnd + 3;
        }
        break;
    }

    setEditorState({ 
      content: newValue, 
      selectionStart: newSelectionStart, 
      selectionEnd: newSelectionEnd 
    });
    debouncedSave(newValue);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      updateTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditedTitle(document?.title || '');
    }
  };

  // Handle cursor positioning after formatting
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.setSelectionRange(editorState.selectionStart, editorState.selectionEnd);
    }
  }, [editorState.selectionStart, editorState.selectionEnd]);

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
             <button onClick={() => navigate('dashboard')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm hidden sm:block">
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
        <div className="flex items-center space-x-1">
          {[['bold', <IconBold />], ['italic', <IconItalic />], ['underline', <IconUnderline />]].map(([format, icon]) => (
             <button key={format as string} onClick={() => applyFormatting(format as string)} className="p-2 text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded transition-colors" title={(format as string).charAt(0).toUpperCase() + (format as string).slice(1)}>
                {icon}
            </button>
          ))}
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
           {[['bullet-list', <IconList />], ['numbered-list', <IconListOrdered />]].map(([format, icon]) => (
             <button key={format as string} onClick={() => applyFormatting(format as string)} className="p-2 text-gray-600 hover:bg-gray-200 hover:text-gray-900 rounded transition-colors" title={(format as string).charAt(0).toUpperCase() + (format as string).slice(1)}>
                {icon}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-8 md:p-12">
          <textarea
            ref={textareaRef}
            value={editorState.content}
            onChange={(e) => setEditorState({ ...editorState, content: e.target.value })}
            className="w-full h-full min-h-[calc(100vh-220px)] p-2 bg-transparent focus:outline-none resize-none font-serif text-lg text-gray-800 leading-relaxed placeholder-gray-400"
            placeholder="Start writing your masterpiece..."
          />
        </div>
      </main>
    </div>
  );
};

export default Editor;
