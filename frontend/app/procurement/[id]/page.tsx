'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

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

interface Vendor {
  name: string;
  itemName: string;
  tier?: string; // GOLD, SILVER, BRONZE
}

interface Quotation {
  'Request ID': string;
  'Vendor Name': string;
  'Vendor Email': string;
  'Phone Number'?: string;
  'Unit Price': number | string;
  'Total Price': number | string;
  'Delivery Time': string;
  'Notes': string;
  'Attachment URL'?: string;
  'Submitted Date': string;
  'Negotiation Notes'?: string;
  'Negotiated Amount'?: number | string;
  'Selected'?: number | string; // 1 for selected, 0 or empty for not selected
  'Agreement Accepted'?: number | string; // 1 for accepted, 0 or empty for not accepted
  'Agreement Sent Date'?: string;
  'Agreement Accepted Date'?: string;
  'Vendor Approved'?: number | string; // 1 for approved, 0 or empty for not approved
  'Vendor Approved Date'?: string;
  'PO Sent'?: number | string; // 1 for sent, 0 or empty for not sent
}

interface VendorHistory {
  [key: string]: any;
}

// Procurement team stages
const PROCUREMENT_STAGES = [
  'Intent Report',
  'Sourcing',
  'Review',
  'Negotiations',
  'Legal and Compliance',
  'Approval',
  'PO Creation',
];

export default function ProcurementDetail() {
  const params = useParams();
  const router = useRouter();
  const requestId = params?.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [sendingQuotes, setSendingQuotes] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [selectedVendorsForNegotiation, setSelectedVendorsForNegotiation] = useState<Set<string>>(new Set());
  const [vendorHistory, setVendorHistory] = useState<VendorHistory[]>([]);
  const [showInsight, setShowInsight] = useState(false);
  const [selectedVendorForInsight, setSelectedVendorForInsight] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [showQuotationDetail, setShowQuotationDetail] = useState(false);
  const [vendorsQuotesSentTo, setVendorsQuotesSentTo] = useState<string[]>([]);
  const [negotiationData, setNegotiationData] = useState<{[vendorName: string]: {notes: string, amount: string}}>({});
  const [savingNegotiation, setSavingNegotiation] = useState<string>('');
  const [savingAgreement, setSavingAgreement] = useState<string>('');
  const [approvedVendors, setApprovedVendors] = useState<Set<string>>(new Set());
  const [savingApproval, setSavingApproval] = useState<string>('');
  const [sendingPO, setSendingPO] = useState<string>('');

  useEffect(() => {
    if (requestId) {
      fetchSubmission();
      // Load vendors quotes sent to from localStorage
      const stored = localStorage.getItem(`vendorsQuotesSentTo_${requestId}`);
      if (stored) {
        try {
          setVendorsQuotesSentTo(JSON.parse(stored));
        } catch (e) {
          console.error('Error parsing stored vendors:', e);
        }
      }
    }
  }, [requestId]);

  // Fetch quotations when submission is loaded to check for selected vendors
  useEffect(() => {
    if (submission?.requestId && !loading) {
      // Fetch quotations on page load to check for selected vendors
      fetchQuotations(submission.requestId || submission.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.requestId, loading]);
  
  // Fetch vendors when submission itemName is available
  useEffect(() => {
    if (submission?.itemName) {
      fetchVendors(submission.itemName);
    }
  }, [submission?.itemName]);

  // Refetch vendors when Sourcing stage is selected
  useEffect(() => {
    if (selectedStage === 'Sourcing' && submission?.itemName) {
      fetchVendors(submission.itemName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage]);

  // Fetch quotations when Review, Negotiations, Legal and Compliance, Approval, or PO Creation stage is selected
  useEffect(() => {
    if ((selectedStage === 'Review' || selectedStage === 'Negotiations' || selectedStage === 'Legal and Compliance' || selectedStage === 'Approval' || selectedStage === 'PO Creation') && submission?.requestId) {
      fetchQuotations(submission.requestId || submission.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage, submission?.requestId]);

  const fetchSubmission = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/fetch-submissions');
      
      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const submissions = Array.isArray(result.data) ? result.data : result.data.data || [];
        const found = submissions.find((sub: Submission) => 
          sub.requestId === requestId || sub.id === requestId
        );
        
        if (found) {
          setSubmission(found);
          // Set initial stage based on current submission stage, default to Intent Report
          if (found.stage === 'Internal Approval') {
            setSelectedStage('Intent Report');
          } else if (PROCUREMENT_STAGES.includes(found.stage)) {
            setSelectedStage(found.stage);
          } else {
            setSelectedStage('Intent Report');
          }
        } else {
          setError(`Request ID "${requestId}" not found.`);
        }
      } else {
        setError(result.error || 'Failed to fetch submission');
      }
    } catch (err) {
      console.error('Error fetching submission:', err);
      setError('An error occurred while fetching submission');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async (itemName?: string) => {
    try {
      // If we have itemName, filter vendors by it
      const url = itemName 
        ? `/api/vendors?itemName=${encodeURIComponent(itemName)}`
        : '/api/vendors';
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success && result.vendors) {
        // Normalize vendor data to include tier
        const normalizedVendors = result.vendors.map((v: any) => {
          const tierValue = (v.tier || v['Tier'] || v['TIER'] || '').toString().trim().toUpperCase();
          return {
            name: v.vendor_name || v.vendorName || v.name || v['Vendor Name'] || (typeof v === 'string' ? v : ''),
            itemName: v.item_name || v.itemName || v['Item Name'] || v.product_name || v['Product Name'] || '',
            tier: tierValue || undefined, // Only set if tier exists
          };
        });
        console.log('Normalized vendors with tiers:', normalizedVendors);
        setVendors(normalizedVendors);
        // Clear selection when vendors change
        setSelectedVendors(new Set());
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
    }
  };

  const updateStage = async (newStage: string) => {
    if (!submission) return;

    setUpdating(true);
    try {
      const response = await fetch('/api/update-stage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: submission.requestId || submission.id,
          stage: newStage,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Refresh submission data
        await fetchSubmission();
        alert('Stage updated successfully!');
      } else {
        alert(`Error: ${result.error || 'Failed to update stage'}`);
      }
    } catch (err) {
      console.error('Error updating stage:', err);
      alert('An error occurred while updating stage');
    } finally {
      setUpdating(false);
    }
  };

  const getCurrentStageIndex = () => {
    if (!submission) return -1;
    // Map submission stage to procurement stage
    if (submission.stage === 'Internal Approval') {
      return PROCUREMENT_STAGES.indexOf('Intent Report');
    }
    return PROCUREMENT_STAGES.indexOf(submission.stage);
  };

  const getStageIndex = (stage: string) => {
    return PROCUREMENT_STAGES.indexOf(stage);
  };

  const getStageMessage = (stage: string) => {
    const messages: { [key: string]: string } = {
      'Intent Report': 'Review customer request details and proceed to sourcing.',
      'Sourcing': 'Request quotes from vendors for this product.',
      'Review': 'Review received quotations from vendors.',
      'Negotiations': 'Negotiations are in progress with selected vendors.',
      'Legal and Compliance': 'Track vendor agreement acceptance and compliance status.',
      'Approval': 'Waiting for final approval before proceeding.',
      'PO Creation': 'Purchase order is being created and processed.',
    };
    return messages[stage] || 'Processing your request...';
  };

  const handleToggleVendor = (vendorName: string) => {
    setSelectedVendors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vendorName)) {
        newSet.delete(vendorName);
      } else {
        newSet.add(vendorName);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedVendors.size === filteredVendors.length) {
      // Deselect all
      setSelectedVendors(new Set());
    } else {
      // Select all
      setSelectedVendors(new Set(filteredVendors.map(v => v.name)));
    }
  };

  const fetchQuotations = async (requestId: string) => {
    setLoadingQuotations(true);
    try {
      const response = await fetch(`/api/quotations?requestId=${encodeURIComponent(requestId)}`);
      const result = await response.json();
      
      if (result.success && result.quotations) {
        // Normalize quotation data - the Google Script returns data with various key formats
        // Find values by matching header names (case-insensitive, space-insensitive)
        const normalizedQuotations = result.quotations.map((q: any) => {
          // Helper function to find value by multiple possible keys
          const findValue = (possibleKeys: string[], defaultValue: any = '') => {
            for (const key of possibleKeys) {
              if (q[key] !== undefined && q[key] !== null && q[key] !== '') {
                return q[key];
              }
            }
            // Also try case-insensitive search in object keys
            const objKeys = Object.keys(q);
            for (const objKey of objKeys) {
              const normalizedObjKey = objKey.toLowerCase().replace(/\s+/g, '');
              for (const searchKey of possibleKeys) {
                const normalizedSearchKey = searchKey.toLowerCase().replace(/\s+/g, '');
                if (normalizedObjKey === normalizedSearchKey) {
                  return q[objKey];
                }
              }
            }
            return defaultValue;
          };

          // The Google Script creates TWO sets of keys:
          // 1. Lowercase keys from headers (CORRECT): 'phonenumber', 'unitprice', 'totalprice', etc. - these match actual column positions
          // 2. Hardcoded wrong keys: 'Unit Price' = wrong index, 'Total Price' = wrong index
          // 
          // Column order in sheet: Request ID, Vendor Name, Vendor Email, Phone Number, Unit Price, Total Price, Delivery Time, Notes, Attachment URL, Submitted Date
          // Google Script creates: requestid, vendorname, vendoremail, phonenumber, unitprice, totalprice, deliverytime, notes, attachmenturl, submitteddate
          
          // Use the lowercase keys (without spaces) which are CORRECT
          const requestId = q['requestid'] || q['Request ID'] || '';
          const vendorName = q['vendorname'] || q['Vendor Name'] || '';
          const vendorEmail = q['vendoremail'] || q['Vendor Email'] || '';
          const phoneNumber = q['phonenumber'] || q['Phone Number'] || '';
          
          // Prices - use lowercase keys which are correct
          let unitPriceRaw = q['unitprice'] !== undefined ? q['unitprice'] : (q['Unit Price'] !== undefined ? q['Unit Price'] : null);
          let totalPriceRaw = q['totalprice'] !== undefined ? q['totalprice'] : (q['Total Price'] !== undefined ? q['Total Price'] : null);
          
          // If still not found, the hardcoded indices might be wrong, so find by value characteristics
          if ((unitPriceRaw === null || unitPriceRaw === undefined || unitPriceRaw === '') && !q['unitprice']) {
            // Search all values for a reasonable price (not phone number)
            const allKeys = Object.keys(q);
            for (const key of allKeys) {
              const val = q[key];
              if (val !== null && val !== undefined && val !== '') {
                const strVal = String(val).replace(/[^\d.-]/g, '');
                const numVal = parseFloat(strVal);
                // Reasonable price: small positive number (51 in example)
                if (!isNaN(numVal) && numVal > 0 && numVal < 10000) {
                  const phoneStr = String(phoneNumber || '').replace(/\D/g, '');
                  if (String(numVal) !== phoneStr) {
                    unitPriceRaw = numVal;
                    break;
                  }
                }
              }
            }
          }
          
          if ((totalPriceRaw === null || totalPriceRaw === undefined || totalPriceRaw === '') && !q['totalprice']) {
            // Search for another reasonable price
            const allKeys = Object.keys(q);
            for (const key of allKeys) {
              const val = q[key];
              if (val !== null && val !== undefined && val !== '') {
                const strVal = String(val).replace(/[^\d.-]/g, '');
                const numVal = parseFloat(strVal);
                if (!isNaN(numVal) && numVal > 0 && numVal < 10000) {
                  const phoneStr = String(phoneNumber || '').replace(/\D/g, '');
                  const unitStr = String(unitPriceRaw || '').replace(/[^\d.-]/g, '');
                  if (String(numVal) !== phoneStr && String(numVal) !== unitStr) {
                    totalPriceRaw = numVal;
                    break;
                  }
                }
              }
            }
          }
          
          const deliveryTime = q['deliverytime'] || q['Delivery Time'] || '';
          const notes = q['notes'] || q['Notes'] || '';
          
          // Attachment URL - try lowercase key first (correct), then fallback
          let attachmentUrl = q['attachmenturl'] || q['Attachment URL'] || '';
          if (!attachmentUrl) {
            // Search for URL pattern
            const allKeys = Object.keys(q);
            for (const key of allKeys) {
              const val = q[key];
              if (val && (String(val).includes('http') || String(val).includes('drive.google.com'))) {
                attachmentUrl = String(val);
                break;
              }
            }
          }
          
          // Submitted Date - try lowercase key first (correct), then fallback
          let submittedDate = q['submitteddate'] || q['Submitted Date'] || '';
          if (!submittedDate) {
            // Search for date pattern
            const allKeys = Object.keys(q);
            for (const key of allKeys) {
              const val = q[key];
              if (val && (String(val).includes('/') && /^\d{2}\/\d{2}\/\d{4}/.test(String(val)))) {
                submittedDate = String(val);
                break;
              }
            }
          }

          // Convert prices to numbers, handling string values
          let unitPrice = 0;
          let totalPrice = 0;
          
          if (typeof unitPriceRaw === 'number') {
            unitPrice = unitPriceRaw;
          } else if (unitPriceRaw !== null && unitPriceRaw !== '') {
            const parsed = parseFloat(String(unitPriceRaw).replace(/[^\d.-]/g, ''));
            unitPrice = isNaN(parsed) ? 0 : parsed;
          }

          if (typeof totalPriceRaw === 'number') {
            totalPrice = totalPriceRaw;
          } else if (totalPriceRaw !== null && totalPriceRaw !== '') {
            const parsed = parseFloat(String(totalPriceRaw).replace(/[^\d.-]/g, ''));
            totalPrice = isNaN(parsed) ? 0 : parsed;
          }

          // Negotiation Notes and Negotiated Amount - try lowercase keys first
          const negotiationNotes = q['negotiationnotes'] || q['Negotiation Notes'] || '';
          let negotiatedAmount = q['negotiatedamount'] !== undefined ? q['negotiatedamount'] : (q['Negotiated Amount'] !== undefined ? q['Negotiated Amount'] : '');
          
          // Convert negotiated amount to number if it's a string
          if (negotiatedAmount && typeof negotiatedAmount === 'string') {
            const parsed = parseFloat(negotiatedAmount.replace(/[^\d.-]/g, ''));
            negotiatedAmount = isNaN(parsed) ? '' : parsed;
          }

          // Selected status - try lowercase key first
          let selected = q['selected'] !== undefined ? q['selected'] : (q['Selected'] !== undefined ? q['Selected'] : 0);
          // Convert to number: 1 means selected, anything else means not selected
          if (selected !== undefined && selected !== null && selected !== '') {
            const selectedNum = typeof selected === 'number' ? selected : parseFloat(String(selected));
            selected = (!isNaN(selectedNum) && selectedNum === 1) ? 1 : 0;
          } else {
            selected = 0;
          }

          // Agreement Accepted status - try lowercase key first
          let agreementAccepted = q['agreementaccepted'] !== undefined ? q['agreementaccepted'] : (q['Agreement Accepted'] !== undefined ? q['Agreement Accepted'] : 0);
          // Convert to number: 1 means accepted, anything else means not accepted
          if (agreementAccepted !== undefined && agreementAccepted !== null && agreementAccepted !== '') {
            const acceptedNum = typeof agreementAccepted === 'number' ? agreementAccepted : parseFloat(String(agreementAccepted));
            agreementAccepted = (!isNaN(acceptedNum) && acceptedNum === 1) ? 1 : 0;
          } else {
            agreementAccepted = 0;
          }

          // Agreement dates
          const agreementSentDate = q['agreementsentdate'] || q['Agreement Sent Date'] || '';
          const agreementAcceptedDate = q['agreementaccepteddate'] || q['Agreement Accepted Date'] || '';

          // Vendor Approved status - try lowercase key first
          let vendorApproved = q['vendorapproved'] !== undefined ? q['vendorapproved'] : (q['Vendor Approved'] !== undefined ? q['Vendor Approved'] : 0);
          // Convert to number: 1 means approved, anything else means not approved
          if (vendorApproved !== undefined && vendorApproved !== null && vendorApproved !== '') {
            const approvedNum = typeof vendorApproved === 'number' ? vendorApproved : parseFloat(String(vendorApproved));
            vendorApproved = (!isNaN(approvedNum) && approvedNum === 1) ? 1 : 0;
          } else {
            vendorApproved = 0;
          }

          // Vendor Approved Date
          const vendorApprovedDate = q['vendorapproveddate'] || q['Vendor Approved Date'] || '';

          // PO Sent status - try lowercase key first
          let poSent = q['posent'] !== undefined ? q['posent'] : (q['PO Sent'] !== undefined ? q['PO Sent'] : 0);
          // Convert to number: 1 means sent, anything else means not sent
          if (poSent !== undefined && poSent !== null && poSent !== '') {
            const poSentNum = typeof poSent === 'number' ? poSent : parseFloat(String(poSent));
            poSent = (!isNaN(poSentNum) && poSentNum === 1) ? 1 : 0;
          } else {
            poSent = 0;
          }

          return {
            'Request ID': requestId,
            'Vendor Name': vendorName,
            'Vendor Email': vendorEmail,
            'Phone Number': phoneNumber,
            'Unit Price': unitPrice,
            'Total Price': totalPrice,
            'Delivery Time': deliveryTime,
            'Notes': notes,
            'Attachment URL': attachmentUrl,
            'Submitted Date': submittedDate,
            'Negotiation Notes': negotiationNotes,
            'Negotiated Amount': negotiatedAmount || '',
            'Selected': selected,
            'Agreement Accepted': agreementAccepted,
            'Agreement Sent Date': agreementSentDate,
            'Agreement Accepted Date': agreementAcceptedDate,
            'Vendor Approved': vendorApproved,
            'Vendor Approved Date': vendorApprovedDate,
            'PO Sent': poSent
          };
        });
        setQuotations(normalizedQuotations);
        
        // Initialize negotiation data from loaded quotations
        const initNegotiationData: {[vendorName: string]: {notes: string, amount: string}} = {};
        normalizedQuotations.forEach((q: Quotation) => {
          if (q['Vendor Name']) {
            const existingNotes = q['Negotiation Notes'];
            const existingAmount = q['Negotiated Amount'];
            initNegotiationData[q['Vendor Name']] = {
              notes: existingNotes ? String(existingNotes) : '',
              amount: existingAmount ? (typeof existingAmount === 'number' ? String(existingAmount) : String(existingAmount)) : ''
            };
          }
        });
        setNegotiationData(initNegotiationData);
        
        // Load selected vendors from sheet data (Selected column) and restore state
        const selectedVendorsFromSheet = new Set<string>();
        normalizedQuotations.forEach((q: Quotation) => {
          if (q['Selected'] === 1 && q['Vendor Name']) {
            selectedVendorsFromSheet.add(q['Vendor Name']);
          }
        });
        
        if (selectedVendorsFromSheet.size > 0) {
          setSelectedVendorsForNegotiation(selectedVendorsFromSheet);
        }

        // Load approved vendors from sheet data (Vendor Approved column)
        const approvedVendorsFromSheet = new Set<string>();
        normalizedQuotations.forEach((q: Quotation) => {
          const vendorApproved = q['Vendor Approved'];
          if ((vendorApproved === 1 || vendorApproved === '1') && q['Vendor Name']) {
            approvedVendorsFromSheet.add(q['Vendor Name']);
          }
        });
        
        if (approvedVendorsFromSheet.size > 0) {
          setApprovedVendors(approvedVendorsFromSheet);
        }
      }
    } catch (err) {
      console.error('Error fetching quotations:', err);
    } finally {
      setLoadingQuotations(false);
    }
  };

  const handleToggleQuotationVendor = async (vendorName: string) => {
    if (!submission?.requestId) {
      alert('Request ID not found');
      return;
    }

    const isCurrentlySelected = selectedVendorsForNegotiation.has(vendorName);
    const newSelectionState = !isCurrentlySelected;

    // Optimistically update UI
    setSelectedVendorsForNegotiation(prev => {
      const newSet = new Set(prev);
      if (newSelectionState) {
        newSet.add(vendorName);
      } else {
        newSet.delete(vendorName);
      }
      return newSet;
    });

    // Update in sheet via API
    try {
      const response = await fetch('/api/update-vendor-selection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: submission.requestId || submission.id,
          vendorName: vendorName,
          isSelected: newSelectionState,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update quotation state to reflect the selection
        setQuotations(prevQuotations => 
          prevQuotations.map(q => 
            q['Vendor Name'] === vendorName
              ? { ...q, 'Selected': newSelectionState ? 1 : 0 }
              : q
          )
        );
        console.log('Vendor selection saved successfully:', { vendorName, isSelected: newSelectionState });
      } else {
        // Revert on error
        setSelectedVendorsForNegotiation(prev => {
          const newSet = new Set(prev);
          if (isCurrentlySelected) {
        newSet.add(vendorName);
          } else {
            newSet.delete(vendorName);
      }
      return newSet;
    });
        console.error('Failed to save vendor selection:', result.error);
        alert(`Failed to save selection: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      // Revert on error
      setSelectedVendorsForNegotiation(prev => {
        const newSet = new Set(prev);
        if (isCurrentlySelected) {
          newSet.add(vendorName);
        } else {
          newSet.delete(vendorName);
        }
        return newSet;
      });
      console.error('Error saving vendor selection:', err);
      alert('An error occurred while saving vendor selection');
    }
  };

  const handleSaveNegotiationData = async (vendorName: string) => {
    if (!submission?.requestId) {
      alert('Request ID not found');
      return;
    }

    const negotiationInfo = negotiationData[vendorName];
    if (!negotiationInfo) {
      return;
    }

    setSavingNegotiation(vendorName);
    try {
      // Prepare negotiated amount - parse as number if valid, otherwise empty string
      let negotiatedAmountValue: number | string = '';
      if (negotiationInfo.amount && negotiationInfo.amount.trim()) {
        const cleanedAmount = negotiationInfo.amount.replace(/[^\d.-]/g, '');
        const parsedAmount = parseFloat(cleanedAmount);
        if (!isNaN(parsedAmount) && parsedAmount >= 0) {
          negotiatedAmountValue = parsedAmount;
    } else {
          // If not a valid number, send as empty string
          negotiatedAmountValue = '';
        }
      }

      console.log('Saving negotiation data:', {
        requestId: submission.requestId || submission.id,
        vendorName: vendorName,
        notes: negotiationInfo.notes,
        amount: negotiationInfo.amount,
        parsedAmount: negotiatedAmountValue
      });

      const response = await fetch('/api/update-quotation-negotiation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: submission.requestId || submission.id,
          vendorName: vendorName,
          negotiationNotes: negotiationInfo.notes || '',
          negotiatedAmount: negotiatedAmountValue,
        }),
      });

      const result = await response.json();
      console.log('Save response:', result);

      if (response.ok && result.success) {
        // Update the quotation in state
        setQuotations(prevQuotations => 
          prevQuotations.map(q => 
            q['Vendor Name'] === vendorName
              ? {
                  ...q,
                  'Negotiation Notes': negotiationInfo.notes || '',
                  'Negotiated Amount': negotiatedAmountValue || ''
                }
              : q
          )
        );
        
        // Also update negotiation data state to reflect saved values
        setNegotiationData(prev => ({
          ...prev,
          [vendorName]: {
            notes: negotiationInfo.notes || '',
            amount: negotiatedAmountValue ? String(negotiatedAmountValue) : ''
          }
        }));
        
        // Force re-render to update sidebar checkmark
        // The checkmark will automatically update because quotations state changed
        
        alert('Negotiation data saved successfully!');
      } else {
        const errorMsg = result.error || 'Failed to save negotiation data';
        console.error('Save error:', errorMsg);
        alert(`Error: ${errorMsg}\n\nNote: Make sure the Google Sheet has "Negotiation Notes" and "Negotiated Amount" columns, and the Google Script is updated to handle this action.`);
      }
    } catch (err) {
      console.error('Error saving negotiation data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`An error occurred while saving negotiation data: ${errorMessage}\n\nPlease check the browser console for more details.`);
    } finally {
      setSavingNegotiation('');
    }
  };

  const handleNegotiationNotesChange = (vendorName: string, notes: string) => {
    setNegotiationData(prev => ({
      ...prev,
      [vendorName]: {
        ...prev[vendorName],
        notes: notes
      }
    }));
  };

  const handleNegotiatedAmountChange = (vendorName: string, amount: string) => {
    setNegotiationData(prev => ({
      ...prev,
      [vendorName]: {
        ...prev[vendorName],
        amount: amount
      }
    }));
  };

  const handleAgreementAcceptance = async (vendorName: string, isAccepted: boolean) => {
    if (!submission?.requestId) {
      alert('Request ID not found. Please refresh the page.');
      return;
    }

    setSavingAgreement(vendorName);
    
    try {
      const response = await fetch('/api/update-agreement-acceptance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: submission.requestId || submission.id,
          vendorName: vendorName,
          isAccepted: isAccepted
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update quotations state optimistically
        setQuotations(prev => 
          prev.map(q => {
            if (q['Vendor Name'] === vendorName) {
              return {
                ...q,
                'Agreement Accepted': isAccepted ? 1 : 0,
                'Agreement Sent Date': isAccepted ? (q['Agreement Sent Date'] || new Date().toISOString().split('T')[0]) : q['Agreement Sent Date'],
                'Agreement Accepted Date': isAccepted ? new Date().toISOString().split('T')[0] : ''
              };
            }
            return q;
          })
        );
        
        alert(isAccepted ? 'Agreement acceptance recorded successfully!' : 'Agreement acceptance updated.');
      } else {
        const errorMsg = result.error || 'Failed to update agreement acceptance';
        console.error('Save error:', errorMsg);
        alert(`Error: ${errorMsg}\n\nNote: Make sure the Google Sheet has "Agreement Accepted" column, and the Google Script is updated to handle this action.`);
      }
    } catch (err) {
      console.error('Error saving agreement acceptance:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`An error occurred while saving agreement acceptance: ${errorMessage}\n\nPlease check the browser console for more details.`);
    } finally {
      setSavingAgreement('');
    }
  };

  const handleVendorApproval = async (vendorName: string, isApproved: boolean) => {
    if (!submission?.requestId) {
      alert('Request ID not found. Please refresh the page.');
      return;
    }

    setSavingApproval(vendorName);
    
    try {
      const response = await fetch('/api/update-vendor-approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: submission.requestId || submission.id,
          vendorName: vendorName,
          isApproved: isApproved
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update approved vendors state
        setApprovedVendors(prev => {
          const newSet = new Set(prev);
          if (isApproved) {
            newSet.add(vendorName);
          } else {
            newSet.delete(vendorName);
          }
          return newSet;
        });

        // Update quotations state optimistically
        setQuotations(prev => 
          prev.map(q => {
            if (q['Vendor Name'] === vendorName) {
              return {
                ...q,
                'Vendor Approved': isApproved ? 1 : 0,
                'Vendor Approved Date': isApproved ? new Date().toISOString().split('T')[0] : ''
              };
            }
            return q;
          })
        );
        
        alert(isApproved ? 'Vendor approved successfully!' : 'Vendor approval removed.');
      } else {
        const errorMsg = result.error || 'Failed to update vendor approval';
        console.error('Save error:', errorMsg);
        alert(`Error: ${errorMsg}\n\nNote: Make sure the Google Sheet has "Vendor Approved" column, and the Google Script is updated to handle this action.`);
      }
    } catch (err) {
      console.error('Error saving vendor approval:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`An error occurred while saving vendor approval: ${errorMessage}\n\nPlease check the browser console for more details.`);
    } finally {
      setSavingApproval('');
    }
  };

  const handleSelectAllQuotations = async () => {
    if (!submission?.requestId) {
      alert('Request ID not found');
      return;
    }

    const shouldSelectAll = selectedVendorsForNegotiation.size !== quotations.length;
    const vendorsToUpdate = quotations.map(q => q['Vendor Name']);

    // Optimistically update UI
    setSelectedVendorsForNegotiation(shouldSelectAll 
      ? new Set<string>(vendorsToUpdate)
      : new Set<string>()
    );

    // Update all vendors in sheet
    try {
      const updatePromises = vendorsToUpdate.map(vendorName => 
        fetch('/api/update-vendor-selection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestId: submission.requestId || submission.id,
            vendorName: vendorName,
            isSelected: shouldSelectAll,
          }),
        })
      );

      const results = await Promise.all(updatePromises);
      const allSuccessful = results.every(r => r.ok);

      if (allSuccessful) {
        // Update quotation states
        setQuotations(prevQuotations => 
          prevQuotations.map(q => ({
            ...q,
            'Selected': shouldSelectAll ? 1 : 0
          }))
        );
        console.log('All vendor selections saved successfully');
      } else {
        console.error('Some vendor selections failed to save');
        // Reload quotations to get correct state
        await fetchQuotations(submission.requestId || submission.id);
      }
    } catch (err) {
      console.error('Error saving vendor selections:', err);
      // Reload quotations to get correct state
      await fetchQuotations(submission.requestId || submission.id);
      alert('An error occurred while saving vendor selections');
    }
  };

  const handleViewInsight = async (vendorName: string) => {
    setSelectedVendorForInsight(vendorName);
    setShowInsight(true);
    setLoadingHistory(true);
    
    try {
      const response = await fetch(`/api/vendor-history?vendorName=${encodeURIComponent(vendorName)}`);
      const result = await response.json();
      
      if (result.success && result.history) {
        setVendorHistory(result.history);
      }
    } catch (err) {
      console.error('Error fetching vendor history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSendQuotes = async () => {
    if (!submission || filteredVendors.length === 0) {
      alert('No vendors available to send quotes');
      return;
    }

    if (selectedVendors.size === 0) {
      alert('Please select at least one vendor to send quotation requests');
      return;
    }

    const selectedVendorNames = Array.from(selectedVendors);
    if (!confirm(`Send quotation request emails to ${selectedVendorNames.length} selected vendor(s)?`)) {
      return;
    }

    setSendingQuotes(true);
    try {
      const response = await fetch('/api/send-quote-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: submission.requestId || submission.id,
          vendors: selectedVendorNames,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Store the vendors that quotes were sent to
        setVendorsQuotesSentTo(selectedVendorNames);
        // Persist to localStorage
        if (submission?.requestId || submission?.id) {
          localStorage.setItem(`vendorsQuotesSentTo_${submission.requestId || submission.id}`, JSON.stringify(selectedVendorNames));
        }
        
        alert(`Quotation request emails sent successfully to ${result.sentCount || selectedVendorNames.length} vendor(s)!`);
        // Clear selection after successful send
        setSelectedVendors(new Set());
      } else {
        alert(`Error: ${result.error || 'Failed to send quotation requests'}`);
      }
    } catch (err) {
      console.error('Error sending quotes:', err);
      alert('An error occurred while sending quotation requests');
    } finally {
      setSendingQuotes(false);
    }
  };

  const getNextStage = () => {
    if (!submission) return null;
    const currentIndex = getCurrentStageIndex();
    // Only allow moving to next stage if current stage is in procurement stages
    if (currentIndex >= 0 && currentIndex < PROCUREMENT_STAGES.length - 1) {
      return PROCUREMENT_STAGES[currentIndex + 1];
    }
    return null;
  };

  const handleNextStage = () => {
    const nextStage = getNextStage();
    if (nextStage) {
      updateStage(nextStage);
    }
  };


  const backgroundClasses = 'min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 py-12 px-4 sm:px-6 lg:px-8';
  const headerClasses = 'bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8 sm:px-10';
  const insightHeaderClasses = 'bg-gradient-to-r from-purple-600 to-purple-800 px-6 py-4';

  // Vendors are already filtered by Item Name from API
  // Group vendors by tier (GOLD, SILVER, BRONZE, and others)
  const groupedVendors = {
    GOLD: vendors.filter(v => v.tier && v.tier.toUpperCase() === 'GOLD'),
    SILVER: vendors.filter(v => v.tier && v.tier.toUpperCase() === 'SILVER'),
    BRONZE: vendors.filter(v => v.tier && v.tier.toUpperCase() === 'BRONZE'),
    OTHER: vendors.filter(v => !v.tier || (v.tier.toUpperCase() !== 'GOLD' && v.tier.toUpperCase() !== 'SILVER' && v.tier.toUpperCase() !== 'BRONZE')),
  };
  
  // Debug logging
  console.log('Vendors:', vendors);
  console.log('Grouped vendors:', groupedVendors);
  console.log('GOLD count:', groupedVendors.GOLD.length);
  console.log('SILVER count:', groupedVendors.SILVER.length);
  console.log('BRONZE count:', groupedVendors.BRONZE.length);
  console.log('OTHER count:', groupedVendors.OTHER.length);
  
  const filteredVendors = vendors;

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
                  {PROCUREMENT_STAGES.map((stage, index) => {
                    // Map submission stage to procurement stages for display
                    const submissionStage = submission?.stage || '';
                    const isCurrentStage = submissionStage === stage || 
                      (submissionStage === 'Internal Approval' && stage === 'Intent Report');
                    const currentStageIndex = submission ? 
                      (submissionStage === 'Internal Approval' ? 0 : PROCUREMENT_STAGES.indexOf(submissionStage)) : -1;
                    
                    // Mark Sourcing as completed if quotes have been sent
                    let isCompleted = currentStageIndex > index;
                    if (stage === 'Sourcing' && vendorsQuotesSentTo.length > 0) {
                      isCompleted = true;
                     }
                     // Mark Review as completed if vendors have been selected (check quotations for Selected = 1)
                     // This works even if quotations haven't been fully loaded yet - we check the data we have
                     if (stage === 'Review') {
                       const hasSelectedVendor = quotations.length > 0 && quotations.some(q => q['Selected'] === 1);
                       if (hasSelectedVendor || selectedVendorsForNegotiation.size > 0) {
                         isCompleted = true;
                       }
                     }
                    // Mark Negotiations as completed if negotiation data exists (Negotiation Notes or Negotiated Amount)
                    if (stage === 'Negotiations') {
                      const hasNegotiationData = quotations.length > 0 && quotations.some(q => {
                        const hasNotes = q['Negotiation Notes'] && String(q['Negotiation Notes']).trim() !== '';
                        const hasAmount = q['Negotiated Amount'] !== undefined && 
                                        q['Negotiated Amount'] !== null && 
                                        q['Negotiated Amount'] !== '' &&
                                        String(q['Negotiated Amount']).trim() !== '';
                        return hasNotes || hasAmount;
                      });
                      if (hasNegotiationData) {
                        isCompleted = true;
                      }
                    }

                    // Mark Legal and Compliance as completed if at least one agreement is accepted
                    if (stage === 'Legal and Compliance') {
                      const hasAcceptedAgreement = quotations.length > 0 && quotations.some(q => {
                        return q['Agreement Accepted'] === 1;
                      });
                      if (hasAcceptedAgreement) {
                        isCompleted = true;
                      }
                    }

                    // Mark Approval as completed if at least one vendor is approved
                    if (stage === 'Approval') {
                      const hasApprovedVendor = quotations.length > 0 && quotations.some(q => {
                        return q['Vendor Approved'] === 1 || q['Vendor Approved'] === '1';
                      });
                      if (hasApprovedVendor || approvedVendors.size > 0) {
                        isCompleted = true;
                      }
                    }

                    // Mark PO Creation as completed if PO has been sent (PO Sent = 1)
                    let hasPOSent = false;
                    if (stage === 'PO Creation') {
                      hasPOSent = quotations.length > 0 && quotations.some(q => {
                        const poSent = q['PO Sent'];
                        return poSent === 1 || poSent === '1' || String(poSent).trim() === '1';
                      });
                      if (hasPOSent) {
                        isCompleted = true;
                      }
                    }
                    
                    const isSelected = selectedStage === stage || (!selectedStage && isCurrentStage);
                    
                    return (
                      <button
                        key={stage}
                        onClick={() => setSelectedStage(stage)}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : isCurrentStage
                            ? 'bg-green-50 text-green-800 border-2 border-green-500'
                            : isCompleted
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <span className="text-sm font-medium">{stage}</span>
                            {stage === 'Sourcing' && vendorsQuotesSentTo.length > 0 && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                Sent to {vendorsQuotesSentTo.length} vendor{vendorsQuotesSentTo.length > 1 ? 's' : ''}
                              </p>
                            )}
                            {stage === 'Review' && (() => {
                              const selectedCount = quotations.filter(q => q['Selected'] === 1).length || selectedVendorsForNegotiation.size;
                              return selectedCount > 0 ? (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {selectedCount} vendor{selectedCount > 1 ? 's' : ''} selected
                                </p>
                              ) : null;
                            })()}
                            {stage === 'Negotiations' && quotations.length > 0 && (() => {
                              const vendorsWithNegotiationData = quotations.filter(q => {
                                const hasNotes = q['Negotiation Notes'] && String(q['Negotiation Notes']).trim() !== '';
                                const hasAmount = q['Negotiated Amount'] !== undefined && 
                                                q['Negotiated Amount'] !== null && 
                                                q['Negotiated Amount'] !== '' &&
                                                String(q['Negotiated Amount']).trim() !== '';
                                return hasNotes || hasAmount;
                              }).length;
                              return vendorsWithNegotiationData > 0 ? (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {vendorsWithNegotiationData} vendor{vendorsWithNegotiationData > 1 ? 's' : ''} with data
                                </p>
                              ) : null;
                            })()}
                            {stage === 'Legal and Compliance' && quotations.length > 0 && (() => {
                              const vendorsWithAcceptedAgreement = quotations.filter(q => q['Agreement Accepted'] === 1).length;
                              return vendorsWithAcceptedAgreement > 0 ? (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {vendorsWithAcceptedAgreement} vendor{vendorsWithAcceptedAgreement > 1 ? 's' : ''} accepted
                                </p>
                              ) : null;
                            })()}
                            {stage === 'Approval' && quotations.length > 0 && (() => {
                              const vendorsApproved = quotations.filter(q => q['Vendor Approved'] === 1 || q['Vendor Approved'] === '1').length || approvedVendors.size;
                              return vendorsApproved > 0 ? (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {vendorsApproved} vendor{vendorsApproved > 1 ? 's' : ''} approved
                                </p>
                              ) : null;
                            })()}
                            {stage === 'PO Creation' && quotations.length > 0 && (() => {
                              const posSent = quotations.filter(q => {
                                const poSent = q['PO Sent'];
                                return poSent === 1 || poSent === '1' || String(poSent).trim() === '1';
                              }).length;
                              return posSent > 0 ? (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  PO sent to {posSent} vendor{posSent > 1 ? 's' : ''}
                                </p>
                              ) : null;
                            })()}
                          </div>
                          {(isCurrentStage || isCompleted) && (
                            <svg className={`w-5 h-5 shrink-0 ${
                              (stage === 'PO Creation' && hasPOSent) ||
                              (stage === 'Sourcing' && vendorsQuotesSentTo.length > 0) || 
                              (stage === 'Review' && (
                                (quotations.length > 0 && quotations.some(q => q['Selected'] === 1)) || 
                                selectedVendorsForNegotiation.size > 0
                              )) ||
                              (stage === 'Negotiations' && quotations.length > 0 && quotations.some(q => {
                                const hasNotes = q['Negotiation Notes'] && String(q['Negotiation Notes']).trim() !== '';
                                const hasAmount = q['Negotiated Amount'] !== undefined && 
                                                q['Negotiated Amount'] !== null && 
                                                q['Negotiated Amount'] !== '' &&
                                                String(q['Negotiated Amount']).trim() !== '';
                                return hasNotes || hasAmount;
                              })) ||
                              (stage === 'Legal and Compliance' && quotations.length > 0 && quotations.some(q => q['Agreement Accepted'] === 1)) ||
                              (stage === 'Approval' && ((quotations.length > 0 && quotations.some(q => q['Vendor Approved'] === 1 || q['Vendor Approved'] === '1')) || approvedVendors.size > 0)) ||
                              (stage === 'PO Creation' && quotations.length > 0 && quotations.some(q => {
                                const poSent = q['PO Sent'];
                                return poSent === 1 || poSent === '1' || String(poSent).trim() === '1';
                              }))
                                ? 'text-green-600' 
                                : 'text-gray-400'
                            }`} fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="bg-white shadow-2xl rounded-xl overflow-hidden">
              <div className={headerClasses}>
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                      Track Request: {requestId}
                    </h1>
                    <p className="text-blue-100">
                      Manage the status of your procurement request
                    </p>
                  </div>
                  <button
                    onClick={() => router.push('/procurement')}
                    className="px-6 py-2 bg-white text-blue-600 rounded-md hover:bg-blue-50 font-medium transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </div>

              <div className="px-6 py-8 sm:px-10">
                {loading ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Loading request details...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                      onClick={fetchSubmission}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Retry
                    </button>
                  </div>
                ) : submission ? (
                  <>
                    {/* Intent Report - Show Customer Details */}
                    {selectedStage === 'Intent Report' ? (
                      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <h3 className="text-xl font-semibold text-gray-900 mb-6">Request Details</h3>
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
                            <p className="text-base font-semibold text-gray-900">₹{parseFloat(submission.estimatedCost).toLocaleString('en-IN')}</p>
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
                    ) : selectedStage === 'Sourcing' ? (
                      /* Sourcing Stage - Show Vendors and Get Quote Button */
                      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Request Quotations</h2>
                            <p className="text-sm text-gray-600">Select vendors and send quotation request emails</p>
                          </div>
                          {vendorsQuotesSentTo.length === 0 && (
                            <button
                              onClick={handleSendQuotes}
                              disabled={sendingQuotes || filteredVendors.length === 0 || selectedVendors.size === 0}
                              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              {sendingQuotes ? 'Sending...' : `Get Quote (${selectedVendors.size} selected)`}
                            </button>
                          )}
                        </div>

                        {/* Always show vendor list */}
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">Vendors for {submission.itemName}</h3>
                            {filteredVendors.length > 0 && vendorsQuotesSentTo.length === 0 && (
                              <button
                                onClick={handleSelectAll}
                                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium transition-colors"
                              >
                                {selectedVendors.size === filteredVendors.length ? 'Deselect All' : 'Select All'}
                              </button>
                            )}
                          </div>
                          {filteredVendors.length > 0 ? (
                            <div className="space-y-6">
                              {/* GOLD Tier */}
                              {groupedVendors.GOLD.length > 0 && (
                                <div>
                                  <div className="flex items-center mb-3">
                                    <div className="w-2 h-8 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-l-lg mr-3"></div>
                                    <h4 className="text-base font-bold text-yellow-700">GOLD TIER</h4>
                                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">
                                      {groupedVendors.GOLD.length}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-5">
                                    {groupedVendors.GOLD.map((vendor, index) => {
                                      const isSelected = selectedVendors.has(vendor.name);
                                      const quoteSent = vendorsQuotesSentTo.includes(vendor.name);
                                      return (
                                        <div
                                          key={`gold-${index}`}
                                          onClick={() => !quoteSent && handleToggleVendor(vendor.name)}
                                          className={`px-4 py-3 border-2 rounded-lg transition-all ${
                                            quoteSent
                                              ? 'border-green-500 bg-green-50 cursor-default'
                                              : isSelected
                                              ? 'border-blue-500 bg-blue-50 cursor-pointer'
                                              : 'border-yellow-300 bg-yellow-50 hover:border-yellow-400 hover:bg-yellow-100 cursor-pointer'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center flex-1 min-w-0">
                                              {quoteSent ? (
                                                <svg className="w-5 h-5 text-green-600 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                              ) : (
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => handleToggleVendor(vendor.name)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3 cursor-pointer shrink-0"
                                                />
                                              )}
                                              <svg className="w-5 h-5 text-yellow-600 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                              </svg>
                                              <span className="font-medium text-gray-900">{vendor.name}</span>
                                            </div>
                                            {quoteSent && (
                                              <span className="ml-2 text-xs text-green-700 font-medium shrink-0">✓ Sent</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* SILVER Tier */}
                              {groupedVendors.SILVER.length > 0 && (
                                <div>
                                  <div className="flex items-center mb-3">
                                    <div className="w-2 h-8 bg-gradient-to-b from-gray-300 to-gray-500 rounded-l-lg mr-3"></div>
                                    <h4 className="text-base font-bold text-gray-600">SILVER TIER</h4>
                                    <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded">
                                      {groupedVendors.SILVER.length}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-5">
                                    {groupedVendors.SILVER.map((vendor, index) => {
                                      const isSelected = selectedVendors.has(vendor.name);
                                      const quoteSent = vendorsQuotesSentTo.includes(vendor.name);
                                      return (
                                        <div
                                          key={`silver-${index}`}
                                          onClick={() => !quoteSent && handleToggleVendor(vendor.name)}
                                          className={`px-4 py-3 border-2 rounded-lg transition-all ${
                                            quoteSent
                                              ? 'border-green-500 bg-green-50 cursor-default'
                                              : isSelected
                                              ? 'border-blue-500 bg-blue-50 cursor-pointer'
                                              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 cursor-pointer'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center flex-1 min-w-0">
                                              {quoteSent ? (
                                                <svg className="w-5 h-5 text-green-600 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                              ) : (
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => handleToggleVendor(vendor.name)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3 cursor-pointer shrink-0"
                                                />
                                              )}
                                              <svg className="w-5 h-5 text-gray-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                              </svg>
                                              <span className="font-medium text-gray-900">{vendor.name}</span>
                                            </div>
                                            {quoteSent && (
                                              <span className="ml-2 text-xs text-green-700 font-medium shrink-0">✓ Sent</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* BRONZE Tier */}
                              {groupedVendors.BRONZE.length > 0 && (
                                <div>
                                  <div className="flex items-center mb-3">
                                    <div className="w-2 h-8 bg-gradient-to-b from-orange-400 to-orange-600 rounded-l-lg mr-3"></div>
                                    <h4 className="text-base font-bold text-orange-700">BRONZE TIER</h4>
                                    <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs font-semibold rounded">
                                      {groupedVendors.BRONZE.length}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-5">
                                    {groupedVendors.BRONZE.map((vendor, index) => {
                                      const isSelected = selectedVendors.has(vendor.name);
                                      const quoteSent = vendorsQuotesSentTo.includes(vendor.name);
                                      return (
                                        <div
                                          key={`bronze-${index}`}
                                          onClick={() => !quoteSent && handleToggleVendor(vendor.name)}
                                          className={`px-4 py-3 border-2 rounded-lg transition-all ${
                                            quoteSent
                                              ? 'border-green-500 bg-green-50 cursor-default'
                                              : isSelected
                                              ? 'border-blue-500 bg-blue-50 cursor-pointer'
                                              : 'border-orange-300 bg-orange-50 hover:border-orange-400 hover:bg-orange-100 cursor-pointer'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center flex-1 min-w-0">
                                              {quoteSent ? (
                                                <svg className="w-5 h-5 text-green-600 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                              ) : (
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => handleToggleVendor(vendor.name)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3 cursor-pointer shrink-0"
                                                />
                                              )}
                                              <svg className="w-5 h-5 text-orange-600 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                              </svg>
                                              <span className="font-medium text-gray-900">{vendor.name}</span>
                                            </div>
                                            {quoteSent && (
                                              <span className="ml-2 text-xs text-green-700 font-medium shrink-0">✓ Sent</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Other/Uncategorized Vendors */}
                              {groupedVendors.OTHER.length > 0 && (
                                <div>
                                  <div className="flex items-center mb-3">
                                    <div className="w-2 h-8 bg-gradient-to-b from-gray-200 to-gray-400 rounded-l-lg mr-3"></div>
                                    <h4 className="text-base font-bold text-gray-600">OTHER VENDORS</h4>
                                    <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-800 text-xs font-semibold rounded">
                                      {groupedVendors.OTHER.length}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-5">
                                    {groupedVendors.OTHER.map((vendor, index) => {
                                      const isSelected = selectedVendors.has(vendor.name);
                                      const quoteSent = vendorsQuotesSentTo.includes(vendor.name);
                                      return (
                                        <div
                                          key={`other-${index}`}
                                          onClick={() => !quoteSent && handleToggleVendor(vendor.name)}
                                          className={`px-4 py-3 border-2 rounded-lg transition-all ${
                                            quoteSent
                                              ? 'border-green-500 bg-green-50 cursor-default'
                                              : isSelected
                                              ? 'border-blue-500 bg-blue-50 cursor-pointer'
                                              : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                                          }`}
                                        >
                                          <div className="flex items-center">
                                            {quoteSent ? (
                                              <svg className="w-5 h-5 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                              </svg>
                                            ) : (
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleVendor(vendor.name)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3 cursor-pointer"
                                              />
                                            )}
                                            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                            <span className="font-medium text-gray-900">{vendor.name}</span>
                                            {quoteSent && (
                                              <span className="ml-auto text-xs text-green-700 font-medium">✓ Sent</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <div className="flex items-start">
                                <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <p className="text-sm font-medium text-yellow-800 mb-1">No vendors found</p>
                                  <p className="text-sm text-yellow-700">
                                    No vendors are currently listed for <strong>{submission.itemName}</strong> in the vendor catalog.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : selectedStage === 'Review' ? (
                      <div>
                        {/* Review Stage - Show Quotations with Checkboxes */}
                      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Review Quotations</h2>
                            <p className="text-sm text-gray-600">Select vendors to proceed to negotiations. Click "View Details" to see complete quotation information.</p>
                          </div>
                          {quotations.length > 0 && (
                            <button
                              onClick={handleSelectAllQuotations}
                              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium transition-colors"
                            >
                              {selectedVendorsForNegotiation.size === quotations.length ? 'Deselect All' : 'Select All'}
                            </button>
                          )}
                        </div>

                        {loadingQuotations ? (
                          <div className="text-center py-8 text-gray-500">
                            <p>Loading quotations...</p>
                          </div>
                        ) : quotations.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    <input
                                      type="checkbox"
                                      checked={
                                        quotations.length > 0 && 
                                        quotations.every(q => selectedVendorsForNegotiation.has(q['Vendor Name']) || q['Selected'] === 1)
                                      }
                                      onChange={handleSelectAllQuotations}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Name</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Email</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Time</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attachment</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted Date</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {quotations.map((quotation, index) => {
                                  // Check both the state and the Selected column from sheet
                                  const isSelected = selectedVendorsForNegotiation.has(quotation['Vendor Name']) || quotation['Selected'] === 1;
                                  return (
                                    <tr
                                      key={index}
                                      className={isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                                    >
                                      <td className="px-4 py-4 whitespace-nowrap">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleToggleQuotationVendor(quotation['Vendor Name'])}
                                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {quotation['Vendor Name']}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                        <a 
                                          href={`mailto:${quotation['Vendor Email']}`}
                                          className="text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                          {quotation['Vendor Email']}
                                        </a>
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {quotation['Phone Number'] ? (
                                          <a 
                                            href={`tel:${quotation['Phone Number']}`}
                                            className="text-blue-600 hover:text-blue-800 hover:underline"
                                          >
                                            {quotation['Phone Number']}
                                          </a>
                                        ) : (
                                          <span className="text-gray-400">N/A</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ₹{typeof quotation['Unit Price'] === 'number' 
                                          ? quotation['Unit Price'].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                          : parseFloat(quotation['Unit Price']?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-green-700">
                                        ₹{typeof quotation['Total Price'] === 'number' 
                                          ? quotation['Total Price'].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                          : parseFloat(quotation['Total Price']?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {quotation['Delivery Time'] || <span className="text-gray-400">N/A</span>}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                                        {quotation['Attachment URL'] ? (
                                          <a
                                            href={quotation['Attachment URL']}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-medium transition-colors"
                                          >
                                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                            </svg>
                                            View
                                          </a>
                                        ) : (
                                          <span className="text-gray-400">No attachment</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {quotation['Submitted Date'] 
                                          ? (() => {
                                              try {
                                                const dateStr = quotation['Submitted Date'].toString();
                                                // Try parsing different date formats
                                                const date = dateStr.includes('/') 
                                                  ? new Date(dateStr.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2'))
                                                  : new Date(dateStr);
                                                if (!isNaN(date.getTime())) {
                                                  return date.toLocaleString('en-US', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                  });
                                                }
                                                return dateStr; // Return original if parsing fails
                                              } catch {
                                                return quotation['Submitted Date'].toString();
                                              }
                                            })()
                                          : 'N/A'}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm space-x-2">
                                        <button
                                          onClick={() => {
                                            setSelectedQuotation(quotation);
                                            setShowQuotationDetail(true);
                                          }}
                                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-medium transition-colors"
                                        >
                                          View Details
                                        </button>
                                        <button
                                          onClick={() => handleViewInsight(quotation['Vendor Name'])}
                                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 font-medium transition-colors"
                                        >
                                          Insight
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-start">
                              <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-yellow-800 mb-1">No quotations received</p>
                                <p className="text-sm text-yellow-700">
                                  No quotations have been submitted yet for this request. Vendors will need to submit quotations after receiving quote requests.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                        {/* Negotiation Tips Section for Review Stage */}
                        <div className="mb-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6 shadow-lg">
                          <div className="flex items-center mb-4">
                            <svg className="h-7 w-7 text-amber-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <h3 className="text-2xl font-bold text-amber-900">Negotiation Tips</h3>
                          </div>
                          <p className="text-sm text-amber-800 mb-6">
                            Use these strategies to prepare for vendor negotiations while reviewing quotations.
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Research & Prepare</h4>
                                  <p className="text-sm text-gray-700">Review all vendor quotations thoroughly. Compare prices, delivery times, and terms. Understand market rates for similar items.</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Set Clear Objectives</h4>
                                  <p className="text-sm text-gray-700">Define your must-haves vs. nice-to-haves. Know your budget limits and acceptable trade-offs before starting negotiations.</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Leverage Competition</h4>
                                  <p className="text-sm text-gray-700">Use multiple vendor quotes to your advantage. Mention competitive offers to encourage better pricing and terms.</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Focus on Value</h4>
                                  <p className="text-sm text-gray-700">Consider total cost of ownership, not just unit price. Factor in delivery time, quality, payment terms, and warranty.</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Build Relationships</h4>
                                  <p className="text-sm text-gray-700">Maintain professional and respectful communication. Long-term vendor relationships can yield better deals and service.</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Document Everything</h4>
                                  <p className="text-sm text-gray-700">Keep detailed records of all discussions, offers, and agreements. Ensure all terms are clearly stated before finalizing.</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : selectedStage === 'Negotiations' ? (
                      <div>
                        {/* Negotiations Stage - Show Selected Vendors in Table */}
                      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                        <div className="mb-4">
                          <h2 className="text-xl font-semibold text-gray-900 mb-2">Negotiations</h2>
                          <p className="text-sm text-gray-600">Vendors selected for negotiations</p>
                        </div>

                        {selectedVendorsForNegotiation.size > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Name</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Email</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Price</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Time</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attachment</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted Date</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Negotiation Notes</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Negotiated Amount</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {quotations
                                  .filter(q => selectedVendorsForNegotiation.has(q['Vendor Name']))
                                  .map((quotation, index) => {
                                    const vendorName = quotation['Vendor Name'];
                                    const currentNegotiationData = negotiationData[vendorName] || { notes: '', amount: '' };
                                    
                                    return (
                                    <tr key={index} className="hover:bg-gray-50">
                                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                          {vendorName}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                          <a 
                                            href={`mailto:${quotation['Vendor Email']}`}
                                            className="text-blue-600 hover:text-blue-800 hover:underline"
                                          >
                                        {quotation['Vendor Email']}
                                          </a>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                          {quotation['Phone Number'] ? (
                                            <a 
                                              href={`tel:${quotation['Phone Number']}`}
                                              className="text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                              {quotation['Phone Number']}
                                            </a>
                                          ) : (
                                            <span className="text-gray-400">N/A</span>
                                          )}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ₹{typeof quotation['Unit Price'] === 'number' 
                                          ? quotation['Unit Price'].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                          : parseFloat(quotation['Unit Price']?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                        ₹{typeof quotation['Total Price'] === 'number' 
                                          ? quotation['Total Price'].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                          : parseFloat(quotation['Total Price']?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {quotation['Delivery Time'] || 'N/A'}
                                      </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                          {quotation['Attachment URL'] ? (
                                            <a
                                              href={quotation['Attachment URL']}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-medium transition-colors"
                                            >
                                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                              </svg>
                                              View
                                            </a>
                                          ) : (
                                            <span className="text-gray-400">No attachment</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                          {quotation['Submitted Date'] 
                                            ? (() => {
                                                try {
                                                  const dateStr = quotation['Submitted Date'].toString();
                                                  const date = dateStr.includes('/') 
                                                    ? new Date(dateStr.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2'))
                                                    : new Date(dateStr);
                                                  if (!isNaN(date.getTime())) {
                                                    return date.toLocaleString('en-US', {
                                                      year: 'numeric',
                                                      month: '2-digit',
                                                      day: '2-digit',
                                                      hour: '2-digit',
                                                      minute: '2-digit'
                                                    });
                                                  }
                                                  return dateStr;
                                                } catch {
                                                  return quotation['Submitted Date'].toString();
                                                }
                                              })()
                                            : 'N/A'}
                                        </td>
                                        <td className="px-4 py-4 text-sm">
                                          <textarea
                                            value={currentNegotiationData.notes}
                                            onChange={(e) => handleNegotiationNotesChange(vendorName, e.target.value)}
                                            placeholder="Enter negotiation notes..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                                            rows={2}
                                          />
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                                          <div className="flex items-center gap-2">
                                            <span className="text-gray-500">₹</span>
                                            <input
                                              type="text"
                                              value={currentNegotiationData.amount}
                                              onChange={(e) => handleNegotiatedAmountChange(vendorName, e.target.value)}
                                              placeholder="0.00"
                                              className="w-24 px-2 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                                            />
                                            {savingNegotiation === vendorName ? (
                                              <span className="text-xs text-gray-500">Saving...</span>
                                            ) : (
                                              <button
                                                onClick={() => handleSaveNegotiationData(vendorName)}
                                                disabled={savingNegotiation === vendorName}
                                                className="px-2 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                title="Save negotiation data"
                                              >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm space-x-2">
                                        <button
                                          onClick={() => handleViewInsight(quotation['Vendor Name'])}
                                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 font-medium transition-colors"
                                        >
                                          Insight
                                        </button>
                                      </td>
                                    </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start">
                              <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                              <div>
                                <p className="text-sm font-medium text-blue-800 mb-1">No vendors selected</p>
                                <p className="text-sm text-blue-700">
                                  Please go to the Review stage and select vendors to proceed with negotiations.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                        {/* Negotiation Tips Section - Below Negotiations Table */}
                        <div className="mb-6 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-6 shadow-lg">
                          <div className="flex items-center mb-4">
                            <svg className="h-7 w-7 text-amber-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <h3 className="text-2xl font-bold text-amber-900">Negotiation Tips</h3>
                          </div>
                          <p className="text-sm text-amber-800 mb-6">
                            Use these strategies to achieve the best outcomes during vendor negotiations.
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Research & Prepare</h4>
                                  <p className="text-sm text-gray-700">Review all vendor quotations thoroughly. Compare prices, delivery times, and terms. Understand market rates for similar items.</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Set Clear Objectives</h4>
                                  <p className="text-sm text-gray-700">Define your must-haves vs. nice-to-haves. Know your budget limits and acceptable trade-offs before starting negotiations.</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Leverage Competition</h4>
                                  <p className="text-sm text-gray-700">Use multiple vendor quotes to your advantage. Mention competitive offers to encourage better pricing and terms.</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Focus on Value</h4>
                                  <p className="text-sm text-gray-700">Consider total cost of ownership, not just unit price. Factor in delivery time, quality, payment terms, and warranty.</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Build Relationships</h4>
                                  <p className="text-sm text-gray-700">Maintain professional and respectful communication. Long-term vendor relationships can yield better deals and service.</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-amber-500">
                              <div className="flex items-start">
                                <svg className="h-5 w-5 text-amber-600 mt-0.5 mr-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1">Document Everything</h4>
                                  <p className="text-sm text-gray-700">Keep detailed records of all discussions, offers, and agreements. Ensure all terms are clearly stated before finalizing.</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : selectedStage === 'Legal and Compliance' ? (
                      <div>
                        {/* Legal and Compliance Stage - Show Vendors from Negotiations with Agreement Acceptance */}
                        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                          <div className="mb-4">
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Legal and Compliance</h2>
                            <p className="text-sm text-gray-600">Track vendor agreement acceptance and compliance status</p>
                          </div>

                          {selectedVendorsForNegotiation.size > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor Email</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Negotiated Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agreement Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agreement Sent Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agreement Accepted Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {quotations
                                    .filter(q => selectedVendorsForNegotiation.has(q['Vendor Name']))
                                    .map((quotation, index) => {
                                      const vendorName = quotation['Vendor Name'];
                                      const isAccepted = quotation['Agreement Accepted'] === 1;
                                      const agreementSentDate = quotation['Agreement Sent Date'] || '';
                                      const agreementAcceptedDate = quotation['Agreement Accepted Date'] || '';
                                      
                                      return (
                                        <tr key={index} className="hover:bg-gray-50">
                                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {vendorName}
                                          </td>
                                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                            <a 
                                              href={`mailto:${quotation['Vendor Email']}`}
                                              className="text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                              {quotation['Vendor Email']}
                                            </a>
                                          </td>
                                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                            {quotation['Negotiated Amount'] 
                                              ? `₹${typeof quotation['Negotiated Amount'] === 'number' 
                                                ? quotation['Negotiated Amount'].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                                : parseFloat(quotation['Negotiated Amount']?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                              : quotation['Total Price'] 
                                                ? `₹${typeof quotation['Total Price'] === 'number' 
                                                  ? quotation['Total Price'].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                                  : parseFloat(quotation['Total Price']?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                : 'N/A'}
                                          </td>
                                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            {isAccepted ? (
                                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                Accepted
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                </svg>
                                                Pending
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {agreementSentDate 
                                              ? new Date(agreementSentDate).toLocaleDateString('en-US', {
                                                  year: 'numeric',
                                                  month: '2-digit',
                                                  day: '2-digit'
                                                })
                                              : '-'}
                                          </td>
                                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {agreementAcceptedDate 
                                              ? new Date(agreementAcceptedDate).toLocaleDateString('en-US', {
                                                  year: 'numeric',
                                                  month: '2-digit',
                                                  day: '2-digit'
                                                })
                                              : '-'}
                                          </td>
                                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center">
                                              <label className="flex items-center cursor-pointer">
                                                <input
                                                  type="checkbox"
                                                  checked={isAccepted}
                                                  onChange={(e) => {
                                                    const newValue = e.target.checked;
                                                    // If checking, set agreement sent date if not already set
                                                    if (newValue && !agreementSentDate) {
                                                      // Agreement is being accepted, so set sent date as today
                                                      handleAgreementAcceptance(vendorName, true);
                                                    } else {
                                                      handleAgreementAcceptance(vendorName, newValue);
                                                    }
                                                  }}
                                                  disabled={savingAgreement === vendorName}
                                                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                />
                                                <span className="ml-2 text-sm text-gray-700">
                                                  {savingAgreement === vendorName ? 'Saving...' : isAccepted ? 'Agreement Accepted' : 'Mark as Accepted'}
                                                </span>
                                              </label>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                              <div className="flex items-start">
                                <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <div>
                                  <p className="text-sm font-medium text-blue-800 mb-1">No vendors available</p>
                                  <p className="text-sm text-blue-700">
                                    Please go to the Negotiations stage and complete negotiations with vendors first.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Agreement Status Overview - Form Style */}
                        <div className="mb-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {quotations
                              .filter(q => selectedVendorsForNegotiation.has(q['Vendor Name']))
                              .map((quotation, index) => {
                                const vendorName = quotation['Vendor Name'];
                                const vendorEmail = quotation['Vendor Email'];
                                const isAccepted = quotation['Agreement Accepted'] === 1;
                                const agreementSentDate = quotation['Agreement Sent Date'] || '';
                                const agreementAcceptedDate = quotation['Agreement Accepted Date'] || '';
                                const negotiatedAmount = quotation['Negotiated Amount'] || quotation['Total Price'] || '0';
                                
                                // Format dates
                                const formatDate = (dateStr: string) => {
                                  if (!dateStr) return '';
                                  try {
                                    const date = new Date(dateStr);
                                    return date.toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    });
                                  } catch {
                                    return dateStr;
                                  }
                                };

                                const currentDate = new Date().toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                });
                                
                                return (
                                  <div key={index} className="bg-white border border-gray-300 shadow-sm">
                                    {/* Document Header */}
                                    <div className="border-b border-gray-300 p-6">
                                      <h3 className="text-2xl font-bold text-center text-gray-900 uppercase tracking-wide mb-6">
                                        Agreement Status Overview
                                      </h3>
                                      
                                      <p className="text-sm text-gray-700 mb-4 leading-relaxed text-left">
                                        This Agreement Status Overview ("Overview") is prepared as of <span className="border-b border-gray-400 px-1 inline-block">{currentDate}</span> to track the status of the procurement agreement between the parties.
                                      </p>
                                    </div>

                                    {/* Parties Section */}
                                    <div className="p-6 border-b border-gray-300">
                                      <p className="text-sm font-semibold text-gray-900 mb-3 uppercase text-left">BY AND BETWEEN:</p>
                                      
                                      <div className="mb-4">
                                        <p className="text-sm font-bold text-gray-900 mb-1 text-left">Disclosing Party:</p>
                                        <div className="border-b border-gray-400 border-dashed min-h-[24px] text-left">
                                          <span className="text-gray-900 font-medium inline-block px-1">Company Name</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 text-left">located at</p>
                                        <div className="border-b border-gray-400 border-dashed min-h-[24px] text-left">
                                          <span className="text-gray-600 inline-block px-1">Company Address</span>
                                        </div>
                                      </div>

                                      <p className="text-sm font-semibold text-gray-900 mb-3 mt-4 uppercase text-left">AND:</p>
                                      
                                      <div className="mb-2">
                                        <p className="text-sm font-bold text-gray-900 mb-1 text-left">Receiving Party:</p>
                                        <div className="border-b border-gray-400 min-h-[24px] text-left">
                                          <span className="text-gray-900 font-medium inline-block px-1">{vendorName || '_____________________'}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 text-left">located at</p>
                                        <div className="border-b border-gray-400 border-dashed min-h-[24px] text-left">
                                          <span className="text-gray-600 inline-block px-1">{vendorEmail || '_____________________'}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Agreement Terms Section */}
                                    <div className="p-6 space-y-5">
                                      {/* Section 1: Agreement Details */}
                                      <div>
                                        <h4 className="text-sm font-bold text-gray-900 mb-2 text-left">1. Agreement Details:</h4>
                                        <div className="text-left">
                                          <p className="text-sm text-gray-700 leading-relaxed">
                                            The negotiated amount for this agreement is: <span className="border-b border-gray-400 px-1 font-semibold inline-block">
                                              ₹{typeof negotiatedAmount === 'number' 
                                                ? negotiatedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                                : parseFloat(negotiatedAmount?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                          </p>
                                        </div>
                                      </div>

                                      {/* Section 2: Agreement Status */}
                                      <div>
                                        <h4 className="text-sm font-bold text-gray-900 mb-2 text-left">2. Agreement Status:</h4>
                                        <div className="space-y-3 text-left">
                                          <div>
                                            <p className="text-sm text-gray-700 mb-1">
                                              <span className="font-semibold">a.</span> Agreement Sent Date:
                                            </p>
                                            <div className="border-b border-gray-400 min-h-[24px] text-left">
                                              <span className={`inline-block px-1 ${agreementSentDate ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                                {agreementSentDate ? formatDate(agreementSentDate) : 'Not sent yet'}
                                              </span>
                                            </div>
                                          </div>
                                          
                                          <div>
                                            <p className="text-sm text-gray-700 mb-1">
                                              <span className="font-semibold">b.</span> Agreement Received by Vendor:
                                            </p>
                                            <div className="border-b border-gray-400 min-h-[24px] text-left">
                                              <span className={`inline-block px-1 ${agreementSentDate ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                                                {agreementSentDate ? 'Yes - Vendor has received the agreement' : 'Pending'}
                                              </span>
                                            </div>
                                          </div>

                                          <div>
                                            <p className="text-sm text-gray-700 mb-1">
                                              <span className="font-semibold">c.</span> Agreement Acceptance Status:
                                            </p>
                                            <div className="border-b border-gray-400 min-h-[24px] text-left">
                                              <span className={`inline-block px-1 ${isAccepted ? 'text-green-700 font-semibold' : 'text-yellow-600 italic'}`}>
                                                {isAccepted ? 'Accepted' : 'Pending Acceptance'}
                                              </span>
                                            </div>
                                          </div>

                                          {isAccepted && agreementAcceptedDate && (
                                            <div>
                                              <p className="text-sm text-gray-700 mb-1">
                                                <span className="font-semibold">d.</span> Agreement Accepted Date:
                                              </p>
                                              <div className="border-b border-gray-400 min-h-[24px] text-left">
                                                <span className="text-gray-900 inline-block px-1">{formatDate(agreementAcceptedDate)}</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Section 3: Current Status Summary */}
                                      <div>
                                        <h4 className="text-sm font-bold text-gray-900 mb-2 text-left">3. Current Status Summary:</h4>
                                        <div className="text-left">
                                          <p className="text-sm text-gray-700 leading-relaxed">
                                            The agreement status is: <span className={`border-b border-gray-400 px-1 font-semibold inline-block ${
                                              isAccepted ? 'text-green-700' : 
                                              agreementSentDate ? 'text-blue-700' : 
                                              'text-gray-500'
                                            }`}>
                                              {isAccepted ? 'COMPLETED - Agreement Accepted' : 
                                               agreementSentDate ? 'IN PROGRESS - Awaiting Vendor Acceptance' : 
                                               'PENDING - Agreement Not Yet Sent'}
                                            </span>
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="p-6 border-t border-gray-300 bg-gray-50">
                                      <div className="flex justify-between items-end mt-8">
                                        <div className="flex-1">
                                          <div className="border-b border-gray-400 min-h-[40px] mb-2"></div>
                                          <p className="text-xs text-gray-600 text-center">Disclosing Party Signature</p>
                                        </div>
                                        <div className="flex-1 mx-8">
                                          <div className="border-b border-gray-400 min-h-[40px] mb-2"></div>
                                          <p className="text-xs text-gray-600 text-center">Receiving Party Signature</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    ) : selectedStage === 'Approval' ? (
                      <div>
                        {/* Approval Stage - Review and Approve Vendors with Accepted Agreements */}
                        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                          <div className="mb-4">
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Approval</h2>
                            <p className="text-sm text-gray-600">Review vendor agreement acceptance and approve vendors for procurement</p>
                          </div>

                          {loadingQuotations ? (
                            <div className="flex justify-center items-center py-8">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                          ) : quotations.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                              <p>No quotations found. Please complete previous stages first.</p>
                            </div>
                          ) : (() => {
                            // Filter vendors with accepted agreements
                            const vendorsWithAcceptedAgreements = quotations.filter(q => 
                              q['Agreement Accepted'] === 1 || q['Agreement Accepted'] === '1'
                            );

                            if (vendorsWithAcceptedAgreements.length === 0) {
                              return (
                                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                                  <div className="flex items-start">
                                    <div className="shrink-0">
                                      <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                      </svg>
                                    </div>
                                    <div className="ml-3">
                                      <h3 className="text-sm font-medium text-yellow-800">No Accepted Agreements</h3>
                                      <p className="mt-1 text-sm text-yellow-700">
                                        There are no vendors with accepted agreements yet. Please go to the Legal and Compliance stage and wait for vendors to accept their agreements.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Vendor Name
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Email
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Negotiated Amount
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Agreement Accepted Date
                                      </th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                      </th>
                                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Action
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {vendorsWithAcceptedAgreements.map((quotation, index) => {
                                      const vendorName = quotation['Vendor Name'];
                                      const vendorEmail = quotation['Vendor Email'];
                                      const negotiatedAmount = quotation['Negotiated Amount'] || quotation['Total Price'] || '0';
                                      const agreementAcceptedDate = quotation['Agreement Accepted Date'] || '';
                                      const isApproved = approvedVendors.has(vendorName);
                                      const isSaving = savingApproval === vendorName;

                                      const formatDate = (dateStr: string) => {
                                        if (!dateStr) return 'N/A';
                                        try {
                                          const date = new Date(dateStr);
                                          return date.toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                          });
                                        } catch {
                                          return dateStr;
                                        }
                                      };

                                      return (
                                        <tr key={index} className={isApproved ? 'bg-green-50' : 'hover:bg-gray-50'}>
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{vendorName}</div>
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600">{vendorEmail}</div>
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-semibold text-gray-900">
                                              ₹{typeof negotiatedAmount === 'number' 
                                                ? negotiatedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                                                : parseFloat(negotiatedAmount?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600">{formatDate(agreementAcceptedDate)}</div>
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap">
                                            {isApproved ? (
                                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                                Approved
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                Pending Approval
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {isSaving ? (
                                              <div className="flex justify-center">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => handleVendorApproval(vendorName, !isApproved)}
                                                className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                                  isApproved
                                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    : 'bg-green-600 text-white hover:bg-green-700'
                                                }`}
                                              >
                                                {isApproved ? (
                                                  <>
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    Revoke Approval
                                                  </>
                                                ) : (
                                                  <>
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Approve Vendor
                                                  </>
                                                )}
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>

                                {/* Summary Section */}
                                <div className="mt-6 bg-gray-50 rounded-lg p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium text-gray-700">
                                        Total Vendors with Accepted Agreements: <span className="font-semibold">{vendorsWithAcceptedAgreements.length}</span>
                                      </p>
                                      <p className="text-sm text-gray-600 mt-1">
                                        Approved Vendors: <span className="font-semibold text-green-700">{approvedVendors.size}</span> | 
                                        Pending Approval: <span className="font-semibold text-yellow-600">{vendorsWithAcceptedAgreements.length - approvedVendors.size}</span>
                                      </p>
                                    </div>
                                    {approvedVendors.size > 0 && (
                                      <button
                                        onClick={async () => {
                                          if (window.confirm('Are you ready to proceed to PO Creation? This will move the request to the next stage.')) {
                                            try {
                                              const response = await fetch('/api/update-stage', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  id: submission?.id,
                                                  requestId: submission?.requestId || submission?.id,
                                                  stage: 'PO Creation'
                                                })
                                              });
                                              const result = await response.json();
                                              if (result.success) {
                                                setSubmission(prev => prev ? { ...prev, stage: 'PO Creation' } : null);
                                                setSelectedStage('PO Creation');
                                                alert('Request moved to PO Creation stage successfully!');
                                              } else {
                                                alert('Failed to update stage: ' + (result.error || 'Unknown error'));
                                              }
                                            } catch (err) {
                                              console.error('Error updating stage:', err);
                                              alert('An error occurred while updating the stage');
                                            }
                                          }
                                        }}
                                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                                      >
                                        Proceed to PO Creation
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ) : selectedStage === 'PO Creation' ? (
                      <div>
                        {/* PO Creation Stage - Display PO and Send to Vendor */}
                        {(() => {
                          // Get approved vendors with their details
                          const approvedVendorsList = quotations.filter(q => {
                            const vendorName = q['Vendor Name'];
                            return (q['Vendor Approved'] === 1 || q['Vendor Approved'] === '1' || approvedVendors.has(vendorName));
                          });

                          if (approvedVendorsList.length === 0) {
                            return (
                              <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                                <div className="flex items-start">
                                  <div className="shrink-0">
                                    <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                  </div>
                                  <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">No Approved Vendors</h3>
                                    <p className="mt-1 text-sm text-yellow-700">
                                      There are no approved vendors yet. Please go to the Approval stage and approve vendors first.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // For now, show PO for the first approved vendor (can be extended to show all)
                          const vendor = approvedVendorsList[0];
                          const vendorName = vendor['Vendor Name'];
                          const vendorEmail = vendor['Vendor Email'];
                          const negotiatedAmount = vendor['Negotiated Amount'] || vendor['Total Price'] || 0;
                          const itemName = submission?.itemName || '';
                          const quantity = submission?.quantity || 1;
                          const unitPrice = vendor['Unit Price'] || 0;
                          const totalPrice = typeof negotiatedAmount === 'number' 
                            ? negotiatedAmount 
                            : parseFloat(negotiatedAmount?.toString() || '0');
                          
                          // Generate PO Number
                          const poNumber = `PO-${submission?.requestId || 'N/A'}-${Date.now().toString().slice(-6)}`;
                          const poDate = new Date().toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }).replace(/\//g, '-');

                          const handleSendPO = async () => {
                            if (!submission?.requestId) {
                              alert('Request ID not found');
                              return;
                            }

                            if (window.confirm(`Send Purchase Order to ${vendorName} (${vendorEmail})?`)) {
                              setSendingPO(vendorName);
                              try {
                                const response = await fetch('/api/send-purchase-order', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    requestId: submission.requestId || submission.id,
                                    vendorName: vendorName,
                                    vendorEmail: vendorEmail,
                                    poNumber: poNumber,
                                    poDate: poDate,
                                    itemName: itemName,
                                    quantity: quantity,
                                    unitPrice: unitPrice,
                                    totalPrice: totalPrice,
                                    requesterEmail: submission.requesterEmail,
                                    requesterName: submission.requesterName,
                                    department: submission.department
                                  }),
                                });

                                const result = await response.json();

                                if (result.success) {
                                  // Update quotation state immediately to show green checkmark
                                  setQuotations(prevQuotations => 
                                    prevQuotations.map(q => 
                                      q['Vendor Name'] === vendorName && q['Request ID'] === (submission?.requestId || submission?.id)
                                        ? { ...q, 'PO Sent': 1 }
                                        : q
                                    )
                                  );
                                  
                                  alert(`Purchase Order sent successfully to ${vendorName}!`);
                                  // Refresh quotations to get updated PO Sent status from sheet
                                  if (submission?.requestId) {
                                    await fetchQuotations(submission.requestId || submission.id);
                                  }
                                } else {
                                  alert(`Failed to send PO: ${result.error || 'Unknown error'}`);
                                }
                              } catch (err) {
                                console.error('Error sending PO:', err);
                                alert('An error occurred while sending the Purchase Order');
                              } finally {
                                setSendingPO('');
                              }
                            }
                          };

                          return (
                            <div className="mb-6">
                              {/* Purchase Order Display */}
                              <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
                                {/* Header Section */}
                                <div className="flex justify-between items-start mb-8">
                                  {/* Left - Empty space (branding removed) */}
                                  <div className="flex-1"></div>

                                  {/* Right - PO Title & Details */}
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
                                    <div className="bg-gray-100 text-gray-900 px-4 py-2 font-semibold mb-2 border border-gray-300">VENDOR</div>
                                    <div className="border border-gray-300 p-4 space-y-1 text-sm text-gray-900">
                                      <p className="font-semibold">{vendorName}</p>
                                      {vendorEmail && <p>{vendorEmail}</p>}
                                      {vendor['Phone Number'] && <p>Phone: {vendor['Phone Number']}</p>}
                                    </div>
                                  </div>

                                  {/* Ship To */}
                                  <div>
                                    <div className="bg-gray-100 text-gray-900 px-4 py-2 font-semibold mb-2 border border-gray-300">SHIP TO</div>
                                    <div className="border border-gray-300 p-4 space-y-1 text-sm text-gray-900">
                                      {submission?.requesterName && <p className="font-semibold">{submission.requesterName}</p>}
                                      {submission?.department && <p>{submission.department}</p>}
                                      {submission?.requesterEmail && <p>{submission.requesterEmail}</p>}
                                    </div>
                                  </div>
                                </div>

                                {/* Order Logistics */}
                                <div className="grid grid-cols-4 gap-4 mb-6">
                                  <div>
                                    <div className="bg-gray-100 text-gray-900 px-4 py-2 font-semibold mb-2 text-sm border border-gray-300">REQUISITIONER</div>
                                    <div className="border border-gray-300 p-3 text-sm text-gray-900">{submission?.requesterName || '-'}</div>
                                  </div>
                                  <div>
                                    <div className="bg-gray-100 text-gray-900 px-4 py-2 font-semibold mb-2 text-sm border border-gray-300">SHIP VIA</div>
                                    <div className="border border-gray-300 p-3 text-sm text-gray-900">Standard Ground Shipping</div>
                                  </div>
                                  <div>
                                    <div className="bg-gray-100 text-gray-900 px-4 py-2 font-semibold mb-2 text-sm border border-gray-300">F.O.B.</div>
                                    <div className="border border-gray-300 p-3 text-sm text-gray-900">Origin</div>
                                  </div>
                                  <div>
                                    <div className="bg-gray-100 text-gray-900 px-4 py-2 font-semibold mb-2 text-sm border border-gray-300">SHIPPING TERMS</div>
                                    <div className="border border-gray-300 p-3 text-sm text-gray-900">Net 30 Days</div>
                                  </div>
                                </div>

                                {/* Items Table */}
                                <div className="mb-6">
                                  <div className="bg-gray-100 text-gray-900 px-4 py-2 font-semibold border border-gray-300">ITEMS</div>
                                  <table className="w-full border-collapse border border-gray-300">
                                    <thead>
                                      <tr className="bg-gray-100 text-gray-900">
                                        <th className="border border-gray-300 px-4 py-2 text-left">ITEM #</th>
                                        <th className="border border-gray-300 px-4 py-2 text-left">DESCRIPTION</th>
                                        <th className="border border-gray-300 px-4 py-2 text-center">QTY</th>
                                        <th className="border border-gray-300 px-4 py-2 text-right">UNIT PRICE</th>
                                        <th className="border border-gray-300 px-4 py-2 text-right">TOTAL</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td className="border border-gray-300 px-4 py-2 text-gray-900">{submission?.requestId || '-'}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-gray-900">{itemName}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-center text-gray-900">{quantity}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-right text-gray-900">₹{typeof unitPrice === 'number' 
                                          ? unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                          : parseFloat(unitPrice?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="border border-gray-300 px-4 py-2 text-right text-gray-900">₹{totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>

                                {/* Summary Section */}
                                <div className="flex justify-end mb-6">
                                  <div className="w-64">
                                    <div className="space-y-2 text-sm text-gray-900">
                                      <div className="flex justify-between">
                                        <span>SUBTOTAL:</span>
                                        <span>₹{totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>TAX:</span>
                                        <span>-</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>SHIPPING:</span>
                                        <span>-</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>OTHER:</span>
                                        <span>-</span>
                                      </div>
                                      <div className="bg-gray-100 px-4 py-2 font-bold flex justify-between mt-2 border border-gray-300">
                                        <span>TOTAL:</span>
                                        <span>₹{totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Comments Section */}
                                <div className="mb-6">
                                  <div className="bg-gray-100 text-gray-900 px-4 py-2 font-semibold mb-2 border border-gray-300">Comments or Special Instructions</div>
                                  <div className="border border-gray-300 p-4 min-h-[100px] text-sm text-gray-900">
                                    {vendor['Notes'] || ''}
                                  </div>
                                </div>

                                {/* Contact Info */}
                                {(submission?.requesterName || submission?.requesterEmail) && (
                                  <div className="text-center text-xs text-gray-900 mt-4">
                                    <p>If you have any questions about this purchase order, please contact {submission?.requesterName || ''}{submission?.requesterName && submission?.requesterEmail ? ', ' : ''}{submission?.requesterEmail || ''}</p>
                                  </div>
                                )}
                              </div>

                              {/* Send PO Button */}
                              <div className="mt-6 flex justify-center">
                                <button
                                  onClick={handleSendPO}
                                  disabled={sendingPO === vendorName}
                                  className={`inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-md text-base font-medium hover:bg-green-700 transition-colors ${
                                    sendingPO === vendorName ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                >
                                  {sendingPO === vendorName ? (
                                    <>
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                      Sending PO...
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                      </svg>
                                      Send PO to {vendorName}
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      /* Show stage-specific message for other stages */
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
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quotation Detail Modal */}
      {showQuotationDetail && selectedQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className={`${insightHeaderClasses} flex justify-between items-center`}>
              <h2 className="text-xl font-bold text-white">
                Quotation Details - {selectedQuotation['Vendor Name']}
              </h2>
              <button
                onClick={() => {
                  setShowQuotationDetail(false);
                  setSelectedQuotation(null);
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Vendor Information Section */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Vendor Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Vendor Name</p>
                      <p className="text-base font-semibold text-gray-900">{selectedQuotation['Vendor Name']}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Vendor Email</p>
                      <a 
                        href={`mailto:${selectedQuotation['Vendor Email']}`}
                        className="text-base text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {selectedQuotation['Vendor Email']}
                      </a>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Phone Number</p>
                      {selectedQuotation['Phone Number'] ? (
                        <a 
                          href={`tel:${selectedQuotation['Phone Number']}`}
                          className="text-base text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {selectedQuotation['Phone Number']}
                        </a>
                      ) : (
                        <p className="text-base text-gray-400">Not provided</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Request ID</p>
                      <p className="text-base font-mono text-gray-700">{selectedQuotation['Request ID']}</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Information Section */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pricing Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Unit Price</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ₹{typeof selectedQuotation['Unit Price'] === 'number' 
                          ? selectedQuotation['Unit Price'].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                          : parseFloat(selectedQuotation['Unit Price']?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Total Price</p>
                      <p className="text-2xl font-bold text-green-700">
                        ₹{typeof selectedQuotation['Total Price'] === 'number' 
                          ? selectedQuotation['Total Price'].toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                          : parseFloat(selectedQuotation['Total Price']?.toString() || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Delivery & Timeline Section */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-orange-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Delivery & Timeline
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Delivery Time</p>
                      <p className="text-base font-semibold text-gray-900">
                        {selectedQuotation['Delivery Time'] || <span className="text-gray-400">Not specified</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">Submitted Date</p>
                      <p className="text-base font-semibold text-gray-900">
                        {selectedQuotation['Submitted Date'] 
                          ? (() => {
                              try {
                                const dateStr = selectedQuotation['Submitted Date'].toString();
                                // Handle DD/MM/YYYY HH:MM:SS format
                                if (dateStr.includes('/')) {
                                  const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
                                  if (parts) {
                                    const date = new Date(`${parts[3]}-${parts[2]}-${parts[1]}T${parts[4]}:${parts[5]}:${parts[6]}`);
                                    if (!isNaN(date.getTime())) {
                                      return date.toLocaleString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      });
                                    }
                                  }
                                }
                                const date = new Date(dateStr);
                                if (!isNaN(date.getTime())) {
                                  return date.toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                }
                                return dateStr;
                              } catch {
                                return selectedQuotation['Submitted Date'].toString();
                              }
                            })()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                {selectedQuotation['Notes'] && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Additional Notes
                    </h3>
                    <p className="text-base text-gray-700 whitespace-pre-wrap">{selectedQuotation['Notes']}</p>
                  </div>
                )}

                {/* Attachment Section */}
                {selectedQuotation['Attachment URL'] && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Quotation Document
                    </h3>
                    <div className="flex items-center justify-between bg-white rounded-md p-4 border border-purple-300">
                      <div className="flex items-center">
                        <svg className="w-8 h-8 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Detailed Quotation Document</p>
                          <p className="text-xs text-gray-500 mt-1">Click to view/download the full quotation</p>
                        </div>
                      </div>
                      <a
                        href={selectedQuotation['Attachment URL']}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium transition-colors flex items-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open Document
                      </a>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => {
                      handleToggleQuotationVendor(selectedQuotation['Vendor Name']);
                      setShowQuotationDetail(false);
                    }}
                    className={`px-6 py-2 rounded-md font-medium transition-colors ${
                      selectedVendorsForNegotiation.has(selectedQuotation['Vendor Name'])
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {selectedVendorsForNegotiation.has(selectedQuotation['Vendor Name'])
                      ? 'Deselect for Negotiation'
                      : 'Select for Negotiation'}
                  </button>
                  <button
                    onClick={() => {
                      setShowQuotationDetail(false);
                      setSelectedQuotation(null);
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insight Modal */}
      {showInsight && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className={`${insightHeaderClasses} flex justify-between items-center`}>
              <h2 className="text-xl font-bold text-white">
                Vendor Insight: {selectedVendorForInsight}
              </h2>
              <button
                onClick={() => {
                  setShowInsight(false);
                  setVendorHistory([]);
                  setSelectedVendorForInsight('');
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="text-center py-12 text-gray-500">
                  <p>Loading vendor history...</p>
                </div>
              ) : vendorHistory.length > 0 ? (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">
                      Vendor Information & History
                    </h3>
                    <p className="text-sm text-blue-700">
                      This vendor has {vendorHistory.length} record(s) in the vendor catalog.
                    </p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {vendorHistory.length > 0 && Object.keys(vendorHistory[0]).map((key, index) => (
                            <th key={index} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {vendorHistory.map((record, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            {Object.values(record).map((value, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {value !== null && value !== undefined ? String(value) : 'N/A'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-yellow-800 mb-1">No history found</p>
                      <p className="text-sm text-yellow-700">
                        No historical records found for this vendor in the vendor catalog.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

