// lib/tiptap-extensions.ts

import { Extension } from '@tiptap/core';
import { Node } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { nanoid } from 'nanoid';
import { Paragraph } from '@tiptap/extension-paragraph';

// A set of node types we want to track for analysis.
const TRACKED_NODE_TYPES = ['paragraph', 'heading', 'listItem', 'blockquote', 'tableCell'];

export const BlockIdGenerator = Extension.create({
  name: 'blockIdGenerator',

  // 1. Use addGlobalAttributes to define 'data-block-id' on all tracked node types.
  // This is the key fix for making headings and other nodes analyzable.
  addGlobalAttributes() {
    return [
      {
        types: TRACKED_NODE_TYPES,
        attributes: {
          'data-block-id': {
            default: null,
            parseHTML: element => element.getAttribute('data-block-id'),
            renderHTML: attributes => {
              // Only render the attribute if it has a value.
              if (attributes['data-block-id']) {
                return { 'data-block-id': attributes['data-block-id'] };
              }
              return {};
            },
          },
        },
      },
    ];
  },

  // 2. The plugin now correctly populates the 'data-block-id' attribute,
  // which is guaranteed to exist on the tracked nodes.
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) {
            return;
          }

          const { tr } = newState;
          const nodesWithoutIds: { node: Node; pos: number }[] = [];

          newState.doc.descendants((node, pos) => {
            // Check if the node is a tracked type and lacks an ID.
            if (TRACKED_NODE_TYPES.includes(node.type.name) && !node.attrs['data-block-id']) {
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
      }),
    ];
  },
});


// CustomParagraph no longer needs to add the attribute itself.
// BlockIdGenerator now handles this globally. We still need to export
// a Paragraph extension because it's disabled in StarterKit in Editor.tsx.
export const CustomParagraph = Paragraph.extend();