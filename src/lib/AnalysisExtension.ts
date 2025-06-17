// src/lib/AnalysisExtension.ts
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export interface AnalysisSuggestion {
  type: 'spelling' | 'grammar' | 'style' | 'clarity' | 'tone';
  originalText: string;
  suggestion: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
  ruleName?: string;
}

export interface AnalysisExtensionOptions {
  suggestions: AnalysisSuggestion[];
  onSuggestionClick: (suggestion: AnalysisSuggestion, element: HTMLElement) => void;
  onSuggestionHover: (suggestion: AnalysisSuggestion | null, element: HTMLElement | null) => void;
  selectedSuggestion: AnalysisSuggestion | null;
}

export const AnalysisExtension = Extension.create<AnalysisExtensionOptions>({
  name: 'analysis',

  addProseMirrorPlugins() {
    const { suggestions, onSuggestionClick, onSuggestionHover, selectedSuggestion } = this.options;
    
    return [
      new Plugin({
        key: new PluginKey('analysis'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = []
            const { doc } = state;
            
            let textOffset = 0;

            doc.descendants((node, pos) => {
                if (!node.isText) {
                    // This is the key fix: Tiptap's `getText()` uses two newlines
                    // as a block separator by default. We must replicate that logic.
                    if (node.isBlock && textOffset > 0) {
                        textOffset += 2;
                    }
                    return;
                }

                suggestions.forEach((s) => {
                    if (s.startIndex >= textOffset && s.endIndex <= textOffset + node.nodeSize) {
                        const from = pos + (s.startIndex - textOffset) + 1;
                        const to = pos + (s.endIndex - textOffset) + 1;

                        const isSelected = selectedSuggestion && selectedSuggestion.startIndex === s.startIndex;
                        const className = `suggestion suggestion-${s.type} ${isSelected ? 'suggestion-selected' : ''}`;
                        
                        decorations.push(
                            Decoration.inline(from, to, {
                                class: className,
                                'data-suggestion': JSON.stringify(s),
                                'data-start-index': s.startIndex.toString(),
                                'data-suggestion-type': s.type,
                            })
                        )
                    }
                });
                textOffset += node.nodeSize;
            });
            
            return DecorationSet.create(doc, decorations)
          },
          // Handle clicks on suggestions
          handleClickOn: (view, pos, node, nodePos, event) => {
            const target = event.target as HTMLElement;
            const suggestionElement = target.closest('.suggestion') as HTMLElement;
            if (suggestionElement) {
              const suggestionAttr = suggestionElement.getAttribute('data-suggestion');
              if (suggestionAttr) {
                const suggestion = JSON.parse(suggestionAttr);
                onSuggestionClick(suggestion, suggestionElement);
                return true; // We handled the click
              }
            }
            return false;
          },
          // Handle hover events
          handleDOMEvents: {
            mouseover: (view, event) => {
              const target = event.target as HTMLElement;
              const suggestionElement = target.closest('.suggestion') as HTMLElement;
              if (suggestionElement) {
                const suggestionAttr = suggestionElement.getAttribute('data-suggestion');
                if (suggestionAttr) {
                  const suggestion = JSON.parse(suggestionAttr);
                  onSuggestionHover(suggestion, suggestionElement);
                  return true;
                }
              }
              return false;
            },
            mouseout: (view, event) => {
              const target = event.target as HTMLElement;
              const suggestionElement = target.closest('.suggestion') as HTMLElement;
              if (suggestionElement) {
                // Check if we're still hovering over a suggestion
                const relatedTarget = event.relatedTarget as HTMLElement;
                if (!relatedTarget || !relatedTarget.closest('.suggestion')) {
                  onSuggestionHover(null, null);
                  return true;
                }
              }
              return false;
            },
          },
        },
      }),
    ]
  },
})