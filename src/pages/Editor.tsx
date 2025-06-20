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
import Tokenizer from 'sentence-tokenizer';
import { nanoid } from 'nanoid';

import { CustomParagraph, BlockIdGenerator } from '../lib/tiptap-extensions';

type Document = Database['public']['Tables']['documents']['Row'];

// Define the new state structure for sentences
interface SentenceState {
  hash: string;
  status: 'clean' | 'dirty' | 'analyzing';
  blockId: string;
  blockPos: number;
  sentenceIndexInBlock: number;
  text: string;
}

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
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [selectedSuggestion, setSelectedSuggestion] = useState<AnalysisSuggestion | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [selectedTone, setSelectedTone] = useState('formal');
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [documentStats, setDocumentStats] = useState({ words: 0, characters: 0, readingTime: 0, fleschKincaid: 0 });
  const [decorations, setDecorations] = useState(DecorationSet.empty);
  const [sentenceStates, setSentenceStates] = useState<Map<string, SentenceState>>(new Map());
  const [analysisStartTime, setAnalysisStartTime] = useState<Date | null>(null);
  const [analysisDuration, setAnalysisDuration] = useState(0);

  const editorRef = useRef<HTMLDivElement>(null);
  const isAcceptingSuggestion = useRef(false);

  // Create refs for state values needed in callbacks to avoid stale closures
  const sentenceStatesRef = useRef(sentenceStates);
  sentenceStatesRef.current = sentenceStates;
  
  const selectedToneRef = useRef(selectedTone);
  selectedToneRef.current = selectedTone;

  const tokenizer = useMemo(() => new Tokenizer('ChuckNorris'), []);

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
        history: false,
        heading: { levels: [1, 2, 3] },
        paragraph: false, 
      }),
      CustomParagraph,
      Underline,
      Strike,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      History,
      MathExtension,
      BlockIdGenerator, // Use the new, more generic block ID generator
    ],
    content: '',
    editable: true,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      setDocumentStats({
          words: text.split(/\s+/).filter(Boolean).length,
          characters: text.length,
          readingTime: Math.ceil(text.split(/\s+/).filter(Boolean).length / 200),
          fleschKincaid: calculateFleschKincaid(text)
      });
      debouncedSave(html);

      if (isAcceptingSuggestion.current) return;
      
      const newStates = new Map<string, SentenceState>();
      let hasDirtySentences = false;

      editor.state.doc.descendants((node, pos) => {
        const blockId = node.attrs['data-block-id'];
        if (!blockId || node.isLeaf) return;

        if (node.type.name === 'math_display' || node.type.name === 'math_inline') {
            return false;
        }

        const textContent = node.textContent;
        if (!textContent) return;

        // CORRECTED USAGE: Use .setEntry() then .getSentences()
        tokenizer.setEntry(textContent);
        const sentences = tokenizer.getSentences();
        
        sentences.forEach((sentenceText: string, index: number) => { // Types are now correctly inferred
          const sentenceId = `${blockId}-${index}`;
          const hash = simpleHash(sentenceText);
          const oldState = sentenceStatesRef.current.get(sentenceId);

          const currentState: SentenceState = {
            hash,
            status: 'clean',
            blockId,
            blockPos: pos,
            sentenceIndexInBlock: index,
            text: sentenceText,
          };
          
          if (!oldState || oldState.hash !== hash) {
            currentState.status = 'dirty';
            hasDirtySentences = true;
          } else {
            currentState.status = oldState.status;
          }
          newStates.set(sentenceId, currentState);
        });
      });
      
      if(hasDirtySentences) {
        console.log(`[${new Date().toLocaleTimeString()}] Found dirty sentences. Queueing analysis.`);
        setSentenceStates(newStates);
        runAnalysisOnDirtySentences(); 
      }
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
                  return true;
              }
          }
          return false;
        }
      },
    },
  });

  // NEW: Process analysis results from the backend
  const processSentenceAnalysisResults = useCallback((results: Record<string, any[]>) => {
    if (!editor) return;

    const newSuggestions: AnalysisSuggestion[] = [];
    const doc = editor.state.doc;
    const currentSentenceStates = sentenceStatesRef.current;
    
    // Track which specific sentences were re-analyzed to avoid removing suggestions from other sentences
    const reanalyzedSentenceIds = new Set(Object.keys(results));
    
    for (const sentenceId in results) {
      const sentenceSuggestions = results[sentenceId];
      if (sentenceSuggestions.length === 0) continue;

      const state = currentSentenceStates.get(sentenceId);
      if (!state) continue;
      
      const blockNode = doc.nodeAt(state.blockPos);
      if (!blockNode) continue;
      
      const blockText = blockNode.textContent;
      const sentenceStartInBlock = blockText.indexOf(state.text);
      if(sentenceStartInBlock === -1) continue;

      const blockContentStartPos = state.blockPos + 1;

      for (const res of sentenceSuggestions) {
        const indexInSentence = state.text.indexOf(res.originalText);
        if (indexInSentence === -1) continue;

        const startIndex = blockContentStartPos + sentenceStartInBlock + indexInSentence;
        const endIndex = startIndex + res.originalText.length;

        newSuggestions.push({
          ...res,
          startIndex,
          endIndex,
          chunkId: nanoid(), 
        });
      }
    }

    // Filter out old suggestions only from the specific sentences that were re-analyzed
    const existingSuggestions = suggestions.filter(s => {
      // Find which sentence this suggestion belongs to
      for (const sentenceId of reanalyzedSentenceIds) {
        const state = currentSentenceStates.get(sentenceId);
        if (!state) continue;
        
        const blockNode = doc.nodeAt(state.blockPos);
        if (!blockNode) continue;
        
        const blockText = blockNode.textContent;
        const sentenceStartInBlock = blockText.indexOf(state.text);
        if (sentenceStartInBlock === -1) continue;

        const blockContentStartPos = state.blockPos + 1;
        const sentenceStartIndex = blockContentStartPos + sentenceStartInBlock;
        const sentenceEndIndex = sentenceStartIndex + state.text.length;
        
        // If this suggestion overlaps with a re-analyzed sentence, remove it
        if (s.startIndex < sentenceEndIndex && s.endIndex > sentenceStartIndex) {
          return false;
        }
      }
      return true;
    });

    const allSuggestions = [...existingSuggestions, ...newSuggestions];
    setSuggestions(allSuggestions);
    
    const allDecorations = allSuggestions.map(s => 
      Decoration.inline(s.startIndex, s.endIndex, {
        class: `suggestion suggestion-${s.type}`,
      })
    );
    setDecorations(DecorationSet.create(doc, allDecorations));

  }, [editor, suggestions]);

  // REFACTORED: Analysis function now works with sentences
  const analysisFn = useCallback(async () => {
    const currentSentenceStates = sentenceStatesRef.current;
    
    const dirtySentences = Array.from(currentSentenceStates.values())
      .filter(s => s.status === 'dirty');

    if (dirtySentences.length === 0) {
        setAnalysisStatus('idle');
        return;
    }

    setAnalysisStatus('analyzing');
    setAnalysisStartTime(new Date());

    setSentenceStates(prev => {
        const newStates = new Map(prev);
        dirtySentences.forEach(s => newStates.set(`${s.blockId}-${s.sentenceIndexInBlock}`, {...s, status: 'analyzing'}));
        return newStates;
    });

    try {
      const chunks = dirtySentences.reduce((acc, s) => {
        acc[`${s.blockId}-${s.sentenceIndexInBlock}`] = s.text;
        return acc;
      }, {} as Record<string, string>);

      const { data, error } = await supabase.functions.invoke('analyze-text', {
        body: { tone: selectedToneRef.current, chunks },
      });

      if (error) throw error;
      
      if (data.results) {
        processSentenceAnalysisResults(data.results);
      }
      
      setAnalysisStatus('complete');
      setAnalysisStartTime(null);

      setSentenceStates(prev => {
          const newStates = new Map(prev);
          dirtySentences.forEach(s => {
              const current = newStates.get(`${s.blockId}-${s.sentenceIndexInBlock}`);
              if (current && current.status === 'analyzing') {
                  newStates.set(`${s.blockId}-${s.sentenceIndexInBlock}`, {...current, status: 'clean'});
              }
          });
          return newStates;
      });

    } catch (error) {
      console.error('Error analyzing sentences:', error);
      setAnalysisStatus('error');
      setAnalysisStartTime(null);

      setSentenceStates(prev => {
          const newStates = new Map(prev);
          dirtySentences.forEach(s => newStates.set(`${s.blockId}-${s.sentenceIndexInBlock}`, {...s, status: 'dirty'}));
          return newStates;
      });
    }
  }, [processSentenceAnalysisResults]);

  // Use a shorter debounce for a more responsive feel
  const debouncedAnalysis = useRef(debounce(analysisFn, 800)).current;

  useEffect(() => {
    debouncedAnalysis.callback = analysisFn;
  }, [analysisFn, debouncedAnalysis]);
  
  const runAnalysisOnDirtySentences = debouncedAnalysis;
  
  const handleAcceptSuggestion = (suggestionToAccept: AnalysisSuggestion) => {
    if (!editor) return;

    isAcceptingSuggestion.current = true;

    const { tr } = editor.state;
    tr.replaceWith(suggestionToAccept.startIndex, suggestionToAccept.endIndex, editor.schema.text(suggestionToAccept.suggestion));
    
    const mapping = tr.mapping;
    editor.view.dispatch(tr);

    const updatedSuggestions = suggestions
      .filter(s => s.chunkId !== suggestionToAccept.chunkId)
      .map(s => {
        const from = mapping.map(s.startIndex);
        const to = mapping.map(s.endIndex);
        if (from >= to) return null;
        return { ...s, startIndex: from, endIndex: to };
      })
      .filter(Boolean) as AnalysisSuggestion[];
    
    setSuggestions(updatedSuggestions);

    const newDecorations = updatedSuggestions.map(s => 
      Decoration.inline(s.startIndex, s.endIndex, {
        class: `suggestion suggestion-${s.type}`,
      })
    );
    setDecorations(DecorationSet.create(editor.state.doc, newDecorations));
    
    setSelectedSuggestion(null);

    requestAnimationFrame(() => {
      isAcceptingSuggestion.current = false;
    });
  };

  const handleDismissSuggestion = (suggestionToDismiss: AnalysisSuggestion) => {
    const updatedSuggestions = suggestions.filter(s => s.chunkId !== suggestionToDismiss.chunkId);
    setSuggestions(updatedSuggestions);
    
    if (editor) {
      const doc = editor.state.doc;
      const newDecorations = updatedSuggestions.map(s => 
        Decoration.inline(s.startIndex, s.endIndex, {
          class: `suggestion suggestion-${s.type}`,
        })
      );
      setDecorations(DecorationSet.create(doc, newDecorations));
    }
    
    setSelectedSuggestion(null);
  };

   // --- NEW BULK ACTION HANDLERS ---
   const handleBulkDismiss = (suggestionsToDismiss: AnalysisSuggestion[]) => {
    if (suggestionsToDismiss.length === 0) return;
    
    const idsToDismiss = new Set(suggestionsToDismiss.map(s => s.chunkId));
    const updatedSuggestions = suggestions.filter(s => !idsToDismiss.has(s.chunkId));
    setSuggestions(updatedSuggestions);
    
    if (editor) {
      const doc = editor.state.doc;
      const newDecorations = updatedSuggestions.map(s => 
        Decoration.inline(s.startIndex, s.endIndex, {
          class: `suggestion suggestion-${s.type}`,
        })
      );
      setDecorations(DecorationSet.create(doc, newDecorations));
    }
    
    setSelectedSuggestion(null);
  };

  const handleBulkAccept = (suggestionsToAccept: AnalysisSuggestion[]) => {
    if (!editor || suggestionsToAccept.length === 0) return;

    isAcceptingSuggestion.current = true;

    const { tr } = editor.state;
    
    // Sort suggestions by startIndex in descending order to apply changes
    // from the end of the document to the beginning. This prevents character
    // offsets from becoming invalid after each replacement.
    const sortedSuggestions = [...suggestionsToAccept].sort((a, b) => b.startIndex - a.startIndex);
    
    sortedSuggestions.forEach(s => {
        tr.replaceWith(s.startIndex, s.endIndex, editor.schema.text(s.suggestion));
    });

    // Dispatch a single transaction for all replacements.
    const mapping = tr.mapping;
    editor.view.dispatch(tr);

    // Filter out the suggestions that were just accepted.
    const idsToAccept = new Set(suggestionsToAccept.map(s => s.chunkId));
    const remainingSuggestions = suggestions
      .filter(s => !idsToAccept.has(s.chunkId))
      .map(s => {
        // Remap the positions of the remaining suggestions based on the transaction.
        const from = mapping.map(s.startIndex);
        const to = mapping.map(s.endIndex);
        if (from >= to) return null; // Suggestion was inside a replaced range.
        return { ...s, startIndex: from, endIndex: to };
      })
      .filter(Boolean) as AnalysisSuggestion[];

    setSuggestions(remainingSuggestions);

    const newDecorations = remainingSuggestions.map(s => 
      Decoration.inline(s.startIndex, s.endIndex, {
        class: `suggestion suggestion-${s.type}`,
      })
    );
    setDecorations(DecorationSet.create(editor.state.doc, newDecorations));
    
    setSelectedSuggestion(null);

    requestAnimationFrame(() => {
      isAcceptingSuggestion.current = false;
    });
  };
  // --- END OF NEW HANDLERS ---

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
            setTimeout(() => editor.commands.focus(), 100);
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

  // ANALYSIS TIMER
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (analysisStatus === 'analyzing' && analysisStartTime) {
      interval = setInterval(() => {
        const duration = Math.floor((new Date().getTime() - analysisStartTime.getTime()) / 1000);
        setAnalysisDuration(duration);
      }, 1000);
    } else {
      setAnalysisDuration(0);
    }
    return () => clearInterval(interval);
  }, [analysisStatus, analysisStartTime]);

  const updateTitle = async () => {
    if (!documentId || !editedTitle.trim()) return;
    try {
      await supabase
        .from('documents')
        .update({ title: editedTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', documentId)
        .throwOnError();
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
                onAIRewrite={(action) => console.log(`AI Rewrite: ${action}`)}
                saveStatus={saveStatus}
                lastSaveTime={lastSaveTime}
                analysisDuration={analysisDuration}
              />
            )}
            
            <div className="flex-1 p-6 overflow-y-auto" ref={editorRef}>
              <div 
                className="max-w-4xl mx-auto bg-white p-8 shadow-lg rounded-lg min-h-full cursor-text"
                onClick={() => editor?.commands.focus()}
                tabIndex={-1}
                role="textbox"
                aria-label="Document editor"
              >
                {editor && <EditorContent editor={editor} />}
              </div>
            </div>
          </div>
        </Panel>
        
        <SuggestionsSidebar
          suggestions={suggestions}
          selectedSuggestion={selectedSuggestion}
          onAccept={handleAcceptSuggestion}
          onDismiss={handleDismissSuggestion}
          onBulkAccept={handleBulkAccept}
          onBulkDismiss={handleBulkDismiss}
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