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

import { IconSaveStatus } from '../assets/Icons';
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
  
  const editorRef = useRef<HTMLDivElement>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Enhanced autosave with 5-second idle timer
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
  }, 100), [documentId]); // Reduced debounce to 100ms for better responsiveness

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
          tone: selectedTone // Pass selected tone to influence analysis
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
            // Scroll to the suggestion
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
          selectedSuggestion: selectedSuggestion,
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      
      // Clear existing autosave timeout
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
      
      // Set new autosave timeout (5 seconds)
      autosaveTimeoutRef.current = setTimeout(() => {
        debouncedSave(html);
      }, 5000);
      
      debouncedAnalysis(text);
    },
    onBlur: ({ editor }) => {
      // Save immediately on blur
      const html = editor.getHTML();
      debouncedSave(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-full mx-auto',
        spellcheck: 'false',
      },
    },
  });

  // Update editor extensions when suggestions or selected suggestion changes
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
        extensions: [
            StarterKit.configure({ 
                history: false,
                heading: { levels: [1, 2, 3] }
            }),
            Underline,
            AnalysisExtension.configure({
                suggestions,
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
                selectedSuggestion,
            }),
        ]
    });
  }, [suggestions, editor, selectedSuggestion]);

  const handleAcceptSuggestion = (suggestionToAccept: AnalysisSuggestion) => {
    if (!editor) return;
    const { startIndex, endIndex, suggestion, originalText } = suggestionToAccept;

    // This uses the correct ProseMirror positions, which are 1-based.
    editor.chain().focus()
      .setTextSelection({ from: startIndex + 1, to: endIndex + 1 })
      .insertContent(suggestion)
      .run();

    // Adjust indices of subsequent suggestions.
    const lengthDifference = suggestion.length - originalText.length;
    
    setSuggestions(current => {
        return current
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
            });
    });
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
    
    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentIndex <= 0 ? suggestions.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex >= suggestions.length - 1 ? 0 : currentIndex + 1;
    }
    
    setSelectedSuggestion(suggestions[newIndex]);
  };

  const handleAIRewrite = () => {
    // This would integrate with your AI rewrite functionality
    console.log('AI Rewrite triggered with tone:', selectedTone);
    // You can implement the actual AI rewrite logic here
  };

  // Load document on mount
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
        alert('Could not load the document.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };
    fetchDocument();
  }, [documentId, navigate, user, editor, debouncedAnalysis]);

  // Update title
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
      setDocumentData(prev => prev ? { ...prev, title: editedTitle.trim() } : null);
      setIsEditingTitle(false);
    } catch (error) {
      console.error('Error updating title:', error);
      alert('Failed to update title.');
    }
  };

  // Cleanup autosave timeout on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading document...</p>
      </div>
    </div>
  );
  
  if (!documentData) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-600">Document not found.</p>
    </div>
  );

  const handleTitleClick = () => setIsEditingTitle(true);
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => setEditedTitle(e.target.value);
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') updateTitle();
    if (e.key === 'Escape') {
      setEditedTitle(documentData.title);
      setIsEditingTitle(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={75} minSize={50}>
          <div className="flex flex-col h-full">
            {/* Header */}
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
                    <h1 onClick={handleTitleClick} className="text-2xl font-bold cursor-pointer hover:text-blue-600 transition-colors">
                      {documentData.title}
                    </h1>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{saveStatus}</span>
                    <IconSaveStatus status={saveStatus} />
                  </div>
                  {lastSaveTime && (
                    <span className="text-xs text-gray-400">
                      Last saved: {lastSaveTime.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Toolbar */}
            {editor && (
              <EditorToolbar 
                editor={editor} 
                analysisStatus={analysisStatus}
                selectedTone={selectedTone}
                onToneChange={setSelectedTone}
                onAIRewrite={handleAIRewrite}
              />
            )}

            {/* Editor Content */}
            <div className="flex-1 p-6 overflow-y-auto" ref={editorRef}>
              <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg rounded-lg min-h-full">
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>
        </Panel>

        {/* Suggestions Sidebar */}
        <SuggestionsSidebar
          suggestions={suggestions}
          selectedSuggestion={selectedSuggestion}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
          onSelect={setSelectedSuggestion}
          analysisStatus={analysisStatus}
          isVisible={sidebarVisible}
          onToggleVisibility={() => setSidebarVisible(!sidebarVisible)}
        />
      </PanelGroup>

      {/* Inline Card for hover */}
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