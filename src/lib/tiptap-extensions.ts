// lib/tiptap-extensions.ts

import { Extension } from '@tiptap/core';
import { Node } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { nanoid } from 'nanoid';

// Keep CustomParagraph as it might have other uses, but the ID logic moves.
// export { CustomParagraph } from './tiptap-extensions'; 

// NEW: A more generic Block Node ID Generator
const BlockNodeIdGeneratorPlugin = () => {
  // A set of node types we want to track for analysis.
  // This is easily extensible.
  const TRACKED_NODE_TYPES = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'tableCell']);

  return new Plugin({
    appendTransaction: (transactions, oldState, newState) => {
      if (!transactions.some((tr) => tr.docChanged)) {
        return;
      }

      const { tr } = newState;
      const nodesWithoutIds: { node: Node; pos: number }[] = [];

      newState.doc.descendants((node, pos) => {
        // Check if the node is one of our target types and lacks an ID
        if (TRACKED_NODE_TYPES.has(node.type.name) && !node.attrs['data-block-id']) {
          nodesWithoutIds.push({ node, pos });
        }
      });

      if (nodesWithoutIds.length > 0) {
        nodesWithoutIds.forEach(({ node, pos }) => {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            'data-block-id': nanoid(),
          });
        });
        return tr;
      }

      return;
    },
  });
};

export const BlockIdGenerator = Extension.create({
  name: 'blockIdGenerator',
  addProseMirrorPlugins() {
    return [BlockNodeIdGeneratorPlugin()];
  },
});

// Update CustomParagraph to use the new attribute name for consistency.
import { Paragraph } from '@tiptap/extension-paragraph'

export const CustomParagraph = Paragraph.extend({
  addAttributes() {
    return {
      'data-block-id': { // Changed from 'data-paragraph-id'
        default: null,
        parseHTML: (element) => element.getAttribute('data-block-id'),
        renderHTML: (attributes) => {
          return { 'data-block-id': attributes['data-block-id'] };
        },
      },
    };
  },
});