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
import { calculateFleschKincaid } from '../lib/readability';

import { IconSaveStatus, IconArrowLeft } from '../assets/Icons';
import EditorToolbar from '../components/EditorToolbar';
import SuggestionsSidebar from '../components/SuggestionsSidebar';
import './Editor.css';

import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { Node } from 'prosemirror-model';

import { CustomParagraph, ParagraphIdGenerator } from '../lib/tiptap-extensions';

type Document = Database['public']['Tables']['documents']['Row'];

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { callback: T } {
  let timeout: NodeJS.Timeout;
  
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => debounced.callback(...args), wait);
  };
  
  debounced.callback = func;

  return debounced;
}

// Simple hash function for strings
const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return String(hash);
};

interface ParagraphState {
  hash: string;
  status: 'clean' | 'dirty' | 'analyzing';
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
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle'); //
  const [selectedSuggestion, setSelectedSuggestion] = useState<AnalysisSuggestion | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [selectedTone, setSelectedTone] = useState('formal');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [documentStats, setDocumentStats] = useState({ words: 0, characters: 0, readingTime: 0, fleschKincaid: 0 });
  const [decorations, setDecorations] = useState(DecorationSet.empty);
  const [paragraphStates, setParagraphStates] = useState<Map<string, ParagraphState>>(new Map());

  const editorRef = useRef<HTMLDivElement>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isAcceptingSuggestion = useRef(false);

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
        heading: { levels: [1, 2, 3] },
        paragraph: false, // Disable the default paragraph extension
      }),
      CustomParagraph, // Use our custom paragraph extension
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
      ParagraphIdGenerator, // Add the extension that provides the plugin
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
      const fleschKincaid = calculateFleschKincaid(text);
      setDocumentStats({ words, characters, readingTime, fleschKincaid });
      debouncedSave(html);

      if (isAcceptingSuggestion.current) {
        return;
      }
      
      // New logic for dirty checking
      const newStates = new Map(paragraphStates);
      let hasDirtyParagraphs = false;

      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph') {
          const id = node.attrs['data-paragraph-id'];
          if (!id) return;

          const text = node.textContent;
          const hash = simpleHash(text);
          const currentState = newStates.get(id);

          if (!currentState || currentState.hash !== hash) {
            newStates.set(id, { hash, status: 'dirty' });
            hasDirtyParagraphs = true;
          }
        }
      });
      
      if(hasDirtyParagraphs) {
        console.log(`[${new Date().toLocaleTimeString()}] Found ${newStates.size - paragraphStates.size} new/changed paragraphs. Queueing analysis.`);
        setParagraphStates(newStates);
        runAnalysisOnDirtyParagraphs();
      }

      // OLD CALL:
      // debouncedGrammarCheck(text);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg focus:outline-none max-w-full mx-auto',
        spellcheck: 'false',
      },
      decorations: () => decorations,
      handleDOMEvents: {
        click: (view: EditorView, event: MouseEvent) => {
          const coords = { left: event.clientX, top: event.clientY };
          const posResult = view.posAtCoords(coords);
          if (!posResult) return false;

          const { pos } = posResult;
          const clickedDecorations = decorations.find(pos, pos);

          if (clickedDecorations.length > 0) {
              const suggestion = suggestions.find(s => s.startIndex <= pos && s.endIndex >= pos);
              if (suggestion) {
                  setSelectedSuggestion(suggestion);
                  return true; // handled
              }
          }
          return false; // not handled
        }
      },
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

  const processChunkedAIAnalysis = useCallback((results: Record<string, any[]>, paragraphs: {id: string, pos: number}[]) => {
    if (!editor) return;

    console.log(`[${new Date().toLocaleTimeString()}] Received AI suggestions:`, results);

    const newSuggestions: AnalysisSuggestion[] = [];
    const newDecorations: Decoration[] = [];
    const doc = editor.state.doc;

    // Create a map of paragraph start positions
    const paragraphPositions = new Map(paragraphs.map(p => [p.id, p.pos]));

    for (const chunkId in results) {
        const chunkSuggestions = results[chunkId];
        const chunkStartPos = paragraphPositions.get(chunkId);

        if (chunkStartPos === undefined) {
            console.warn(`Could not find start position for chunk ${chunkId}`);
            continue;
        }

        for (const res of chunkSuggestions) {
            const textNodeStart = chunkStartPos + 1; // +1 to be inside the paragraph node
            
            let found = false;
            // Search within the paragraph for the original text
            const paraNode = doc.nodeAt(chunkStartPos);
            if (!paraNode) continue;
            
            const paraEndPos = chunkStartPos + paraNode.nodeSize;
            doc.nodesBetween(textNodeStart, paraEndPos, (node, pos) => {
                if(found) return false;
                if (node.isText) {
                    const indexInNode = (node.textContent || '').indexOf(res.originalText);
                    if (indexInNode !== -1) {
                        const startIndex = pos + indexInNode;
                        const endIndex = startIndex + res.originalText.length;
                        
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

                        newDecorations.push(
                            Decoration.inline(startIndex, endIndex, {
                                class: `suggestion suggestion-${res.type}`,
                            })
                        );
                        found = true;
                        return false; // stop searching
                    }
                }
                return true;
            });
             if (!found) {
                console.warn(`Could not find text "${res.originalText}" in document for chunk ${chunkId}.`);
            }
        }
    }
    
    const reanalyzedParaIds = new Set(Object.keys(results));
    
    const existingSuggestions = suggestions.filter(s => {
        let paraId = '';
        doc.nodesBetween(s.startIndex, s.endIndex, (node, pos) => {
            if (node.type.name === 'paragraph') {
                paraId = node.attrs['data-paragraph-id'];
                return false;
            }
            return true;
        })
        return !reanalyzedParaIds.has(paraId);
    });

    const allSuggestions = [...existingSuggestions, ...newSuggestions];
    setSuggestions(allSuggestions);

    const existingDecorations = decorations.find(0, doc.content.size);
    const filteredDecorations = existingDecorations.filter(dec => {
        let paraId = '';
        doc.nodesBetween(dec.from, dec.to, (node, pos) => {
            if (node.type.name === 'paragraph') {
                paraId = node.attrs['data-paragraph-id'];
                return false;
            }
            return true;
        })
        return !reanalyzedParaIds.has(paraId);
    });

    setDecorations(DecorationSet.create(doc, [...filteredDecorations, ...newDecorations]));

  }, [editor, suggestions, decorations]);

  // --- REFACTORED: Stable debounced analysis trigger ---
  const paragraphStatesRef = useRef(paragraphStates);
  paragraphStatesRef.current = paragraphStates;
  
  const selectedToneRef = useRef(selectedTone);
  selectedToneRef.current = selectedTone;

  const processChunkedAIAnalysisRef = useRef(processChunkedAIAnalysis);
  processChunkedAIAnalysisRef.current = processChunkedAIAnalysis;
  
  const analysisFn = useCallback(async () => {
    if (!editor) return;

    const currentParagraphStates = paragraphStatesRef.current;
    
    const dirtyParagraphs: { id: string; text: string; pos: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph') {
            const id = node.attrs['data-paragraph-id'];
            const state = currentParagraphStates.get(id);
            if (id && state && state.status === 'dirty') {
                dirtyParagraphs.push({ id, text: node.textContent, pos });
            }
        }
    });

    if (dirtyParagraphs.length === 0) {
        return;
    }

    setAnalysisStatus('analyzing');
    const newStates = new Map(currentParagraphStates);
    dirtyParagraphs.forEach(({ id }) => {
        newStates.set(id, { ...newStates.get(id)!, status: 'analyzing' });
    });
    setParagraphStates(newStates);

    console.log(`[${new Date().toLocaleTimeString()}] Analysis triggered for ${dirtyParagraphs.length} dirty paragraphs:`, dirtyParagraphs.map(p => ({id: p.id, text: p.text})));

    try {
        const requestBody = {
            tone: selectedToneRef.current,
            chunks: dirtyParagraphs.reduce((acc, { id, text }) => {
                acc[id] = text;
                return acc;
            }, {} as Record<string, string>)
        };

        const { data, error } = await supabase.functions.invoke('analyze-text', {
            body: requestBody,
        });

        if (error) throw error;

        if (data.results) {
            processChunkedAIAnalysisRef.current(data.results, dirtyParagraphs);
        }

        setAnalysisStatus('complete');
        setParagraphStates(currentStates => {
            const finalStates = new Map(currentStates);
            dirtyParagraphs.forEach(({ id }) => {
                const currentState = finalStates.get(id);
                if (currentState) {
                   finalStates.set(id, { ...currentState, status: 'clean' });
                }
            });
            return finalStates;
        });

    } catch (error) {
        console.error('Error analyzing dirty paragraphs:', error);
        setAnalysisStatus('error');
        setParagraphStates(currentStates => {
            const revertedStates = new Map(currentStates);
            dirtyParagraphs.forEach(({ id }) => {
                 const currentState = revertedStates.get(id);
                if (currentState) {
                  revertedStates.set(id, { ...currentState, status: 'dirty' });
                }
            });
            return revertedStates;
        });
    }
  }, [editor]);

  const debouncedAnalysis = useRef(debounce(analysisFn, 2000)).current;

  useEffect(() => {
    debouncedAnalysis.callback = analysisFn;
  }, [analysisFn, debouncedAnalysis]);
  
  const runAnalysisOnDirtyParagraphs = debouncedAnalysis;
  // --- END REFACTORED ---

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
    // Now we have a single source of suggestions
    console.log('=== ALL SUGGESTIONS DEBUG ===');
    console.log('Suggestions:', suggestions);
    console.log('=== END ALL SUGGESTIONS DEBUG ===');
    return suggestions;
  }, [suggestions]);

  const handleAcceptSuggestion = (suggestionToAccept: AnalysisSuggestion) => {
    if (!editor) return;

    const { startIndex, endIndex, suggestion } = suggestionToAccept;

    isAcceptingSuggestion.current = true;

    const { tr } = editor.state;
    tr.replaceWith(startIndex, endIndex, editor.schema.text(suggestion));
    
    // Get the mapping from the transaction
    const mapping = tr.mapping;
    editor.view.dispatch(tr);

    // Update the positions of all other suggestions
    const updatedSuggestions = suggestions
      .filter(s => s.chunkId !== suggestionToAccept.chunkId) // Remove the accepted one
      .map(s => {
        // mapPoint returns the new position of a point, and a boolean indicating if it was deleted
        const from = mapping.map(s.startIndex);
        const to = mapping.map(s.endIndex);
        
        // If the suggestion was deleted by this transaction, filter it out
        if (from === to) {
            return null;
        }

        return {
          ...s,
          startIndex: from,
          endIndex: to,
        };
      })
      .filter(Boolean) as AnalysisSuggestion[];
    
    setSuggestions(updatedSuggestions);

    // Re-create decorations from the updated suggestions
    const newDecorations = updatedSuggestions.map(s => 
      Decoration.inline(s.startIndex, s.endIndex, {
        class: `suggestion suggestion-${s.type}`,
      })
    );
    setDecorations(DecorationSet.create(editor.state.doc, newDecorations));
    
    setSelectedSuggestion(null);

    // Reset the flag in the next event loop cycle
    requestAnimationFrame(() => {
      isAcceptingSuggestion.current = false;
    });
  };


  // HANDLE DISMISS SUGGESTION
  const handleDismissSuggestion = (suggestionToDismiss: AnalysisSuggestion) => {
    console.log('=== DISMISSING SUGGESTION DEBUG ===');
    console.log('Dismissing suggestion:', suggestionToDismiss);
    
    // Remove the dismissed suggestion from the suggestions list
    const updatedSuggestions = suggestions.filter(s => s.chunkId !== suggestionToDismiss.chunkId);
    setSuggestions(updatedSuggestions);
    
    // Remove the decoration for the dismissed suggestion
    if (editor) {
      const doc = editor.state.doc;
      // Re-create decorations from the updated list
      const newDecorations = updatedSuggestions.map(s => 
        Decoration.inline(s.startIndex, s.endIndex, {
          class: `suggestion suggestion-${s.type}`,
        })
      );
      setDecorations(DecorationSet.create(doc, newDecorations));
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
              // idk if i should do this here
              // debouncedGrammarCheck(initialText);
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
              </div>
            </div>

            
            {editor && (
              <EditorToolbar
                editor={editor}
                analysisStatus={analysisStatus}
                selectedTone={selectedTone}
                onToneChange={setSelectedTone}
                onAIRewrite={(action) => handleAIRewrite(action!)}
                saveStatus={saveStatus}
                lastSaveTime={lastSaveTime}
                documentStats={documentStats}
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
    />
      </PanelGroup>

    </div>
  );
};

export default Editor;