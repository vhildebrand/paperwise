import React from 'react';
import type { AnalysisSuggestion } from '../types/analysis';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface SuggestionActionBoxProps {
  suggestion: AnalysisSuggestion;
  onAccept: (suggestion: AnalysisSuggestion) => void;
  onDismiss: (suggestion: AnalysisSuggestion) => void;
  position: { top: number; left: number };
}

const SuggestionActionBox: React.FC<SuggestionActionBoxProps> = ({ suggestion, onAccept, onDismiss, position }) => {
  const popupStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${position.top}px`,
    left: `${position.left}px`,
    transform: 'translate(-50%, -110%)',
    zIndex: 50,
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      style={popupStyle}
      className="flex items-center space-x-3 bg-white rounded-lg shadow-xl p-2.5 border border-gray-200"
      onClick={stopPropagation}
    >
      <div className="flex items-center space-x-2">
        <p className="text-gray-500 line-through">{suggestion.originalText}</p>
        <p className="text-gray-400">→</p>
        <p className="text-base font-semibold text-blue-600">{suggestion.suggestion}</p>
      </div>
      <div className="h-6 w-px bg-gray-200"></div>
      <div className="flex space-x-1">
        <button
          onClick={() => onAccept(suggestion)}
          className="p-1.5 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors"
          title="Accept suggestion"
        >
          <CheckIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDismiss(suggestion)}
          className="p-1.5 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
          title="Dismiss suggestion"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SuggestionActionBox; 