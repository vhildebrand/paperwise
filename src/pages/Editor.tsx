// pages/Editor.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabase';
import type { AnalysisSuggestion, DocumentStats, AnalysisStatus } from '../types/analysis';
import type { Database } from '../types/supabase';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import History from '@tiptap/extension-history';
import { MathExtension } from '@aarkue/tiptap-math-extension';
import 'katex/dist/katex.min.css';
import { Panel, PanelGroup } from 'react-resizable-panels';

import { IconSaveStatus, IconArrowLeft } from '../assets/Icons';
import EditorToolbar from '../components/EditorToolbar';
import SuggestionsSidebar from '../components/SuggestionsSidebar';
import './Editor.css';

import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node } from 'prosemirror-model';

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
  const [grammarSuggestions, setGrammarSuggestions] = useState<AnalysisSuggestion[]>([]); // For LLM
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle'); //
  const [selectedSuggestion, setSelectedSuggestion] = useState<AnalysisSuggestion | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [selectedTone, setSelectedTone] = useState('formal');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [documentStats, setDocumentStats] = useState({ words: 0, characters: 0, readingTime: 0 });
  const [decorations, setDecorations] = useState(DecorationSet.empty);

  const editorRef = useRef<HTMLDivElement>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // DEBOUNCED AUTOSAVE FUNCTION
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

  // TIPTAP EDITOR
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Using the History extension instead
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      Strike,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      History,
      MathExtension,
    ],
    content: '',
    editable: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      const doc = editor.state.doc;
      const words = text.split(/\s+/).filter(Boolean).length;
      const characters = text.length;
      const readingTime = Math.ceil(words / 200);
      setDocumentStats({ words, characters, readingTime });
      debouncedSave(html);
      debouncedGrammarCheck(text);
      //debouncedSpellCheck(text, doc);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-full mx-auto',
        spellcheck: 'false',
      },
      decorations: () => decorations,
    },
  });

  // SPELL CHECK FUNCTION
  const processSpellCheckResults = useCallback((results: any[], doc: Node) => {
    console.log('Processing spell check results:', results);
    const newSuggestions: AnalysisSuggestion[] = [];
    const newDecorations: Decoration[] = [];

    // Create a map of misspelled words for quick lookup
    const misspelledWords = new Map(results.map(r => [r.word.toLowerCase(), r.suggestions]));

    doc.descendants((node, pos) => {
        if (!node.isText) {
            return;
        }

        const text = node.text || '';
        const words = text.match(/\b[a-zA-Z']+\b/g) || [];
        
        let currentPos = pos;
        for (const word of words) {
            const wordStart = text.indexOf(word, currentPos - pos);
            if (wordStart === -1) continue;
            
            const startIndex = pos + wordStart;
            const endIndex = startIndex + word.length;
            
            // Check if this word is misspelled
            if (misspelledWords.has(word.toLowerCase())) {
                const suggestions = misspelledWords.get(word.toLowerCase()) || [];
                
                // Create a suggestion for the sidebar
                newSuggestions.push({
                    type: 'spelling',
                    originalText: word,
                    suggestion: suggestions[0] || word,
                    explanation: `Possible spelling mistake. Suggestions: ${suggestions.join(', ')}`,
                    startIndex,
                    endIndex,
                    chunkId: `${startIndex}-${endIndex}`
                });

                // Create a decoration for inline highlighting
                newDecorations.push(
                    Decoration.inline(startIndex, endIndex, {
                        class: 'suggestion suggestion-spelling',
                    })
                );
            }
            
            currentPos = pos + wordStart + word.length;
        }
    });
    
    console.log('Created suggestions:', newSuggestions.length, 'decorations:', newDecorations.length);
    
    // Only update spelling suggestions, preserve grammar suggestions
    setSuggestions(newSuggestions);
    
    // Update decorations - combine with existing grammar decorations
    if(editor) {
      updateDecorations(newDecorations, 'spelling');
    }

  }, [editor]);

  // --- NEW: Function to process LLM response ---
  const processAIAnalysis = useCallback((text: string, results: any[]) => {
    console.log('Processing AI Analysis Results:', results);
    if (!editor || !results) return;
  
    const newSuggestions: AnalysisSuggestion[] = [];
    const newDecorations: Decoration[] = [];
    let lastIndex = 0;
  
    for (const res of results) {
      // Find the start index of the original text. Search from the last found position.
      const startIndex = text.indexOf(res.originalText, lastIndex);
      if (startIndex === -1) {
        console.warn(`Could not find text "${res.originalText}" in document.`);
        continue;
      }
      const endIndex = startIndex + res.originalText.length;
      lastIndex = endIndex; // Ensure we don't find the same text again
  
      const suggestion: AnalysisSuggestion = {
        type: res.type,
        originalText: res.originalText,
        suggestion: res.suggestion,
        explanation: res.explanation,
        startIndex,
        endIndex,
        chunkId: `${res.type}-${startIndex}`
      };
      newSuggestions.push(suggestion);
  
      // Create decoration based on the suggestion type
      newDecorations.push(
        Decoration.inline(startIndex, endIndex, {
          class: `suggestion suggestion-${res.type}`,
        })
      );
    }
  
    // We can now have a single source of suggestions
    setSuggestions(newSuggestions); 
    setGrammarSuggestions([]); // Deprecate this state
  
    // And a single function to update all decorations
    setDecorations(DecorationSet.create(editor.state.doc, newDecorations));
  
  }, [editor]);

  // Unified decoration management
  const updateDecorations = useCallback((newDecorations: Decoration[], type: 'spelling' | 'grammar') => {
    if (!editor) return;
    
    const doc = editor.state.doc;
    const existingDecorations = decorations.find(0, doc.content.size);
    
    // Filter out existing decorations of the same type
    const filteredExisting = existingDecorations.filter(dec => {
      const className = dec.spec?.class || '';
      if (type === 'spelling') {
        return !className.includes('suggestion-spelling');
      } else {
        return !className.includes('suggestion-grammar');
      }
    });
    
    // Combine filtered existing decorations with new ones
    const allDecorations = [...filteredExisting, ...newDecorations];
    setDecorations(DecorationSet.create(doc, allDecorations));
  }, [editor, decorations]);

   // --- NEW: Debounced function to call our Edge Function ---
   const debouncedGrammarCheck = useCallback(debounce(async (text: string) => {
    console.log('=== GRAMMAR CHECK DEBUG ===');
    console.log('Input text:', text);
    console.log('Selected tone:', selectedTone);
    
    if (text.trim().length < 20) { // Don't analyze very short texts
        console.log('Text too short, skipping analysis');
        setAnalysisStatus('idle');
        return;
    }

    setAnalysisStatus('analyzing'); //
    try {
      const { data, error } = await supabase.functions.invoke('analyze-text', {
        body: { text, tone: selectedTone },
      });
  
      if (error) throw error;
  
      // Pass the original text and the new suggestions array to the processor
      processAIAnalysis(text, data.suggestions); 
      setAnalysisStatus('complete');
    } catch (error) {
      // ... (error handling)
    }
  }, 2500), [selectedTone, processAIAnalysis]);

  

  // DEBOUNCED SPELL CHECK FUNCTION
  const debouncedSpellCheck = useCallback(debounce((text: string, doc: Node) => {
      // Commented out since we're using AI-powered grammar suggestions
      // if (spellCheckWorkerRef.current) {
      //     spellCheckWorkerRef.current.postMessage({ text });
      // }
  }, 1000), []);


  
  // Initialize worker
  useEffect(() => {
    // Commented out spellcheck worker since we're using AI-powered grammar suggestions
    // spellCheckWorkerRef.current = new Worker(new URL('../workers/spellcheck.worker.ts', import.meta.url), { type: 'module' });
    
    // spellCheckWorkerRef.current.onmessage = (event) => {
    //     const { type, results, error } = event.data;
    //     if (type === 'INIT_COMPLETE') {
    //         console.log('Spell checker worker initialized successfully');
    //     } else if (type === 'INIT_ERROR') {
    //         console.error('Spell checker worker initialization failed:', error);
    //     } else if (type === 'SPELL_RESULT' && editor) {
    //         processSpellCheckResults(results, editor.state.doc);
    //     } else if (type === 'PROCESS_ERROR') {
    //         console.error('Spell checker processing error:', error);
    //     }
    // };
    
    // spellCheckWorkerRef.current.onerror = (error) => {
    //     console.error('Spell checker worker error:', error);
    // };
    
    return () => {
        // spellCheckWorkerRef.current?.terminate();
    };
  }, [editor, processSpellCheckResults]);


  const allSuggestions = useMemo(() => {
    // Combine nspell suggestions with LLM suggestions
    const combined = [...suggestions, ...grammarSuggestions];
    console.log('=== ALL SUGGESTIONS DEBUG ===');
    console.log('Spelling suggestions:', suggestions);
    console.log('Grammar suggestions:', grammarSuggestions);
    console.log('Combined suggestions:', combined);
    console.log('=== END ALL SUGGESTIONS DEBUG ===');
    return combined;
  }, [suggestions, grammarSuggestions]);

  // Function to update suggestion positions after content changes
  const updateSuggestionPositions = useCallback((
    suggestions: AnalysisSuggestion[], 
    changeStart: number, 
    changeEnd: number, 
    newContent: string
  ): AnalysisSuggestion[] => {
    const changeLength = changeEnd - changeStart;
    const newLength = newContent.length;
    const lengthDifference = newLength - changeLength;
    
    console.log('=== UPDATING SUGGESTION POSITIONS ===');
    console.log('Change start:', changeStart, 'end:', changeEnd, 'length:', changeLength);
    console.log('New content length:', newLength, 'difference:', lengthDifference);
    
    return suggestions.map(suggestion => {
      let newStartIndex = suggestion.startIndex;
      let newEndIndex = suggestion.endIndex;
      
      // If this suggestion comes after the change, shift its position
      if (suggestion.startIndex > changeEnd) {
        newStartIndex = suggestion.startIndex + lengthDifference;
        newEndIndex = suggestion.endIndex + lengthDifference;
        console.log(`Suggestion after change: ${suggestion.originalText} -> ${newStartIndex}-${newEndIndex}`);
      }
      // If this suggestion overlaps with the change, we need to handle it carefully
      else if (suggestion.startIndex < changeEnd && suggestion.endIndex > changeStart) {
        // This suggestion overlaps with the accepted change - we should probably remove it
        console.log(`Suggestion overlaps with change: ${suggestion.originalText} - will be removed`);
        return null;
      }
      // If this suggestion is before the change, no adjustment needed
      else {
        console.log(`Suggestion before change: ${suggestion.originalText} - no adjustment needed`);
      }
      
      return {
        ...suggestion,
        startIndex: newStartIndex,
        endIndex: newEndIndex,
        chunkId: `${suggestion.type}-${newStartIndex}`
      };
    }).filter(Boolean) as AnalysisSuggestion[];
  }, []);

  const handleAcceptSuggestion = (suggestionToAccept: AnalysisSuggestion) => {
    if (!editor) return;
    const { startIndex, endIndex, suggestion } = suggestionToAccept;
  
    // The logic is now dead simple.
    editor.chain()
      .focus()
      .insertContentAt({ from: startIndex, to: endIndex }, suggestion)
      .run();
  
    // You still need to update remaining suggestion positions, but the root change is now reliable.
    // The updateSuggestionPositions function itself should still work.
    // After applying the change, you should probably re-run the analysis.
  };


  // HANDLE DISMISS SUGGESTION
  const handleDismissSuggestion = (suggestionToDismiss: AnalysisSuggestion) => {
    console.log('=== DISMISSING SUGGESTION DEBUG ===');
    console.log('Dismissing suggestion:', suggestionToDismiss);
    
    // Remove the dismissed suggestion and update positions of remaining suggestions
    if (suggestionToDismiss.type === 'spelling') {
      const updatedSuggestions = updateSuggestionPositions(
        suggestions.filter(s => s.startIndex !== suggestionToDismiss.startIndex),
        suggestionToDismiss.startIndex,
        suggestionToDismiss.endIndex,
        suggestionToDismiss.originalText // No change in content, just removing the suggestion
      );
      setSuggestions(updatedSuggestions);
    } else {
      const updatedSuggestions = updateSuggestionPositions(
        grammarSuggestions.filter(s => s.startIndex !== suggestionToDismiss.startIndex),
        suggestionToDismiss.startIndex,
        suggestionToDismiss.endIndex,
        suggestionToDismiss.originalText // No change in content, just removing the suggestion
      );
      setGrammarSuggestions(updatedSuggestions);
    }
    
    console.log('=== END DISMISSING SUGGESTION DEBUG ===');
    setSelectedSuggestion(null);
  };


  // HANDLE NAVIGATE SUGGESTIONS
  const handleNavigateSuggestions = (direction: 'prev' | 'next') => {
    if (!allSuggestions.length) return;
    const currentIndex = selectedSuggestion
      ? allSuggestions.findIndex(s => s.startIndex === selectedSuggestion.startIndex)
      : -1;
    let newIndex = direction === 'prev'
      ? (currentIndex - 1 + allSuggestions.length) % allSuggestions.length
      : (currentIndex + 1) % allSuggestions.length;
    setSelectedSuggestion(allSuggestions[newIndex]);
  };



  // HANDLE AI REWRITE
  const handleAIRewrite = (action: 'paraphrase' | 'shorten' | 'expand') => {
    console.log(`AI Rewrite triggered with action: ${action} and tone: ${selectedTone}`);
  };



  // FETCH DOCUMENT
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
              //debouncedAnalysis(initialText);
              // debouncedSpellCheck(initialText, editor.state.doc); // Commented out since we're using AI-powered suggestions
            }
            // Focus the editor after content is loaded
            setTimeout(() => {
              editor.commands.focus();
            }, 100);
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
  }, [documentId, navigate, user, editor]);


  // FOCUS EDITOR WHEN IT'S READY
  useEffect(() => {
    if (editor && !loading && documentData) {
      setTimeout(() => {
        editor.commands.focus();
      }, 200);
    }
  }, [editor, loading, documentData]);


  // UPDATE TITLE
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
              />
            )}
            

            <div className="flex-1 p-6 overflow-y-auto" ref={editorRef}>
              <div 
                className="max-w-4xl mx-auto bg-white p-8 shadow-lg rounded-lg min-h-full cursor-text"
                onClick={() => {
                  if (editor) {
                    editor.commands.focus();
                  }
                }}
                tabIndex={-1}
                role="textbox"
                aria-label="Document editor"
              >
                {editor && (
                  <EditorContent 
                    editor={editor} 
                    key={editor.isEditable ? 'editable' : 'not-editable'}
                  />
                )}
              </div>
            </div>
          </div>
        </Panel>
        
        <SuggestionsSidebar
          suggestions={allSuggestions} // Pass the combined list
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

    </div>
  );
};

export default Editor;