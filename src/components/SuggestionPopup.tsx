// src/components/SuggestionPopup.tsx
import React from 'react';

interface SuggestionPopupProps {
  suggestion: any;
  onAccept: () => void;
  onDismiss: () => void;
  style: React.CSSProperties;
}

const SuggestionPopup: React.FC<SuggestionPopupProps> = ({ suggestion, onAccept, onDismiss, style }) => {
  return (
    <div className="absolute z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-64 text-sm" style={style}>
      <p className="font-semibold text-gray-800">{suggestion.explanation}</p>
      <div className="my-2 bg-red-100 text-red-800 p-2 rounded-md">
        <span className="line-through">{suggestion.originalText}</span>
      </div>
      <div className="mb-3 bg-green-100 text-green-800 p-2 rounded-md">
        <span>{suggestion.suggestion}</span>
      </div>
      <div className="flex justify-end space-x-2">
        <button onClick={onDismiss} className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
          Dismiss
        </button>
        <button onClick={onAccept} className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700">
          Accept
        </button>
      </div>
    </div>
  );
};

export default SuggestionPopup;