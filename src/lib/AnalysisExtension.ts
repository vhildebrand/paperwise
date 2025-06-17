// src/lib/AnalysisExtension.ts
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export interface AnalysisExtensionOptions {
  suggestions: any[]; // Pass suggestions in here
  onSuggestionClick: (suggestion: any, element: HTMLElement) => void;
}

export const AnalysisExtension = Extension.create<AnalysisExtensionOptions>({
  name: 'analysis',

  addProseMirrorPlugins() {
    const { suggestions, onSuggestionClick } = this.options;
    
    return [
      new Plugin({
        key: new PluginKey('analysis'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = []

            suggestions.forEach((s) => {
              decorations.push(
                Decoration.inline(s.startIndex, s.endIndex, {
                  class: `suggestion suggestion-${s.type}`,
                  'data-suggestion': JSON.stringify(s),
                })
              )
            })

            return DecorationSet.create(state.doc, decorations)
          },
          // Handle clicks on suggestions
          handleClickOn: (view, pos, node, nodePos, event) => {
            const target = event.target as HTMLElement;
            const suggestionAttr = target.getAttribute('data-suggestion');
            if (suggestionAttr) {
              const suggestion = JSON.parse(suggestionAttr);
              onSuggestionClick(suggestion, target);
              return true; // We handled the click
            }
            return false;
          },
        },
      }),
    ]
  },
})