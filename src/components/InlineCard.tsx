import React from 'react';
import { CheckIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

type AnalysisSuggestion = {
  type: 'spelling' | 'grammar' | 'style' | 'clarity' | 'tone';
  originalText: string;
  suggestion: string;
  explanation: string;
  startIndex: number;
  endIndex: number;
  ruleName?: string;
};

interface InlineCardProps {
  suggestion: AnalysisSuggestion;
  onAccept: (suggestion: AnalysisSuggestion) => void;
  onDismiss: (suggestion: AnalysisSuggestion) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  hasPrevious: boolean;
  hasNext: boolean;
  position: { x: number; y: number };
}

const InlineCard: React.FC<InlineCardProps> = ({
  suggestion,
  onAccept,
  onDismiss,
  onNavigate,
  hasPrevious,
  hasNext,
  position
}) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'spelling': return 'border-red-500 bg-red-50';
      case 'grammar': return 'border-blue-500 bg-blue-50';
      case 'style': return 'border-purple-500 bg-purple-50';
      case 'clarity': return 'border-orange-500 bg-orange-50';
      case 'tone': return 'border-green-500 bg-green-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'spelling': return '🔤';
      case 'grammar': return '📝';
      case 'style': return '✨';
      case 'clarity': return '💡';
      case 'tone': return '🎭';
      default: return '💬';
    }
  };

  return (
    <div
      className={`absolute z-50 w-80 p-4 rounded-lg shadow-lg border-2 ${getTypeColor(suggestion.type)}`}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, calc(-100% - 10px))',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getTypeIcon(suggestion.type)}</span>
          <div>
            <h4 className="font-semibold text-gray-900 capitalize">
              {suggestion.ruleName || suggestion.type} Issue
            </h4>
            <p className="text-xs text-gray-600">
              {suggestion.type === 'spelling' && 'Spelling error'}
              {suggestion.type === 'grammar' && 'Grammar issue'}
              {suggestion.type === 'style' && 'Style suggestion'}
              {suggestion.type === 'clarity' && 'Clarity improvement'}
              {suggestion.type === 'tone' && 'Tone adjustment'}
            </p>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => onNavigate('prev')}
            disabled={!hasPrevious}
            className="p-1 rounded hover:bg-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous suggestion"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('next')}
            disabled={!hasNext}
            className="p-1 rounded hover:bg-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next suggestion"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mb-3">
        <p className="text-sm text-gray-700 mb-2">{suggestion.explanation}</p>
        <div className="bg-white/70 rounded p-2 border">
          <p className="text-sm">
            <span className="line-through text-red-600">{suggestion.originalText}</span>
            <span className="mx-2 text-gray-400">→</span>
            <span className="text-green-700 font-medium">{suggestion.suggestion}</span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <button
            onClick={() => onAccept(suggestion)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
          >
            <CheckIcon className="w-4 h-4" />
            <span>Accept</span>
          </button>
          <button
            onClick={() => onDismiss(suggestion)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
            <span>Dismiss</span>
          </button>
        </div>
      </div>

      {/* Arrow pointing down */}
      <div
        className={`absolute top-full left-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent ${getTypeColor(suggestion.type).split(' ')[0]}`}
        style={{ transform: 'translateX(-50%)' }}
      ></div>
    </div>
  );
};

export default InlineCard;