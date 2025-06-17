// You'll need to install Lexical packages first:
// npm install lexical @lexical/react @lexical/rich-text @lexical/history

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Save,
  Check,
  AlertCircle
} from 'lucide-react';

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
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={updateTitle}
                className="text-2xl font-bold px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            ) : (
              <h1 
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => setIsEditingTitle(true)}
              >
                {document?.title || 'Untitled Document'}
              </h1>
            )}
            <div className="flex items-center space-x-2">
              {saveStatus === 'saving' && (
                <div className="flex items-center space-x-1 text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                  <span className="text-sm">Saving...</span>
                </div>
              )}
              {saveStatus === 'saved' && (
                <div className="flex items-center space-x-1 text-green-600">
                  <Check className="h-4 w-4" />
                  <span className="text-sm">Saved</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Error saving</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-2">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => applyFormatting('bold')}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => applyFormatting('italic')}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => applyFormatting('underline')}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          <button
            onClick={() => applyFormatting('bullet-list')}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => applyFormatting('numbered-list')}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={editorState.content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            className="w-full h-full min-h-[calc(100vh-200px)] p-6 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-gray-900 leading-relaxed"
            placeholder="Start writing your document..."
            style={{ 
              fontSize: '16px',
              lineHeight: '1.6'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Editor;
