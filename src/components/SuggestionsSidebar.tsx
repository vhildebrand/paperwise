import React from 'react';

type AnalysisSuggestion = {
  type: 'spelling' | 'grammar' | 'style';
  originalText: string;
  suggestion: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
};

interface SuggestionsSidebarProps {
  suggestions: AnalysisSuggestion[];
  onAccept: (suggestion: AnalysisSuggestion) => void;
  onDismiss: (suggestion: AnalysisSuggestion) => void;
  onSelect: (suggestion: AnalysisSuggestion | null) => void;
  selectedSuggestion: AnalysisSuggestion | null;
}

const SuggestionsSidebar: React.FC<SuggestionsSidebarProps> = ({ 
  suggestions, 
  onAccept,
  onDismiss,
  onSelect,
  selectedSuggestion
}) => {
  if (suggestions.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No suggestions available.</p>
      </div>
    );
  }

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'spelling':
        return 'border-red-500';
      case 'grammar':
        return 'border-blue-500';
      case 'style':
        return 'border-emerald-500';
      default:
        return 'border-gray-300';
    }
  };

  return (
    <div className="h-full overflow-y-auto">
        <div className="p-4 font-bold text-lg border-b">Suggestions</div>
        <ul>
            {suggestions.map((s, index) => (
            <li 
                key={`${s.startIndex}-${index}`}
                className={`p-4 border-l-4 cursor-pointer hover:bg-gray-100 ${selectedSuggestion?.startIndex === s.startIndex ? 'bg-gray-100' : ''} ${getSuggestionColor(s.type)}`}
                onClick={() => onSelect(s)}
                onMouseEnter={() => onSelect(s)}
                onMouseLeave={() => onSelect(null)}
            >
                <div className="flex justify-between items-center">
                    <p className="font-semibold text-gray-800">{s.originalText} &rarr; {s.suggestion}</p>
                </div>
                <p className="text-sm text-gray-600 mt-1">{s.explanation}</p>
                <div className="mt-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onAccept(s);
                    }}
                    className="px-3 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 mr-2"
                >
                    Accept
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDismiss(s);
                    }}
                    className="px-3 py-1 text-sm text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
                >
                    Dismiss
                </button>
                </div>
            </li>
            ))}
      </ul>
    </div>
  );
};

export default SuggestionsSidebar; 