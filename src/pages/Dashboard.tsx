import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import { IconFile, IconPlus, IconTrash, IconClock, IconEdit } from '../assets/Icons';

// Define the type for a document based on your Supabase schema
type Document = Database['public']['Tables']['documents']['Row'];

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) {
          throw error;
        }
        if (data) {
          setDocuments(data);
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
        alert('Failed to fetch documents.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [user]);

  const createNewDocument = async () => {
    if (!user || !newDocTitle.trim()) return;
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          title: newDocTitle.trim(),
          content: ''
        })
        .select()
        .single();

      if (error) {
        throw error;
      }
      if (data) {
        setDocuments([data, ...documents]);
        setShowNewDocModal(false);
        setNewDocTitle('');
        navigate(`/editor/${data.id}`);
      }
    } catch (error) {
      console.error('Error creating new document:', error);
      alert('Failed to create a new document.');
    }
  };

  const deleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation when clicking delete
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;

      setDocuments(documents.filter(doc => doc.id !== docId));
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document.');
    }
  };

  const formatDate = (dateString: string | number | Date) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  }

  const getDocumentPreview = (content: string) => {
    if (!content) return 'Empty document';
    const plainText = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
    return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                  <IconFile className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  PaperWise
                </h1>
            </div>
            <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 hidden sm:block font-medium">
                  {user?.email}
                </span>
                <button
                  onClick={signOut}
                  className="px-4 py-2 border border-gray-200 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-sm"
                >
                  Sign out
                </button>
            </div>
        </div>
      </header>
      
      <main className="relative">
        <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
          <div className="px-4 sm:px-0 flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Your Documents</h2>
              <p className="text-gray-600 mt-1">Create, edit, and manage your academic papers</p>
            </div>
            <button
              onClick={() => setShowNewDocModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform hover:scale-105"
            >
              <IconPlus className="w-5 h-5" />
              New Document
            </button>
          </div>

          <div className="mt-8">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl shadow-sm animate-pulse border border-gray-100">
                        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                ))}
              </div>
            ) : documents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {documents.map((doc, index) => (
                  <div 
                    key={doc.id} 
                    onClick={() => navigate(`/editor/${doc.id}`)}
                    className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 border border-gray-100 overflow-hidden document-card paper-texture"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Paper-like design with subtle texture */}
                    <div className="relative p-6 h-64 flex flex-col">
                      {/* Document header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                            {doc.title}
                          </h3>
                        </div>
                        <button
                          onClick={(e) => deleteDocument(doc.id, e)}
                          className="p-1.5 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all duration-200 ml-2"
                          title="Delete document"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Document preview */}
                      <div className="flex-1">
                        <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">
                          {getDocumentPreview(doc.content || '')}
                        </p>
                      </div>

                      {/* Document footer */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <IconClock className="w-3 h-3" />
                            <span>{formatDate(doc.updated_at)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-indigo-600 font-medium">
                            <IconEdit className="w-3 h-3" />
                            <span>Edit</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Subtle paper fold effect */}
                    <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-gray-100"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div 
                onClick={() => setShowNewDocModal(true)} 
                className="text-center p-16 border-2 border-dashed border-gray-300 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-all duration-300 group"
              >
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <IconFile className="h-8 w-8 text-indigo-600"/>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No documents yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Start your academic journey by creating your first document. 
                  Write papers, research notes, or any academic content with AI assistance.
                </p>
                <button className="inline-flex items-center gap-2 px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200">
                  <IconPlus className="w-5 h-5" />
                  Create Your First Document
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Document Modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md transform transition-all duration-300 scale-100">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
                <IconFile className="h-6 w-6 text-indigo-600"/>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Create New Document</h3>
              <p className="text-gray-600 mt-1">Give your document a meaningful title</p>
            </div>
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createNewDocument()}
              placeholder="e.g., Research Paper on Machine Learning"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              autoFocus
            />
            <div className="mt-8 flex justify-end space-x-3">
              <button
                onClick={() => { setShowNewDocModal(false); setNewDocTitle(''); }}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={createNewDocument}
                disabled={!newDocTitle.trim()}
                className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Create Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;