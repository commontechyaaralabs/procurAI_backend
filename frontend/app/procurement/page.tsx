'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Submission {
  id: string;
  timestamp: string;
  customerId?: string;
  requestId?: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  costCenter: string;
  class: string;
  type: string;
  itemName: string;
  description: string;
  quantity: string;
  preferredVendor: string;
  estimatedCost: string;
  priority: string;
  requiredDate: string;
  stage: string;
}

export default function ProcurementDashboard() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/fetch-submissions');
      
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Filter submissions that are approved and ready for procurement
        const procurementSubmissions = result.data.filter((sub: Submission) => 
          sub.stage === 'Internal Approval' || 
          sub.stage === 'Sourcing' || 
          sub.stage === 'Negotiations' ||
          sub.stage === 'Finalisation' ||
          sub.stage === 'Approval' ||
          sub.stage === 'PO Creation'
        );
        
        // Sort by timestamp (newest first)
        procurementSubmissions.sort((a: Submission, b: Submission) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        setSubmissions(procurementSubmissions);
      } else {
        setError(result.error || 'Failed to fetch submissions');
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('An error occurred while fetching submissions');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Internal Approval':
        return 'bg-blue-100 text-blue-800';
      case 'Sourcing':
        return 'bg-purple-100 text-purple-800';
      case 'Negotiations':
        return 'bg-indigo-100 text-indigo-800';
      case 'Finalisation':
        return 'bg-pink-100 text-pink-800';
      case 'Approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'PO Creation':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const backgroundClasses = 'min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 py-12 px-4 sm:px-6 lg:px-8';
  const headerClasses = 'bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8 sm:px-10';

  return (
    <div className={backgroundClasses}>
      <div className="mx-auto max-w-7xl">
        <div className="bg-white shadow-2xl rounded-xl overflow-hidden">
          <div className={headerClasses}>
            <h1 className="text-3xl font-bold text-white mb-2">
              Procurement Dashboard
            </h1>
            <p className="text-blue-100">
              Manage procurement requests and track progress
            </p>
          </div>

          <div className="px-6 py-8 sm:px-10">
            {loading ? (
              <div className="text-center py-12 text-gray-500">
                <p>Loading requests...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={fetchSubmissions}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Retry
                </button>
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No requests available for procurement</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Request ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requester
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Department
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estimated Budget
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {submissions.map((submission) => (
                      <tr key={submission.requestId || submission.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono font-medium text-blue-600">
                            {submission.requestId || submission.id}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {submission.itemName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {submission.description?.substring(0, 50)}
                            {submission.description && submission.description.length > 50 ? '...' : ''}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{submission.requesterName}</div>
                          <div className="text-sm text-gray-500">{submission.requesterEmail}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {submission.department}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {submission.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${parseFloat(submission.estimatedCost || '0').toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(submission.priority)}`}>
                            {submission.priority?.toUpperCase() || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStageColor(submission.stage)}`}>
                            {submission.stage}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => router.push(`/procurement/${submission.requestId || submission.id}`)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            View Details →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

