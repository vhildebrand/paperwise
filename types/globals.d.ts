// dictionary-en-us fix
declare module 'dictionary-en-us' {
  const dictionary: any;
  export default dictionary;
}

// augment vfile-message with spellcheck-specific props
declare module 'vfile-message' {
  interface VFileMessage {
    actual?: string;
    expected?: string[];
    place?: {
      start?: { offset?: number };
      end?: { offset?: number };
    };
  }
}
  