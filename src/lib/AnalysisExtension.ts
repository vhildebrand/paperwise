// src/lib/AnalysisExtension.ts
import { Extension, Mark, findChildren } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { AnalysisSuggestion } from '../types/analysis';

/**
 * A new Mark to tag segments of text that are intended for analysis.
 * This is the cornerstone of the new architecture, allowing us to track
 * specific text blocks regardless of edits elsewhere in the document.
 */
export const AnalysisMark = Mark.create({
  name: 'analysisMark',

  // Define attributes for the mark.
  // 'id' is a unique identifier for the text chunk.
  // 'state' tracks the analysis process for this chunk.
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-analysis-id'),
        renderHTML: attributes => ({ 'data-analysis-id': attributes.id }),
      },
      state: {
        default: 'pending', // States: 'pending', 'analyzing', 'analyzed', 'error'
        parseHTML: element => element.getAttribute('data-analysis-state'),
        renderHTML: attributes => ({ 'data-analysis-state': attributes.state }),
      },
    };
  },

  // How the mark is parsed from HTML.
  parseHTML() {
    return [
      {
        tag: 'span[data-analysis-id]',
      },
    ];
  },

  // How the mark is rendered into HTML. It's an invisible span.
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

/**
 * Options for the main AnalysisExtension.
 */
export interface AnalysisExtensionOptions {
  suggestions: AnalysisSuggestion[];
  selectedSuggestion: AnalysisSuggestion | null;
  onSuggestionClick: (suggestion: AnalysisSuggestion, element: HTMLElement) => void;
  onSuggestionHover: (suggestion: AnalysisSuggestion | null, element: HTMLElement | null) => void;
}

/**
 * The main Tiptap extension that orchestrates the suggestion system.
 */
export const AnalysisExtension = Extension.create<AnalysisExtensionOptions>({
  name: 'analysis',

  // Register our custom AnalysisMark.
  addMarks() {
    return [AnalysisMark];
  },

  addOptions() {
    return {
      suggestions: [],
      selectedSuggestion: null,
      onSuggestionClick: () => {},
      onSuggestionHover: () => {},
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey('analysisDecorations'),
        props: {
          /**
           * This is the core logic that draws the underlines/highlights
           * for each suggestion onto the editor content.
           */
          decorations(state) {
            const decorations: Decoration[] = [];
            const { doc } = state;
            const { suggestions, selectedSuggestion } = extension.options;

            if (!suggestions.length) {
              return DecorationSet.empty;
            }

            // Find all nodes in the document that have our analysis mark.
            // These are the chunks of text we are interested in.
            const analysisChunks = findChildren(doc, node =>
              node.marks.some(mark => mark.type.name === AnalysisMark.name)
            );

            // Process each suggestion and create a decoration for it.
            suggestions.forEach((suggestion) => {
              // Find the text chunk that this suggestion belongs to.
              const chunk = analysisChunks.find(c =>
                c.node.marks.some(m => m.attrs.id === suggestion.chunkId)
              );

              if (!chunk) {
                console.warn(`Could not find chunk for suggestion:`, suggestion);
                return;
              }

              // The 'from' and 'to' positions are now reliably calculated:
              // The start position of the chunk in the document, plus the
              // suggestion's start/end index relative to that chunk.
              const chunkStartPos = chunk.pos;
              const from = chunkStartPos + suggestion.startIndex;
              const to = chunkStartPos + suggestion.endIndex;

              // Validate the calculated positions.
              if (from < chunk.pos || to > chunk.pos + chunk.node.nodeSize) {
                  console.warn('Suggestion indices are out of bounds for the chunk.', { suggestion, chunk });
                  return;
              }

              // Determine if this suggestion is currently selected to apply a specific class.
              const isSelected = selectedSuggestion &&
                selectedSuggestion.chunkId === suggestion.chunkId &&
                selectedSuggestion.startIndex === suggestion.startIndex;

              const className = `suggestion suggestion-${suggestion.type} ${isSelected ? 'suggestion-selected' : ''}`;

              // Create the inline decoration (the underline/highlight).
              decorations.push(
                Decoration.inline(from, to, {
                  class: className,
                  'data-suggestion': JSON.stringify(suggestion),
                })
              );
            });

            return DecorationSet.create(doc, decorations);
          },
          
          /**
           * Handles DOM events to make the suggestions interactive.
           */
          handleDOMEvents: {
            mousedown: (view, event: Event) => {
              const target = event.target as HTMLElement;
              const suggestionEl = target.closest('.suggestion');
              if (suggestionEl) {
                // Only prevent default if we're actually clicking on a suggestion
                const suggestionAttr = suggestionEl.getAttribute('data-suggestion');
                if (suggestionAttr) {
                  try {
                    const suggestion = JSON.parse(suggestionAttr);
                    extension.options.onSuggestionClick(suggestion, suggestionEl as HTMLElement);
                    // Don't prevent default - let the editor handle the click normally
                    return false;
                  } catch (error) {
                    console.error('Error parsing suggestion data on click:', error);
                  }
                }
              }
              return false;
            },
            
            mouseover: (view, event: Event) => {
                const target = event.target as HTMLElement;
                const suggestionEl = target.closest('.suggestion');
                if (suggestionEl) {
                  const suggestionAttr = suggestionEl.getAttribute('data-suggestion');
                  if (suggestionAttr) {
                    try {
                      const suggestion = JSON.parse(suggestionAttr);
                      extension.options.onSuggestionHover(suggestion, suggestionEl as HTMLElement);
                    } catch (error) {
                      console.warn('Error parsing suggestion data on hover:', error);
                    }
                  }
                }
                return false;
            },
            
            // Clear hover state when the mouse leaves a suggestion.
            mouseout: (view, event: Event) => {
                const target = event.target as HTMLElement;
                if (target.closest('.suggestion')) {
                    const relatedTarget = (event as MouseEvent).relatedTarget as HTMLElement;
                    if (!relatedTarget || !relatedTarget.closest('.suggestion')) {
                        extension.options.onSuggestionHover(null, null);
                    }
                }
                return false;
            }
          },
        },
      }),
    ];
  },

  onUpdate() {
    // This can be used to force a re-render if options change,
    // though Tiptap's reactivity often handles this.
    // Forcing a dispatch can be useful for debugging or complex cases.
    if (this.editor.isFocused) {
        this.editor.view.dispatch(this.editor.view.state.tr);
    }
  },
});
