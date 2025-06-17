import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/supabase';

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">ClarityWrite</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 hidden sm:block">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-10 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800">Your Documents</h2>
            <button
              onClick={() => setShowNewDocModal(true)}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              New Document
            </button>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {loading ? (
              <p className="text-center p-8 text-gray-500">Loading documents...</p>
            ) : documents.length > 0 ? (
              <ul role="list" className="divide-y divide-gray-200">
                {documents.map((doc) => (
                  <li key={doc.id} className="hover:bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div 
                          onClick={() => navigate(`/editor/${doc.id}`)}
                          className="flex-1 cursor-pointer"
                        >
                          <p className="text-md font-medium text-indigo-600 truncate">{doc.title}</p>
                          <div className="mt-2 sm:flex sm:justify-between">
                            <div className="sm:flex">
                              <p className="flex items-center text-sm text-gray-500">
                                Last updated on {new Date(doc.updated_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <button
                            onClick={(e) => deleteDocument(doc.id, e)}
                            className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center p-12 border-2 border-dashed border-gray-300 rounded-lg">
                <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new document.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Document Modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Document</h3>
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Enter document title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowNewDocModal(false);
                  setNewDocTitle('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={createNewDocument}
                disabled={!newDocTitle.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
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
