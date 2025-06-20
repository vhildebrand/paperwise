// src/components/SuggestionsSidebar.tsx
import React, { useState, useMemo } from 'react';
import { Panel, PanelResizeHandle } from 'react-resizable-panels';
import { 
  CheckIcon, 
  XMarkIcon, 
  EyeIcon, 
  EyeSlashIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import type { AnalysisSuggestion, AnalysisStatus, DocumentStats } from '../types/analysis';
import { getReadabilityLevel } from '../lib/readability';

interface SuggestionsSidebarProps {
  suggestions: AnalysisSuggestion[];
  onAccept: (suggestion: AnalysisSuggestion) => void;
  onDismiss: (suggestion: AnalysisSuggestion) => void;
  onSelect: (suggestion: AnalysisSuggestion | null) => void;
  selectedSuggestion: AnalysisSuggestion | null;
  analysisStatus: AnalysisStatus;
  isVisible: boolean;
  onToggleVisibility: () => void;
  documentStats: DocumentStats;
}

type FilterType = 'all' | 'spelling' | 'grammar' | 'style' | 'clarity' | 'tone';

const SuggestionsSidebar: React.FC<SuggestionsSidebarProps> = ({ 
  suggestions, 
  onAccept,
  onDismiss,
  onSelect,
  selectedSuggestion,
  analysisStatus,
  isVisible,
  onToggleVisibility,
  documentStats
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const filteredSuggestions = useMemo(() => {
    if (activeFilter === 'all') return suggestions;
    return suggestions.filter(s => s.type === activeFilter);
  }, [suggestions, activeFilter]);

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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'spelling': return 'text-red-600 bg-red-50 border-red-200';
      case 'grammar': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'style': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'clarity': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'tone': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getFilterCount = (filter: FilterType) => {
    if (filter === 'all') return suggestions.length;
    return suggestions.filter(s => s.type === filter).length;
  };

  const handleBulkAction = (action: 'accept' | 'dismiss') => {
    filteredSuggestions.forEach(suggestion => {
      if (action === 'accept') {
        onAccept(suggestion);
      } else {
        onDismiss(suggestion);
      }
    });
  };

  if (!isVisible) {
    return (
      <div className="w-12 bg-white border-l border-gray-200 flex flex-col items-center py-4">
        <button
          onClick={onToggleVisibility}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Show suggestions"
        >
          <EyeIcon className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    );
  }

  if (analysisStatus === 'analyzing') {
    return (
      <Panel defaultSize={25} minSize={20} maxSize={35}>
        <div className="h-full bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Suggestions</h3>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-blue-600">Analyzing</span>
              </div>
              <button
                onClick={onToggleVisibility}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title="Hide suggestions"
              >
                <EyeSlashIcon className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Document Stats - Compact UI */}
          <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h4 className="font-medium text-xs text-gray-700 mb-2 flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>
              Document Statistics
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white rounded-md p-2 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-0.5">Words</div>
                <div className="text-sm font-semibold text-gray-800">{documentStats.words.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-md p-2 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-0.5">Chars</div>
                <div className="text-sm font-semibold text-gray-800">{documentStats.characters.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-md p-2 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-0.5">Time</div>
                <div className="text-sm font-semibold text-gray-800">{documentStats.readingTime}m</div>
              </div>
              <div className="bg-white rounded-md p-2 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-0.5">FK</div>
                <div 
                  className="text-sm font-semibold cursor-help"
                  title={`Flesch-Kincaid Grade Level: ${documentStats.fleschKincaid.toFixed(1)} - ${getReadabilityLevel(documentStats.fleschKincaid).level} (${getReadabilityLevel(documentStats.fleschKincaid).description})`}
                >
                  <span className={getReadabilityLevel(documentStats.fleschKincaid).color}>
                    {documentStats.fleschKincaid.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Show existing suggestions during analysis */}
          <div className="flex-1 overflow-y-auto">
            {suggestions.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p>No suggestions found yet.</p>
                <p className="text-sm mt-2">Analysis in progress...</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.startIndex}-${index}`}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedSuggestion?.startIndex === suggestion.startIndex
                        ? 'bg-blue-50 border-l-4 border-blue-500'
                        : 'hover:bg-gray-50 border-l-4 border-transparent'
                    }`}
                    onClick={() => onSelect(suggestion)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{getTypeIcon(suggestion.type)}</span>
                        <span className={`text-xs px-2 py-1 rounded-full border ${getTypeColor(suggestion.type)}`}>
                          {suggestion.type}
                        </span>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAccept(suggestion);
                          }}
                          className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                          title="Accept suggestion"
                        >
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismiss(suggestion);
                          }}
                          className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
                          title="Dismiss suggestion"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <p className="text-sm text-gray-700 mb-1">{suggestion.explanation}</p>
                      <div className="bg-gray-50 rounded p-2 text-sm">
                        <span className="line-through text-red-600">{suggestion.originalText}</span>
                        <span className="mx-2 text-gray-400">→</span>
                        <span className="text-green-700 font-medium">{suggestion.suggestion}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <Panel defaultSize={25} minSize={20} maxSize={35}>
        <div className="h-full bg-white border-l border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Suggestions</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">{filteredSuggestions.length} issues</span>
              <button
                onClick={onToggleVisibility}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                title="Hide suggestions"
              >
                <EyeSlashIcon className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Document Stats - Compact UI */}
          <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h4 className="font-medium text-xs text-gray-700 mb-2 flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>
              Document Statistics
            </h4>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white rounded-md p-2 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-0.5">Words</div>
                <div className="text-sm font-semibold text-gray-800">{documentStats.words.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-md p-2 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-0.5">Chars</div>
                <div className="text-sm font-semibold text-gray-800">{documentStats.characters.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-md p-2 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-0.5">Time</div>
                <div className="text-sm font-semibold text-gray-800">{documentStats.readingTime}m</div>
              </div>
              <div className="bg-white rounded-md p-2 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-0.5">FK</div>
                <div 
                  className="text-sm font-semibold cursor-help"
                  title={`Flesch-Kincaid Grade Level: ${documentStats.fleschKincaid.toFixed(1)} - ${getReadabilityLevel(documentStats.fleschKincaid).level} (${getReadabilityLevel(documentStats.fleschKincaid).description})`}
                >
                  <span className={getReadabilityLevel(documentStats.fleschKincaid).color}>
                    {documentStats.fleschKincaid.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto scrollbar-hide">
              {(['all', 'spelling', 'grammar', 'style', 'clarity', 'tone'] as FilterType[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`flex-shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeFilter === filter
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="capitalize">{filter}</span>
                  <span className="ml-1 text-xs bg-gray-100 rounded-full px-1.5 py-0.5">
                    {getFilterCount(filter)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Actions */}
          {filteredSuggestions.length > 0 && (
            <div className="p-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  {filteredSuggestions.length} visible suggestions
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleBulkAction('accept')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 transition-colors"
                  >
                    <CheckIcon className="w-3 h-3" />
                    <span>Accept All</span>
                  </button>
                  <button
                    onClick={() => handleBulkAction('dismiss')}
                    className="flex items-center space-x-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
                  >
                    <XMarkIcon className="w-3 h-3" />
                    <span>Dismiss All</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Suggestions List */}
          <div className="flex-1 overflow-y-auto">
            {filteredSuggestions.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <p>No {activeFilter === 'all' ? '' : `${activeFilter} `}suggestions found.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredSuggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.startIndex}-${index}`}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedSuggestion?.startIndex === suggestion.startIndex
                        ? 'bg-blue-50 border-l-4 border-blue-500'
                        : 'hover:bg-gray-50 border-l-4 border-transparent'
                    }`}
                    onClick={() => onSelect(suggestion)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{getTypeIcon(suggestion.type)}</span>
                        <span className={`text-xs px-2 py-1 rounded-full border ${getTypeColor(suggestion.type)}`}>
                          {suggestion.type}
                        </span>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAccept(suggestion);
                          }}
                          className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                          title="Accept suggestion"
                        >
                          <CheckIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismiss(suggestion);
                          }}
                          className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
                          title="Dismiss suggestion"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <p className="text-sm text-gray-700 mb-1">{suggestion.explanation}</p>
                      <div className="bg-gray-50 rounded p-2 text-sm">
                        <span className="line-through text-red-600">{suggestion.originalText}</span>
                        <span className="mx-2 text-gray-400">→</span>
                        <span className="text-green-700 font-medium">{suggestion.suggestion}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>
      <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-gray-300 transition-colors" />
    </>
  );
};

export default SuggestionsSidebar;