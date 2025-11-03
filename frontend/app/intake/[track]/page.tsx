'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Define all stages in order
const STAGES = [
  'Intake',
  'Internal Approval',
  'Sourcing',
  'Negotiations',
  'Legal and Compliance',
  'Approval',
  'Purchase Order',
  'Track the Delivery',
  'Completion',
  'Payment Done',
];

export default function TrackByRequestId() {
  const params = useParams();
  const router = useRouter();
  const requestId = params?.track as string;

  const [submission, setSubmission] = useState<{
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
  } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [vendorsQuotesSentTo, setVendorsQuotesSentTo] = useState<string[]>([]);

  // Fetch submission by Request ID
  useEffect(() => {
    if (requestId) {
      fetchSubmission(requestId);
    }
  }, [requestId]);

  // Fetch vendors quotes were sent to - separate function for reusability
  // Using useCallback to ensure stable reference
  const fetchVendorsSentQuotes = useCallback(async (requestId: string) => {
    try {
      const response = await fetch(`/api/vendors-sent-quotes?requestId=${encodeURIComponent(requestId)}`);
      const result = await response.json();
      
      if (result.success && result.vendors) {
        setVendorsQuotesSentTo(result.vendors);
        console.log('Loaded vendors quotes sent to from API:', result.vendors);
        // Also sync to localStorage for consistency
        localStorage.setItem(`vendorsQuotesSentTo_${requestId}`, JSON.stringify(result.vendors));
        return result.vendors;
      } else {
        // Fallback to localStorage if API fails
        const stored = localStorage.getItem(`vendorsQuotesSentTo_${requestId}`);
        if (stored) {
          try {
            const vendorsSent = JSON.parse(stored);
            setVendorsQuotesSentTo(vendorsSent);
            console.log('Loaded vendors quotes sent to from localStorage (fallback):', vendorsSent);
            return vendorsSent;
          } catch (e) {
            console.error('Error parsing stored vendors:', e);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching vendors sent quotes:', err);
      // Fallback to localStorage
      const stored = localStorage.getItem(`vendorsQuotesSentTo_${requestId}`);
      if (stored) {
        try {
          const vendorsSent = JSON.parse(stored);
          setVendorsQuotesSentTo(vendorsSent);
          return vendorsSent;
        } catch (e) {
          console.error('Error parsing stored vendors:', e);
        }
      }
    }
    return [];
  }, []);

  // Fetch vendors quotes sent to immediately when submission is loaded
  // This ensures we have the data for completion check on reload
  useEffect(() => {
    if (submission?.requestId) {
      fetchVendorsSentQuotes(submission.requestId || submission.id);
    }
  }, [submission?.requestId, fetchVendorsSentQuotes]);

  // Fetch quotations when:
  // 1. Sourcing stage is selected
  // 2. Submission stage is Internal Approval or beyond (to check completion status on reload)
  // This ensures sourcing completion status persists after page reload
  useEffect(() => {
    if (!submission?.requestId) {
      return;
    }
    
    const submissionStage = submission.stage;
    
    // Fetch quotations if:
    // - Sourcing stage is manually selected, OR
    // - Submission stage is at Internal Approval or beyond (sourcing may have started)
    // This ensures we check sourcing completion even if stage is still "Internal Approval"
    const isAtInternalApprovalOrBeyond = submissionStage === 'Internal Approval' ||
                                         submissionStage === 'Sourcing' || 
                                         submissionStage === 'Negotiations' ||
                                         submissionStage === 'Legal and Compliance' ||
                                         submissionStage === 'Approval' ||
                                         submissionStage === 'Purchase Order' ||
                                         submissionStage === 'Track the Delivery' ||
                                         submissionStage === 'Completion' ||
                                         submissionStage === 'Payment Done';
    
    // Fetch quotations when Sourcing, Negotiations, Legal and Compliance, Approval, or Purchase Order stage is selected, or when submission is at Internal Approval or beyond
    const shouldFetch = selectedStage === 'Sourcing' || selectedStage === 'Negotiations' || selectedStage === 'Legal and Compliance' || selectedStage === 'Approval' || selectedStage === 'Purchase Order' || isAtInternalApprovalOrBeyond;
    
    if (shouldFetch) {
      fetchQuotations(submission.requestId || submission.id);
    }
  }, [submission?.requestId, selectedStage, submission?.stage]);

  const fetchSubmission = async (id: string) => {
    setFetching(true);
    setError('');
    try {
      const response = await fetch('/api/fetch-submissions');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        setError(`Server error (${response.status}): ${errorText.substring(0, 200)}`);
        setFetching(false);
        return;
      }

      const result = await response.json();
      console.log('API Response:', result);
      
      if (result.success && result.data) {
        // Normalize the data - handle both array and object formats
        const submissions = Array.isArray(result.data) ? result.data : result.data.data || [];
        
        const found = submissions.find((sub: any) => {
          const requestIdMatch = sub.requestId === id || sub.id === id;
          console.log('Checking submission:', { 
            requestId: sub.requestId, 
            id: sub.id, 
            searchId: id, 
            match: requestIdMatch 
          });
          return requestIdMatch;
        });
        
        if (found) {
          console.log('Found submission:', found);
          setSubmission(found);
          setSelectedStage(found.stage || 'Intake');
        } else {
          console.log('Request ID not found. Available IDs:', submissions.map((s: any) => s.requestId || s.id));
          setError(`Request ID "${id}" not found. Please verify the ID and try again.`);
        }
      } else {
        console.error('API returned unsuccessful response:', result);
        setError(result.error || 'Failed to fetch submissions. Please check your configuration.');
      }
    } catch (err) {
      console.error('Error fetching submission:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Network error: ${errorMessage}. Please check your connection and try again.`);
    } finally {
      setFetching(false);
    }
  };

  const getStageIndex = (stage: string) => {
    return STAGES.indexOf(stage);
  };

  const fetchQuotations = async (requestId: string) => {
    setLoadingQuotations(true);
    try {
      const response = await fetch(`/api/quotations?requestId=${encodeURIComponent(requestId)}`);
      const result = await response.json();
      
      if (result.success && result.quotations) {
        // Normalize quotation data
        const normalizedQuotations = result.quotations.map((q: any) => {
          const requestId = q['requestid'] || q['Request ID'] || '';
          const vendorName = q['vendorname'] || q['Vendor Name'] || '';
          const vendorEmail = q['vendoremail'] || q['Vendor Email'] || '';
          const unitPriceRaw = q['unitprice'] || q['Unit Price'] || 0;
          const unitPrice = typeof unitPriceRaw === 'number' 
            ? unitPriceRaw 
            : (unitPriceRaw ? parseFloat(String(unitPriceRaw)) || 0 : 0);
          const totalPriceRaw = q['totalprice'] || q['Total Price'] || 0;
          const totalPrice = typeof totalPriceRaw === 'number' 
            ? totalPriceRaw 
            : (totalPriceRaw ? parseFloat(String(totalPriceRaw)) || 0 : 0);
          const deliveryTime = q['deliverytime'] || q['Delivery Time'] || '';
          const submittedDate = q['submitteddate'] || q['Submitted Date'] || '';
          const negotiatedAmountRaw = q['negotiatedamount'] || q['Negotiated Amount'] || 0;
          const negotiatedAmount = typeof negotiatedAmountRaw === 'number' 
            ? negotiatedAmountRaw 
            : (negotiatedAmountRaw ? parseFloat(String(negotiatedAmountRaw)) || 0 : 0);
          const negotiationNotes = q['negotiationnotes'] || q['Negotiation Notes'] || '';
          
          let selected = q['selected'] !== undefined ? q['selected'] : (q['Selected'] !== undefined ? q['Selected'] : 0);
          if (selected !== undefined && selected !== null && selected !== '') {
            const selectedNum = typeof selected === 'number' ? selected : parseFloat(String(selected));
            selected = (!isNaN(selectedNum) && selectedNum === 1) ? 1 : 0;
          } else {
            selected = 0;
          }

          // Parse Agreement Accepted
          const agreementAcceptedRaw = q['agreementaccepted'] || q['Agreement Accepted'] || 0;
          let agreementAccepted = 0;
          if (agreementAcceptedRaw !== undefined && agreementAcceptedRaw !== null && agreementAcceptedRaw !== '') {
            const agreementNum = typeof agreementAcceptedRaw === 'number' ? agreementAcceptedRaw : parseFloat(String(agreementAcceptedRaw));
            agreementAccepted = (!isNaN(agreementNum) && agreementNum === 1) ? 1 : 0;
          }

          // Parse Vendor Approved
          const vendorApprovedRaw = q['vendorapproved'] || q['Vendor Approved'] || 0;
          let vendorApproved = 0;
          if (vendorApprovedRaw !== undefined && vendorApprovedRaw !== null && vendorApprovedRaw !== '') {
            const vendorApprovedNum = typeof vendorApprovedRaw === 'number' ? vendorApprovedRaw : parseFloat(String(vendorApprovedRaw));
            vendorApproved = (!isNaN(vendorApprovedNum) && vendorApprovedNum === 1) ? 1 : 0;
          }

          // Parse PO Sent
          const poSentRaw = q['posent'] || q['PO Sent'] || 0;
          let poSent = 0;
          if (poSentRaw !== undefined && poSentRaw !== null && poSentRaw !== '') {
            const poSentNum = typeof poSentRaw === 'number' ? poSentRaw : parseFloat(String(poSentRaw));
            poSent = (!isNaN(poSentNum) && poSentNum === 1) ? 1 : 0;
          }

          // Parse PO Number and PO Date
          const poNumber = q['ponumber'] || q['PO Number'] || '';
          const poDate = q['podate'] || q['PO Date'] || '';

          // Parse Shipping Details
          const shipVia = q['shipvia'] || q['Ship Via'] || '';
          const fob = q['fob'] || q['F.O.B.'] || '';
          const shippingTerms = q['shippingterms'] || q['Shipping Terms'] || '';

          // Parse Phone Number if available
          const phoneNumber = q['phonenumber'] || q['Phone Number'] || '';

          return {
            'Request ID': requestId,
            'Vendor Name': vendorName,
            'Vendor Email': vendorEmail,
            'Phone Number': phoneNumber,
            'Unit Price': unitPrice,
            'Total Price': totalPrice,
            'Delivery Time': deliveryTime,
            'Submitted Date': submittedDate,
            'Negotiated Amount': negotiatedAmount,
            'Negotiation Notes': negotiationNotes,
            'Selected': selected,
            'Agreement Accepted': agreementAccepted,
            'Vendor Approved': vendorApproved,
            'PO Sent': poSent,
            'PO Number': poNumber,
            'PO Date': poDate,
            'Ship Via': shipVia,
            'F.O.B.': fob,
            'Shipping Terms': shippingTerms,
          };
        });

        setQuotations(normalizedQuotations);
        
        // DON'T overwrite vendorsQuotesSentTo from quotations data
        // vendorsQuotesSentTo should come from localStorage (vendors who received emails)
        // Quotations data is only for checking which vendors submitted quotes and were selected
      }
    } catch (err) {
      console.error('Error fetching quotations:', err);
    } finally {
      setLoadingQuotations(false);
    }
  };

  const getStageMessage = (stage: string) => {
    const messages: { [key: string]: string } = {
      'Intake': 'Your request has been submitted and is in the intake queue.',
      'Internal Approval': 'Your request has been approved by the manager and is now moved to sourcing.',
      'Internal Rejected': 'Your request has been rejected by the internal team. The order cannot proceed at this time.',
      'Sourcing': 'The procurement team is sourcing vendors and quotes for your request.',
      'Negotiations': 'Negotiations are in progress with selected vendors.',
      'Legal and Compliance': 'Legal and compliance review is in progress.',
      'Approval': 'Waiting for final approval before proceeding.',
      'Purchase Order': 'Purchase order is being created and processed.',
      'Track the Delivery': 'Your order has been placed. Tracking delivery status.',
      'Completion': 'Order has been completed and delivered.',
      'Payment Done': 'Payment has been processed. Request is complete.',
    };
    return messages[stage] || 'Processing your request...';
  };

  const backgroundClasses = 'min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 py-12 px-4 sm:px-6 lg:px-8';
  const headerClasses = 'bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8 sm:px-10';

  return (
    <div className={backgroundClasses}>
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow-xl rounded-xl overflow-hidden sticky top-4">
              <div className={headerClasses}>
                <h2 className="text-xl font-bold text-white">Stages</h2>
              </div>
              <div className="p-4">
                <nav className="space-y-2">
                  {STAGES.map((stage, index) => {
                    const submissionStage = submission?.stage;
                    const isCurrentStage = submissionStage === stage || (submissionStage === 'Internal Approval' && stage === 'Internal Approval');
                    
                    // Determine if stage is completed:
                    // 1. Stage has been passed (current stage index > stage index)
                    // 2. OR it's the current stage (already reached)
                    // Exception: Internal Rejected should not be marked as completed
                    let isCompleted = false;
                    
                    if (submission && submissionStage && submissionStage !== 'Internal Rejected') {
                      const currentStageIndex = getStageIndex(submissionStage);
                      // Stage is completed if:
                      // - Current stage index >= this stage index (reached or passed this stage)
                      // This means if we're at "Internal Approval" (index 1), both "Intake" (0) and "Internal Approval" (1) are completed
                      if (currentStageIndex >= 0) {
                        // Base logic: if current stage has reached or passed this stage, it's completed
                        isCompleted = currentStageIndex >= index;
                        
                        // Special logic for Internal Approval: 
                        // Mark as completed if we're at Internal Approval stage or any stage beyond it
                        // This ensures that when approval happens, it shows the green tick immediately
                        if (stage === 'Internal Approval') {
                          // Internal Approval is complete if:
                          // - We're currently at Internal Approval stage (currentStageIndex = 1, index = 1, so 1 >= 1 = true)
                          // - We're at any stage beyond Internal Approval (currentStageIndex > 1)
                          // This covers both cases: when approval just happened, and when we've moved past it
                          if (submissionStage === 'Internal Approval' || currentStageIndex > 1) {
                            isCompleted = true;
                          }
                        }
                        
                        // Special logic for Sourcing: Mark as completed if:
                        // 1. Vendors have been sent quotes (vendorsQuotesSentTo.length > 0) - PRIMARY CHECK
                        // 2. Vendors have been selected (quotations with Selected = 1)
                        // 3. Stage has moved beyond Sourcing
                        if (stage === 'Sourcing') {
                          // Check if quotes have been sent to vendors (this is the primary indicator from Google Sheets)
                          // If vendorsQuotesSentTo has data, it means sourcing was completed in procurement dashboard
                          const hasVendorsSentQuotes = vendorsQuotesSentTo.length > 0;
                          
                          // Check if vendors have been selected from quotations
                          const hasSelectedVendors = quotations.length > 0 && quotations.some(q => {
                            const selectedValue = q['Selected'];
                            return selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                          });
                          
                          // Sourcing is complete if:
                          // - Quotes were sent to vendors (data exists in sheet), OR
                          // - Vendors are selected, OR
                          // - Stage moved beyond Sourcing (currentStageIndex > 2)
                          if (hasVendorsSentQuotes || hasSelectedVendors || currentStageIndex > 2) {
                            isCompleted = true;
                          }
                        }
                        
                        // Special logic for Negotiations: Mark as completed if:
                        // 1. There is at least one selected vendor with both Negotiation Notes AND Negotiated Amount
                        // 2. Stage has moved beyond Negotiations
                        if (stage === 'Negotiations') {
                          // Check if there's at least one quotation with both Negotiation Notes and Negotiated Amount
                          const hasNegotiationData = quotations.length > 0 && quotations.some(q => {
                            const selectedValue = q['Selected'];
                            const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                            
                            // Check for Negotiated Amount
                            const hasNegotiatedAmount = q['Negotiated Amount'] && 
                              (typeof q['Negotiated Amount'] === 'number' ? q['Negotiated Amount'] > 0 : parseFloat(String(q['Negotiated Amount'])) > 0);
                            
                            // Check for Negotiation Notes
                            const hasNegotiationNotes = q['Negotiation Notes'] && 
                              String(q['Negotiation Notes']).trim().length > 0;
                            
                            return isSelected && hasNegotiatedAmount && hasNegotiationNotes;
                          });
                          
                          // Negotiations is complete if:
                          // - Both Negotiation Notes and Negotiated Amount exist for at least one selected vendor, OR
                          // - Stage moved beyond Negotiations (currentStageIndex > 3)
                          if (hasNegotiationData || currentStageIndex > 3) {
                            isCompleted = true;
                          }
                        }
                        
                        // Special logic for Legal and Compliance: Mark as completed if:
                        // 1. There is at least one selected vendor with Agreement Accepted = 1
                        // 2. Stage has moved beyond Legal and Compliance
                        if (stage === 'Legal and Compliance') {
                          // Check if there's at least one quotation with Agreement Accepted = 1
                          const hasAgreementAccepted = quotations.length > 0 && quotations.some(q => {
                            const selectedValue = q['Selected'];
                            const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                            const agreementAccepted = q['Agreement Accepted'] === 1 || q['Agreement Accepted'] === '1' || q['Agreement Accepted'] === true;
                            return isSelected && agreementAccepted;
                          });
                          
                          // Legal and Compliance is complete if:
                          // - Agreement Accepted = 1 for at least one selected vendor, OR
                          // - Stage moved beyond Legal and Compliance (currentStageIndex > 4)
                          if (hasAgreementAccepted || currentStageIndex > 4) {
                            isCompleted = true;
                          }
                        }
                        
                        // Special logic for Approval: Mark as completed if:
                        // 1. There is at least one selected vendor with Vendor Approved = 1
                        // 2. Stage has moved beyond Approval
                        if (stage === 'Approval') {
                          // Check if there's at least one quotation with Vendor Approved = 1
                          const hasVendorApproved = quotations.length > 0 && quotations.some(q => {
                            const selectedValue = q['Selected'];
                            const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                            const vendorApproved = q['Vendor Approved'] === 1 || q['Vendor Approved'] === '1' || q['Vendor Approved'] === true;
                            return isSelected && vendorApproved;
                          });
                          
                          // Approval is complete if:
                          // - Vendor Approved = 1 for at least one selected vendor, OR
                          // - Stage moved beyond Approval (currentStageIndex > 5)
                          if (hasVendorApproved || currentStageIndex > 5) {
                            isCompleted = true;
                          }
                        }
                        
                        // Special logic for Purchase Order: Mark as completed if:
                        // 1. There is at least one selected vendor with PO Sent = 1
                        // 2. Stage has moved beyond Purchase Order
                        if (stage === 'Purchase Order') {
                          // Check if there's at least one quotation with PO Sent = 1
                          const hasPOSent = quotations.length > 0 && quotations.some(q => {
                            const selectedValue = q['Selected'];
                            const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                            const poSent = q['PO Sent'] === 1 || q['PO Sent'] === '1' || q['PO Sent'] === true;
                            return isSelected && poSent;
                          });
                          
                          // Purchase Order is complete if:
                          // - PO Sent = 1 for at least one selected vendor, OR
                          // - Stage moved beyond Purchase Order (currentStageIndex > 6)
                          if (hasPOSent || currentStageIndex > 6) {
                            isCompleted = true;
                          }
                        }
                      }
                    }
                    
                    const isRejected = submissionStage === 'Internal Rejected';
                    // Auto-select current stage if none selected, otherwise use manually selected
                    const isSelected = selectedStage === stage || (!selectedStage && isCurrentStage);
                    
                    return (
                      <button
                        key={stage}
                        onClick={() => setSelectedStage(stage)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : isCompleted
                            ? 'bg-green-50 text-green-800 border-2 border-green-500'
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <span className="text-sm font-medium">{stage}</span>
                            {/* Show vendors quotes were sent to (from localStorage - matches procurement dashboard exactly) */}
                            {stage === 'Sourcing' && vendorsQuotesSentTo.length > 0 && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Sent to {vendorsQuotesSentTo.length} vendor{vendorsQuotesSentTo.length > 1 ? 's' : ''}
                              </p>
                            )}
                            {/* Show selected vendors count */}
                            {stage === 'Sourcing' && quotations.length > 0 && quotations.filter(q => {
                              const selectedValue = q['Selected'];
                              return selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                            }).length > 0 && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {quotations.filter(q => {
                                  const selectedValue = q['Selected'];
                                  return selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                }).length} vendor{quotations.filter(q => {
                                  const selectedValue = q['Selected'];
                                  return selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                }).length > 1 ? 's' : ''} selected
                              </p>
                            )}
                          </div>
                          {isCompleted && (
                            <svg className="w-5 h-5 text-green-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {/* Show rejected stage separately if rejected */}
                  {submission?.stage === 'Internal Rejected' && (
                    <button
                      onClick={() => setSelectedStage('Internal Rejected')}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedStage === 'Internal Rejected'
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'bg-red-50 text-red-800 border-2 border-red-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Internal Rejected</span>
                        <svg className="w-5 h-5 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                  )}
                </nav>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
        <div className="bg-white shadow-2xl rounded-xl overflow-hidden">
          <div className={headerClasses}>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Track Request: {requestId}
              </h1>
              <p className="text-blue-100">
                View the status of your procurement request
              </p>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-10">
            {fetching ? (
              <div className="text-center py-12 text-gray-500">
                <p>Loading request details...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 mb-4">{error}</p>
              </div>
            ) : submission ? (
              <>
                {/* Show Request Details when Intake is selected */}
                {(selectedStage === 'Intake' || (!selectedStage && submission.stage === 'Intake')) ? (
                  <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Your Request Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Item Name:</p>
                        <p className="text-base font-semibold text-gray-900">{submission.itemName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Type:</p>
                        <p className="text-base font-semibold text-gray-900 capitalize">{submission.type}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Class:</p>
                        <p className="text-base font-semibold text-gray-900 capitalize">{submission.class}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Quantity:</p>
                        <p className="text-base font-semibold text-gray-900">{submission.quantity}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Estimated Budget:</p>
                        <p className="text-base font-semibold text-gray-900">₹{parseFloat(submission.estimatedCost).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Priority:</p>
                        <p className="text-base font-semibold text-gray-900 uppercase">{submission.priority}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Required Date:</p>
                        <p className="text-base font-semibold text-gray-900">{submission.requiredDate}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Preferred Vendor:</p>
                        <p className="text-base font-semibold text-gray-900">{submission.preferredVendor || 'Not specified'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-gray-600 mb-1">Description:</p>
                        <p className="text-base text-gray-900">{submission.description}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Requester:</p>
                        <p className="text-base font-semibold text-gray-900">{submission.requesterName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600 mb-1">Department:</p>
                        <p className="text-base font-semibold text-gray-900">{submission.department}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Show stage-specific message for other stages */
                  (selectedStage === 'Internal Rejected' || submission.stage === 'Internal Rejected') ? (
                    <div className="mb-6 bg-red-50 border-l-4 border-red-600 p-4 rounded-lg">
                      <div className="flex items-start">
                        <div className="shrink-0">
                          <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-lg font-medium text-red-900">
                            Internal Rejected
                          </h3>
                          <p className="mt-1 text-sm text-red-700">
                            {getStageMessage('Internal Rejected')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (selectedStage === 'Sourcing' || submission.stage === 'Sourcing') ? (
                    <div className="mb-6 bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg">
                      <div className="flex items-start">
                        <div className="shrink-0">
                          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-lg font-medium text-blue-900">
                            Sourcing
                          </h3>
                          {loadingQuotations ? (
                            <p className="mt-1 text-sm text-blue-700">Loading sourcing details...</p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              <p className="text-sm text-blue-700">
                                {getStageMessage('Sourcing')}
                              </p>
                              {(vendorsQuotesSentTo.length > 0 || quotations.length > 0) && (
                                <div className="mt-3 bg-white rounded-lg p-4 border border-blue-200">
                                  <div className="space-y-3">
                                    {/* Show count of vendors quotes were sent to (from localStorage - matches procurement dashboard) */}
                                    {vendorsQuotesSentTo.length > 0 ? (
                                      <div className="flex items-center text-sm">
                                        <span className="font-semibold text-blue-900">Quotes Sent to:</span>
                                        <span className="ml-2 text-blue-700 font-medium">
                                          {vendorsQuotesSentTo.length} vendor{vendorsQuotesSentTo.length > 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    ) : quotations.length > 0 ? (
                                      <div className="flex items-center text-sm">
                                        <span className="font-semibold text-blue-900">Quotes Received from:</span>
                                        <span className="ml-2 text-blue-700">
                                          {quotations.length} vendor{quotations.length > 1 ? 's' : ''}
                                        </span>
                                        <span className="ml-2 text-xs text-gray-500 italic">
                                          (Some vendors may not have responded yet)
                                        </span>
                                      </div>
                                    ) : null}
                                    {quotations.length > 0 && quotations.filter(q => q['Selected'] === 1).length > 0 && (
                                      <div className="flex items-center text-sm">
                                        <span className="font-semibold text-blue-900">Vendors Selected:</span>
                                        <span className="ml-2 text-blue-700 font-medium">
                                          {quotations.filter(q => q['Selected'] === 1).length} vendor{quotations.filter(q => q['Selected'] === 1).length !== 1 ? 's are' : ' is'} selected
                                        </span>
                                      </div>
                                    )}
                                    {quotations.filter(q => q['Selected'] === 1).length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-blue-200">
                                        <p className="text-sm font-semibold text-blue-900 mb-2">Selected Vendor{quotations.filter(q => q['Selected'] === 1).length > 1 ? 's' : ''}:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                          {quotations
                                            .filter(q => q['Selected'] === 1)
                                            .map((q, idx) => (
                                              <li key={idx} className="text-sm text-blue-700">
                                                {q['Vendor Name']}
                                              </li>
                                            ))}
                                        </ul>
                                        {submission.stage === 'Negotiations' || getStageIndex(submission.stage) > getStageIndex('Sourcing') ? (
                                          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded">
                                            <p className="text-sm font-medium text-green-700">
                                              ✓ Moved to Negotiations
                                            </p>
                                          </div>
                                        ) : (
                                          <div className="mt-3 p-2 bg-blue-100 border border-blue-200 rounded">
                                            <p className="text-sm text-blue-700">
                                              Ready to proceed to Negotiations stage
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {quotations.length === 0 && vendorsQuotesSentTo.length === 0 && (
                                      <p className="text-sm text-gray-600 italic">
                                        Vendor sourcing is in progress. Quotes will be sent to vendors soon.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (selectedStage === 'Negotiations' || submission.stage === 'Negotiations') ? (
                    <div className="mb-6 bg-purple-50 border-l-4 border-purple-600 p-4 rounded-lg">
                      <div className="flex items-start">
                        <div className="shrink-0">
                          <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-lg font-medium text-purple-900">
                            Negotiations
                          </h3>
                          {loadingQuotations ? (
                            <p className="mt-1 text-sm text-purple-700">Loading negotiation details...</p>
                          ) : (
                            <div className="mt-3 space-y-4">
                              {/* Only show progress message if negotiation data is not available */}
                              {!(quotations.length > 0 && quotations.filter(q => {
                                const selectedValue = q['Selected'];
                                const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                const hasNegotiatedAmount = q['Negotiated Amount'] && 
                                  (typeof q['Negotiated Amount'] === 'number' ? q['Negotiated Amount'] > 0 : parseFloat(String(q['Negotiated Amount'])) > 0);
                                const hasNegotiationNotes = q['Negotiation Notes'] && 
                                  String(q['Negotiation Notes']).trim().length > 0;
                                return isSelected && hasNegotiatedAmount && hasNegotiationNotes;
                              }).length > 0) && (
                                <p className="text-sm text-purple-700">
                                  {getStageMessage('Negotiations')}
                                </p>
                              )}
                              
                              {/* Show negotiated vendors with pricing details */}
                              {quotations.length > 0 && quotations.filter(q => {
                                const selectedValue = q['Selected'];
                                const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                const hasNegotiatedAmount = q['Negotiated Amount'] && 
                                  (typeof q['Negotiated Amount'] === 'number' ? q['Negotiated Amount'] > 0 : parseFloat(String(q['Negotiated Amount'])) > 0);
                                const hasNegotiationNotes = q['Negotiation Notes'] && 
                                  String(q['Negotiation Notes']).trim().length > 0;
                                return isSelected && hasNegotiatedAmount && hasNegotiationNotes;
                              }).length > 0 ? (
                                <div className="mt-4 bg-white rounded-lg p-4 border border-purple-200 space-y-4">
                                  <h4 className="text-base font-semibold text-purple-900 mb-3">
                                    Negotiation Results
                                  </h4>
                                  {quotations
                                    .filter(q => {
                                      const selectedValue = q['Selected'];
                                      const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                      const hasNegotiatedAmount = q['Negotiated Amount'] && 
                                        (typeof q['Negotiated Amount'] === 'number' ? q['Negotiated Amount'] > 0 : parseFloat(String(q['Negotiated Amount'])) > 0);
                                      const hasNegotiationNotes = q['Negotiation Notes'] && 
                                        String(q['Negotiation Notes']).trim().length > 0;
                                      return isSelected && hasNegotiatedAmount && hasNegotiationNotes;
                                    })
                                    .map((q, idx) => {
                                      const totalPrice = typeof q['Total Price'] === 'number' 
                                        ? q['Total Price'] 
                                        : parseFloat(String(q['Total Price'] || 0));
                                      const negotiatedAmount = typeof q['Negotiated Amount'] === 'number' 
                                        ? q['Negotiated Amount'] 
                                        : parseFloat(String(q['Negotiated Amount'] || 0));
                                      const savings = totalPrice - negotiatedAmount;
                                      
                                      return (
                                        <div key={idx} className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-300">
                                          <div className="flex items-center justify-between mb-3">
                                            <h5 className="text-lg font-bold text-gray-900">
                                              {q['Vendor Name'] || 'Unknown Vendor'}
                                            </h5>
                                            {savings > 0 && (
                                              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-bold rounded-full">
                                                Saved ₹{savings.toLocaleString()}
                                              </span>
                                            )}
                                          </div>
                                          
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                                            <div className="bg-white p-3 rounded-lg border border-gray-200">
                                              <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                                                Quoted Price
                                              </p>
                                              <p className="text-xl font-bold text-gray-700">
                                                ₹{totalPrice.toLocaleString()}
                                              </p>
                                            </div>
                                            
                                            <div className="bg-white p-3 rounded-lg border border-purple-300">
                                              <p className="text-xs font-medium text-purple-600 uppercase mb-1">
                                                Negotiated Amount
                                              </p>
                                              <p className="text-xl font-bold text-purple-700">
                                                ₹{negotiatedAmount.toLocaleString()}
                                              </p>
                                            </div>
                                            
                                            <div className={`p-3 rounded-lg border ${
                                              savings > 0 
                                                ? 'bg-green-50 border-green-300' 
                                                : savings < 0 
                                                ? 'bg-red-50 border-red-300' 
                                                : 'bg-gray-50 border-gray-300'
                                            }`}>
                                              <p className="text-xs font-medium text-gray-600 uppercase mb-1">
                                                You Saved
                                              </p>
                                              <p className={`text-xl font-bold ${
                                                savings > 0 
                                                  ? 'text-green-700' 
                                                  : savings < 0 
                                                  ? 'text-red-700' 
                                                  : 'text-gray-700'
                                              }`}>
                                                ₹{Math.abs(savings).toLocaleString()}
                                              </p>
                                            </div>
                                          </div>
                                          
                                          {q['Negotiation Notes'] && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                              <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                                                Negotiation Notes
                                              </p>
                                              <p className="text-sm text-gray-700 italic">
                                                {q['Negotiation Notes']}
                                              </p>
                                            </div>
                                          )}
                                          
                                          {q['Delivery Time'] && (
                                            <div className="mt-2 flex items-center text-xs text-gray-600">
                                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              Delivery Time: {q['Delivery Time']}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              ) : quotations.length > 0 && quotations.filter(q => {
                                const selectedValue = q['Selected'];
                                return selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                              }).length > 0 ? (
                                <div className="mt-4 bg-white rounded-lg p-4 border border-purple-200">
                                  <p className="text-sm text-purple-700">
                                    Negotiations are in progress. Details will be updated once negotiations are completed.
                                  </p>
                                  <div className="mt-3 space-y-2">
                                    <p className="text-sm font-semibold text-purple-900">Selected Vendors:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                      {quotations
                                        .filter(q => {
                                          const selectedValue = q['Selected'];
                                          return selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                        })
                                        .map((q, idx) => (
                                          <li key={idx} className="text-sm text-purple-700">
                                            {q['Vendor Name']}
                                            {q['Total Price'] && (
                                              <span className="ml-2 text-gray-600">
                                                (Quoted: ₹{typeof q['Total Price'] === 'number' 
                                                  ? q['Total Price'].toLocaleString() 
                                                  : parseFloat(String(q['Total Price'] || 0)).toLocaleString()})
                                              </span>
                                            )}
                                          </li>
                                        ))}
                                    </ul>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-4 bg-white rounded-lg p-4 border border-purple-200">
                                  <p className="text-sm text-purple-700">
                                    Waiting for vendors to be selected for negotiations.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (selectedStage === 'Legal and Compliance' || submission.stage === 'Legal and Compliance') ? (
                    <div className="mb-6 bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-lg">
                      <div className="flex items-start">
                        <div className="shrink-0">
                          <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-lg font-medium text-indigo-900">
                            Legal and Compliance
                          </h3>
                          {loadingQuotations ? (
                            <p className="mt-1 text-sm text-indigo-700">Loading compliance details...</p>
                          ) : (
                            <div className="mt-3 space-y-4">
                              {/* Check if agreement has been accepted */}
                              {quotations.length > 0 && quotations.filter(q => {
                                const selectedValue = q['Selected'];
                                const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                const agreementAccepted = q['Agreement Accepted'] === 1 || q['Agreement Accepted'] === '1' || q['Agreement Accepted'] === true;
                                return isSelected && agreementAccepted;
                              }).length > 0 ? (
                                <div className="mt-4 bg-white rounded-lg p-4 border border-green-300">
                                  <div className="flex items-start">
                                    <div className="shrink-0">
                                      <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                    <div className="ml-3 flex-1">
                                      <h4 className="text-base font-semibold text-green-900 mb-2">
                                        Agreement Accepted
                                      </h4>
                                      <p className="text-sm text-green-700 font-medium">
                                        Agreement has been accepted by the vendor.
                                      </p>
                                      <div className="mt-3 pt-3 border-t border-green-200">
                                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Vendor(s) with Accepted Agreement:</p>
                                        <ul className="space-y-1">
                                          {quotations
                                            .filter(q => {
                                              const selectedValue = q['Selected'];
                                              const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                              const agreementAccepted = q['Agreement Accepted'] === 1 || q['Agreement Accepted'] === '1' || q['Agreement Accepted'] === true;
                                              return isSelected && agreementAccepted;
                                            })
                                            .map((q, idx) => (
                                              <li key={idx} className="text-sm text-green-700 flex items-center">
                                                <svg className="w-4 h-4 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                {q['Vendor Name'] || 'Unknown Vendor'}
                                              </li>
                                            ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-4 bg-white rounded-lg p-4 border border-indigo-200">
                                  <p className="text-sm text-indigo-700">
                                    {getStageMessage('Legal and Compliance')}
                                  </p>
                                  {quotations.length > 0 && quotations.filter(q => {
                                    const selectedValue = q['Selected'];
                                    return selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                  }).length > 0 ? (
                                    <div className="mt-3 pt-3 border-t border-indigo-200">
                                      <p className="text-xs font-medium text-gray-500 uppercase mb-2">Waiting for agreement acceptance from:</p>
                                      <ul className="space-y-1">
                                        {quotations
                                          .filter(q => {
                                            const selectedValue = q['Selected'];
                                            return selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                          })
                                          .map((q, idx) => (
                                            <li key={idx} className="text-sm text-indigo-700">
                                              {q['Vendor Name'] || 'Unknown Vendor'}
                                            </li>
                                          ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (selectedStage === 'Approval' || submission.stage === 'Approval') ? (
                    <div className="mb-6 bg-teal-50 border-l-4 border-teal-600 p-4 rounded-lg">
                      <div className="flex items-start">
                        <div className="shrink-0">
                          <svg className="h-6 w-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-3 flex-1">
                          <h3 className="text-lg font-medium text-teal-900">
                            Approval
                          </h3>
                          {loadingQuotations ? (
                            <p className="mt-1 text-sm text-teal-700">Loading approval details...</p>
                          ) : (
                            <div className="mt-3 space-y-4">
                              {/* Check if order has been approved */}
                              {quotations.length > 0 && quotations.filter(q => {
                                const selectedValue = q['Selected'];
                                const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                                const vendorApproved = q['Vendor Approved'] === 1 || q['Vendor Approved'] === '1' || q['Vendor Approved'] === true;
                                return isSelected && vendorApproved;
                              }).length > 0 ? (
                                <div className="mt-4 bg-white rounded-lg p-4 border border-green-300">
                                  <div className="flex items-start">
                                    <div className="shrink-0">
                                      <svg className="h-6 w-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                    <div className="ml-3 flex-1">
                                      <h4 className="text-base font-semibold text-green-900 mb-2">
                                        Order Approved
                                      </h4>
                                      <p className="text-sm text-green-700 font-medium">
                                        Order has been approved.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-4 bg-white rounded-lg p-4 border border-teal-200">
                                  <p className="text-sm text-teal-700">
                                    {getStageMessage('Approval')}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (selectedStage === 'Purchase Order' || submission.stage === 'Purchase Order') ? (
                    <div className="mb-6">
                      {loadingQuotations ? (
                        <p className="mt-1 text-sm text-blue-700">Loading Purchase Order details...</p>
                      ) : (
                        <div className="mt-3 space-y-4">
                          {/* Find the selected vendor who has PO Sent = 1 */}
                          {(() => {
                            const poSentVendor = quotations.find(q => {
                              const selectedValue = q['Selected'];
                              const isSelected = selectedValue === 1 || selectedValue === '1' || selectedValue === true;
                              const poSent = q['PO Sent'] === 1 || q['PO Sent'] === '1' || q['PO Sent'] === true;
                              return isSelected && poSent;
                            });

                            if (poSentVendor) {
                              const poNumber = poSentVendor['PO Number'] || `PO-${submission.requestId || submission.id}`;
                              const poDate = poSentVendor['PO Date'] || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                              const vendorName = poSentVendor['Vendor Name'] || 'Unknown Vendor';
                              const vendorEmail = poSentVendor['Vendor Email'] || '';
                              const vendorPhone = poSentVendor['Phone Number'] || '';
                              const shipVia = poSentVendor['Ship Via'] || 'Standard Ground Shipping';
                              const fob = poSentVendor['F.O.B.'] || 'Origin';
                              const shippingTerms = poSentVendor['Shipping Terms'] || 'Net 30 Days';

                              // Get requisitioner and ship to from submission
                              const requisitioner = submission.requesterName || '';
                              const shipToName = submission.requesterName || '';
                              const shipToDept = submission.department || '';
                              const shipToEmail = submission.requesterEmail || '';

                              // Calculate item details
                              const itemTotal = typeof poSentVendor['Negotiated Amount'] === 'number' 
                                ? poSentVendor['Negotiated Amount'] 
                                : parseFloat(String(poSentVendor['Negotiated Amount'] || poSentVendor['Total Price'] || 0));
                              const itemQty = parseFloat(submission.quantity || '1');
                              const itemUnitPrice = itemQty > 0 ? itemTotal / itemQty : 0;

                              return (
                                <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
                                  {/* Header Section */}
                                  <div className="flex justify-between items-start mb-8">
                                    <div className="flex-1"></div>
                                    <div className="text-right">
                                      <h2 className="text-4xl font-bold text-gray-900 mb-4">PURCHASE ORDER</h2>
                                      <div className="space-y-2 text-sm text-gray-900">
                                        <p><span className="font-semibold">DATE:</span> {poDate}</p>
                                        <p><span className="font-semibold">PO #:</span> {poNumber}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Vendor and Ship To Section */}
                                  <div className="grid grid-cols-2 gap-4 mb-6">
                                    {/* Vendor */}
                                    <div>
                                      <h3 className="text-lg font-semibold text-gray-700 mb-2">VENDOR</h3>
                                      <p className="text-gray-800">{vendorName}</p>
                                      <p className="text-gray-600">{vendorEmail}</p>
                                      {vendorPhone && <p className="text-gray-600">Phone: {vendorPhone}</p>}
                                    </div>
                                    {/* Ship To */}
                                    <div>
                                      <h3 className="text-lg font-semibold text-gray-700 mb-2">SHIP TO</h3>
                                      <p className="text-gray-800">{shipToName}</p>
                                      {shipToDept && <p className="text-gray-600">{shipToDept}</p>}
                                      {shipToEmail && <p className="text-gray-600">{shipToEmail}</p>}
                                    </div>
                                  </div>

                                  {/* Shipping Details */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 border-t pt-4">
                                    <div>
                                      <p className="text-sm font-medium text-gray-600">REQUISITIONER</p>
                                      <p className="text-gray-800">{requisitioner}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-600">SHIP VIA</p>
                                      <p className="text-gray-800">{shipVia}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-600">F.O.B.</p>
                                      <p className="text-gray-800">{fob}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-gray-600">SHIPPING TERMS</p>
                                      <p className="text-gray-800">{shippingTerms}</p>
                                    </div>
                                  </div>

                                  {/* Items Table */}
                                  <div className="border-t pt-4">
                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">ITEMS</h3>
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ITEM #</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DESCRIPTION</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QTY</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UNIT PRICE</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TOTAL</th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          <tr>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{submission.requestId || submission.id}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{submission.itemName || submission.description}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{itemQty}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{itemUnitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg">
                                  <div className="flex items-start">
                                    <div className="shrink-0">
                                      <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </div>
                                    <div className="ml-3">
                                      <h3 className="text-lg font-medium text-blue-900">Purchase Order</h3>
                                      <p className="mt-1 text-sm text-blue-700">
                                        {getStageMessage('Purchase Order')}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-6 bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg">
                      <div className="flex items-start">
                        <div className="shrink-0">
                          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-lg font-medium text-blue-900">
                            {selectedStage || submission.stage}
                          </h3>
                          <p className="mt-1 text-sm text-blue-700">
                            {getStageMessage(selectedStage || submission.stage)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </>
            ) : null}
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}

