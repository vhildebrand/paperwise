// src/pages/Editor.tsx
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
import SuggestionActionBox from '../components/SuggestionActionBox';
import LatexModal from '../components/LatexModal';
import './Editor.css';

import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { Node } from 'prosemirror-model';
import Tokenizer from 'sentence-tokenizer';
import { nanoid } from 'nanoid';

import { CustomParagraph, BlockIdGenerator } from '../lib/tiptap-extensions';

import CitationModal from '../components/CitationModal';
import Cite from 'citation-js';

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

// Analysis settings
interface AnalysisSettings {
    formality: string;
    audience: string;
    domain: string;
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
  const [popupPosition, setPopupPosition] = useState<{ top: number, left: number } | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState(false);
  const [citationModalPosition, setCitationModalPosition] = useState<{ top: number; left: number } | null>(null);
  
  // --- NEW STATE FOR ADVANCED TONE/STYLE ---
  const [analysisSettings, setAnalysisSettings] = useState<AnalysisSettings>({
    formality: 'neutral',
    audience: 'general',
    domain: 'General',
  });
  const [isLatexModalOpen, setIsLatexModalOpen] = useState(false);
  const [latexModalPosition, setLatexModalPosition] = useState<{ top: number; left: number } | null>(null);
  const [aiRewriteStatus, setAiRewriteStatus] = useState<'idle' | 'rewriting'>('idle');
  
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
  
  const analysisSettingsRef = useRef(analysisSettings);
  analysisSettingsRef.current = analysisSettings;

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
      BlockIdGenerator,
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

        tokenizer.setEntry(textContent);
        const sentences = tokenizer.getSentences();
        
        sentences.forEach((sentenceText: string, index: number) => {
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
          const editorRect = (editorRef.current as HTMLElement).getBoundingClientRect();
          const coords = { left: event.clientX, top: event.clientY };
          const posResult = view.posAtCoords(coords);
          
          if (!posResult) {
            setSelectedSuggestion(null);
            setPopupPosition(null);
            return false;
          }

          const { pos } = posResult;
          const clickedDecorations = decorations.find(pos, pos);

          if (clickedDecorations.length > 0) {
              const suggestion = suggestions.find(s => s.startIndex <= pos && s.endIndex >= pos);
              if (suggestion) {
                  setSelectedSuggestion(suggestion);
                  
                  const startPosCoords = view.coordsAtPos(suggestion.startIndex);
                  const endPosCoords = view.coordsAtPos(suggestion.endIndex);
                  
                  const top = startPosCoords.top - editorRect.top;
                  const left = (startPosCoords.left + endPosCoords.right) / 2 - editorRect.left;
                  
                  setPopupPosition({ top, left });
                  
                  return true;
              }
          }
          
          setSelectedSuggestion(null);
          setPopupPosition(null);
          return false;
        }
      },
    },
  });

  const processSentenceAnalysisResults = useCallback((results: Record<string, any[]>) => {
    if (!editor) return;

    const newSuggestions: AnalysisSuggestion[] = [];
    const doc = editor.state.doc;
    const currentSentenceStates = sentenceStatesRef.current;
    
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

    const existingSuggestions = suggestions.filter(s => {
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
        body: { 
            task: 'analyze',
            ...analysisSettingsRef.current,
            chunks 
        },
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

  const debouncedAnalysis = useRef(debounce(analysisFn, 1200)).current;

  useEffect(() => {
    debouncedAnalysis.callback = analysisFn;
  }, [analysisFn, debouncedAnalysis]);
  
  const runAnalysisOnDirtySentences = debouncedAnalysis;
  
    // --- NEW AI REWRITE HANDLER ---
    const handleAIRewrite = async (action: 'paraphrase' | 'shorten' | 'expand') => {
        if (!editor) return;

        const { from, to, empty } = editor.state.selection;
        if (empty) {
            // TODO: Add a user notification here
            console.warn("Cannot rewrite: No text selected.");
            return;
        }

        const selectedText = editor.state.doc.textBetween(from, to);
        setAiRewriteStatus('rewriting');

        try {
            const { data, error } = await supabase.functions.invoke('analyze-text', {
                body: {
                    task: 'rewrite',
                    action: action,
                    text: selectedText,
                },
            });

            if (error) throw error;

            if (data.rewrittenText) {
                editor.chain().focus().insertContentAt({ from, to }, data.rewrittenText).run();
            }
        } catch (err) {
            console.error(`Error during AI rewrite (${action}):`, err);
            // TODO: Add user-facing error notification
        } finally {
            setAiRewriteStatus('idle');
        }
    };

    // --- NEW LATEX GENERATION HANDLER ---
    const handleGenerateLatex = async (prompt: string) => {
        if (!editor || !prompt) return;

        try {
            const { data, error } = await supabase.functions.invoke('analyze-text', {
                body: {
                    task: 'latex',
                    prompt: prompt,
                },
            });

            if (error) throw error;

            if (data.latex) {
                // The MathExtension expects the LaTex code to be within `$$ $$` for block math
                editor.chain().focus().insertContent(`$$${data.latex}$$`).run();
            }
        } catch (err) {
            console.error('Error generating LaTeX:', err);
             // TODO: Add user-facing error notification
        } finally {
            setIsLatexModalOpen(false);
            setLatexModalPosition(null);
        }
    };

    // --- NEW HANDLER TO OPEN LATEX MODAL WITH CURSOR POSITION ---
    const handleOpenLatexModal = useCallback(() => {
        if (!editor) return;
        
        const { from } = editor.state.selection;
        const coords = editor.view.coordsAtPos(from);
        
        if (coords) {
            // Get viewport dimensions
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            // Calculate position with offset
            let top = coords.top + 20;
            let left = coords.left;
            
            // Ensure modal doesn't go off-screen
            if (top + 200 > viewportHeight) { // 200px is approximate modal height
                top = coords.top - 220; // Position above cursor
            }
            
            if (left + 320 > viewportWidth) { // 320px is modal width
                left = viewportWidth - 340; // Position from right edge
            }
            
            setLatexModalPosition({
                top: Math.max(20, top), // Ensure minimum top margin
                left: Math.max(20, left) // Ensure minimum left margin
            });
            setIsLatexModalOpen(true);
        }
    }, [editor]);

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
    setPopupPosition(null);

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
    setPopupPosition(null);
  };

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
    setPopupPosition(null);

    requestAnimationFrame(() => {
      isAcceptingSuggestion.current = false;
    });
  };

  const handleBulkAccept = (suggestionsToAccept: AnalysisSuggestion[]) => {
    if (!editor || suggestionsToAccept.length === 0) return;

    isAcceptingSuggestion.current = true;

    const { tr } = editor.state;
    
    const sortedSuggestions = [...suggestionsToAccept].sort((a, b) => b.startIndex - a.startIndex);
    
    sortedSuggestions.forEach(s => {
        tr.replaceWith(s.startIndex, s.endIndex, editor.schema.text(s.suggestion));
    });

    const mapping = tr.mapping;
    editor.view.dispatch(tr);

    const idsToAccept = new Set(suggestionsToAccept.map(s => s.chunkId));
    const remainingSuggestions = suggestions
      .filter(s => !idsToAccept.has(s.chunkId))
      .map(s => {
        const from = mapping.map(s.startIndex);
        const to = mapping.map(s.endIndex);
        if (from >= to) return null;
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
    setPopupPosition(null);

    requestAnimationFrame(() => {
      isAcceptingSuggestion.current = false;
    });
  };

   // --- NEW HANDLER TO OPEN CITATION MODAL ---
   const handleOpenCitationModal = useCallback(() => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const coords = editor.view.coordsAtPos(from);

    if (coords) {
      setCitationModalPosition({
        top: Math.max(20, coords.top + 20),
        left: Math.max(20, coords.left)
      });
      setIsCitationModalOpen(true);
    }
  }, [editor]);

  // --- NEW HANDLER TO GENERATE CITATION ---
  const handleGenerateCitation = async (query: string) => {
    if (!editor || !query) return;

    try {
      const { data, error } = await supabase.functions.invoke('analyze-text', {
        body: {
          task: 'citation',
          query: query,
        },
      });

      if (error) throw error;

      if (data.bibtex) {
        // Use citation-js to parse BibTeX and format it
        const citation = new Cite(data.bibtex);

        // Format for in-text citation (e.g., "(Harari, 2015)")
        const inText = citation.format('citation', {
          format: 'text',
          template: 'apa', // Or choose another style
        });

        // Format for the full reference list
        const fullReference = citation.format('bibliography', {
          format: 'text',
          template: 'apa',
          lang: 'en-US'
        });

        // Insert the in-text citation at the cursor, and add the full reference
        // at the end of the document with a "References" heading if it doesn't exist.
        editor.chain().focus()
          .insertContent(inText)
          // We can add more complex logic here later to manage a bibliography
          .command(({ tr, state, dispatch }) => {
            const doc = state.doc;
            const endOfDocPos = doc.content.size;
          
            const lastNode = doc.lastChild;
            let shouldInsertHeading = true;
          
            if (lastNode && lastNode.type.name === 'heading' && lastNode.textContent.trim() === 'References') {
              shouldInsertHeading = false;
            }
            
            if (dispatch) {
              if (shouldInsertHeading) {
                const heading = editor.schema.nodes.heading.create({ level: 2 }, editor.schema.text('References'));
                tr.insert(endOfDocPos, heading);
              }
          
              // Get the NEW end of the document from the transaction itself
              const newEndOfDoc = tr.doc.content.size; 
          
              // Insert the reference at the correct new position
              const referencePara = editor.schema.nodes.paragraph.create({}, editor.schema.text(`\n${fullReference}`));
              tr.insert(newEndOfDoc, referencePara);
              
              dispatch(tr);
            }
            
            return true;
          })
          .run();
          
      }
    } catch (err) {
        console.error('Error generating citation:', err);
        // TODO: Add user-facing error notification
    } finally {
        setIsCitationModalOpen(false);
    }
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

  // KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+M or Cmd+M for LaTeX modal
      if ((event.ctrlKey || event.metaKey) && event.key === 'm') {
        event.preventDefault();
        if (!isLatexModalOpen) {
          handleOpenLatexModal();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLatexModalOpen, handleOpenLatexModal]);

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
        <LatexModal
            isOpen={isLatexModalOpen}
            onClose={() => setIsLatexModalOpen(false)}
            onSubmit={handleGenerateLatex}
            position={latexModalPosition}
        />
        <CitationModal // <-- ADD THIS
          isOpen={isCitationModalOpen}
          onClose={() => setIsCitationModalOpen(false)}
          onSubmit={handleGenerateCitation}
          position={citationModalPosition}
        />
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
                analysisSettings={analysisSettings}
                onAnalysisSettingsChange={setAnalysisSettings}
                onAIRewrite={handleAIRewrite}
                onGenerateLatex={handleOpenLatexModal}
                aiRewriteStatus={aiRewriteStatus}
                saveStatus={saveStatus}
                lastSaveTime={lastSaveTime}
                analysisDuration={analysisDuration}
                onGenerateCitation={handleOpenCitationModal}
              />
            )}
            
            <div className="flex-1 p-6 overflow-y-auto relative" ref={editorRef}>
              <div 
                className="max-w-4xl mx-auto bg-white p-8 shadow-lg rounded-lg min-h-full cursor-text"
                onClick={() => editor?.commands.focus()}
                tabIndex={-1}
                role="textbox"
                aria-label="Document editor"
              >
                {editor && <EditorContent editor={editor} />}
              </div>
              {selectedSuggestion && popupPosition && (
                <SuggestionActionBox
                  suggestion={selectedSuggestion}
                  onAccept={handleAcceptSuggestion}
                  onDismiss={handleDismissSuggestion}
                  position={popupPosition}
                />
              )}
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