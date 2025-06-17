import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';
import { IconFile, IconPlus, IconTrash } from '../assets/Icons';

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
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <div className="flex items-center space-x-2">
                <IconFile className="h-8 w-8 text-indigo-600" />
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">ClarityWrite</h1>
            </div>
            <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600 hidden sm:block">
                  {user?.email}
                </span>
                <button
                  onClick={signOut}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-600 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  Sign out
                </button>
            </div>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-10 sm:px-6 lg:px-8">
          <div className="px-4 sm:px-0 flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Your Documents</h2>
            <button
              onClick={() => setShowNewDocModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              <IconPlus className="w-5 h-5" />
              New Document
            </button>
          </div>

          <div className="mt-8">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl shadow-sm animate-pulse">
                        <div className="h-5 bg-gray-200 rounded w-3/4 mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                ))}
              </div>
            ) : documents.length > 0 ? (
              <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {documents.map((doc) => (
                  <li key={doc.id} onClick={() => navigate(`/editor/${doc.id}`)}
                      className="group bg-white p-6 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col justify-between">
                    <div>
                        <p className="text-lg font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors truncate">{doc.title}</p>
                        <p className="text-sm text-gray-500 mt-2">
                          Last updated: {formatDate(doc.updated_at)}
                        </p>
                    </div>
                    <div className="mt-4 flex justify-end">
                       <button
                            onClick={(e) => deleteDocument(doc.id, e)}
                            className="p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete document"
                        >
                           <IconTrash className="w-5 h-5" />
                        </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div onClick={() => setShowNewDocModal(true)} className="text-center p-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-gray-100/50 cursor-pointer transition-colors">
                 <IconFile className="mx-auto h-12 w-12 text-gray-400"/>
                <h3 className="mt-2 text-lg font-medium text-gray-900">No documents yet</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new document.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Document Modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Document</h3>
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createNewDocument()}
              placeholder="Enter document title..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => { setShowNewDocModal(false); setNewDocTitle(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createNewDocument}
                disabled={!newDocTitle.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
