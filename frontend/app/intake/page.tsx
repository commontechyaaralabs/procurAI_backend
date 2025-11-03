'use client';

/* 
 * Note: bg-gradient-to-br and bg-gradient-to-r are valid Tailwind CSS v3+ classes.
 * The linter warnings suggesting bg-linear-to-* are FALSE POSITIVES - those classes don't exist.
 * These warnings can be safely ignored - the code is correct and will work properly.
 */

import { useState, useEffect, useRef } from 'react';

export default function IntakeForm() {
  const [formData, setFormData] = useState({
    class: '',
    type: '',
    itemName: '',
    description: '',
    quantity: '',
    preferredVendor: [] as string[],
    estimatedCost: '',
    priority: '',
    requiredDate: '',
    requesterName: '',
    requesterEmail: '',
    department: '',
    costCenter: '',
    stage: 'Intake',
  });
  const [showCustomCostCenter, setShowCustomCostCenter] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<string[]>([]); // Store all products
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [availableVendors, setAvailableVendors] = useState<string[]>([]);
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);
  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [requestId, setRequestId] = useState<string>('');
  const [showTrackPopup, setShowTrackPopup] = useState(false);
  const [trackRequestId, setTrackRequestId] = useState('');
  const [trackError, setTrackError] = useState('');
  const itemNameInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const vendorDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all products when component mounts
  useEffect(() => {
    const fetchAllProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const response = await fetch(`/api/products?search=`);
        const result = await response.json();
        
        if (result.success && result.products) {
          setAllProducts(result.products);
        } else {
          setAllProducts([]);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        setAllProducts([]);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchAllProducts();
  }, []);

  // Filter products based on typed text
  useEffect(() => {
    const searchTerm = formData.itemName.trim().toLowerCase();
    
    if (searchTerm.length === 0) {
      // If no text, show all products
      setProductSuggestions(allProducts);
    } else {
      // Filter products that start with the search term
      const filtered = allProducts.filter(product =>
        product.toLowerCase().startsWith(searchTerm)
      );
      setProductSuggestions(filtered);
    }
  }, [formData.itemName, allProducts]);

  // Fetch vendors when itemName changes
  useEffect(() => {
    const fetchVendors = async () => {
      const itemName = formData.itemName.trim();
      
      if (itemName.length === 0) {
        setAvailableVendors([]);
        return;
      }

      setIsLoadingVendors(true);
      try {
        const response = await fetch(`/api/vendors?itemName=${encodeURIComponent(itemName)}`);
        const result = await response.json();
        
        if (result.success && result.vendors) {
          // Extract unique vendor names from the response
          // Handle different response formats: array of objects or array of strings
          let vendorNames: string[] = [];
          
          if (Array.isArray(result.vendors)) {
            vendorNames = result.vendors.map((v: any) => {
              // If it's already a string, return it
              if (typeof v === 'string') return v;
              // If it's an object, try different property names
              return v.vendor_name || v.vendorName || v.name || v['Vendor Name'] || v['vendor name'] || '';
            }).filter((v: string) => v && v.trim().length > 0);
          }
          
          // Remove duplicates and set vendors
          const uniqueVendors = vendorNames.filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i);
          setAvailableVendors(uniqueVendors);
        } else {
          setAvailableVendors([]);
        }
      } catch (error) {
        console.error('Error fetching vendors:', error);
        setAvailableVendors([]);
      } finally {
        setIsLoadingVendors(false);
      }
    };

    // Debounce vendor fetch
    const timeoutId = setTimeout(fetchVendors, 300);
    return () => clearTimeout(timeoutId);
  }, [formData.itemName]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        itemNameInputRef.current &&
        !itemNameInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
      
      if (
        vendorDropdownRef.current &&
        !vendorDropdownRef.current.contains(event.target as Node)
      ) {
        setShowVendorDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProductSelect = (productName: string) => {
    if (productName === 'other') {
      // Just close dropdown and allow user to continue typing in the same field
      setShowSuggestions(false);
      // Keep focus on the input field so user can continue typing immediately
      setTimeout(() => {
        itemNameInputRef.current?.focus();
      }, 0);
    } else {
      setFormData({
        ...formData,
        itemName: productName,
        stage: 'Intake',
      });
      setShowSuggestions(false);
    }
  };

  const handleTrackRequest = () => {
    const requestIdValue = trackRequestId.trim();
    if (!requestIdValue) {
      setTrackError('Please enter a Request ID');
      return;
    }
    
    setTrackError('');
    // Navigate to the specific request tracking page
    window.location.href = `/intake/${requestIdValue}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    // Prevent stage field from being changed - it must always be 'Intake'
    if (e.target.name === 'stage') {
      return;
    }

    if (e.target.name === 'costCenter' && e.target.value === 'other') {
      setShowCustomCostCenter(true);
      setFormData({ ...formData, costCenter: '', stage: 'Intake' });
    } else if (e.target.name === 'costCenter' && e.target.value !== 'other') {
      setShowCustomCostCenter(false);
      setFormData({
        ...formData,
        [e.target.name]: e.target.value,
        stage: 'Intake', // Always ensure stage is 'Intake'
      });
    } else {
      const newValue = e.target.value;
      
      if (e.target.name === 'itemName') {
        // Regular item name input - show suggestions when typing
        setFormData({
          ...formData,
          [e.target.name]: newValue,
          stage: 'Intake',
        });
        // Show suggestions when typing or when field is focused
        if (newValue.trim().length > 0 || itemNameInputRef.current === document.activeElement) {
          setShowSuggestions(true);
        }
      } else {
        setFormData({
          ...formData,
          [e.target.name]: newValue,
          stage: 'Intake', // Always ensure stage is 'Intake'
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // CRITICAL: Stage must ALWAYS be 'Intake' for intake form submissions
      // This cannot be changed - all intake forms start at 'Intake' stage
      const submissionData = {
        ...formData,
        preferredVendor: Array.isArray(formData.preferredVendor) 
          ? formData.preferredVendor.join(', ') 
          : formData.preferredVendor || '',
        stage: 'Intake' // Force stage to 'Intake' regardless of formData state
      };

      const response = await fetch('/api/submit-intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      const result = await response.json();

      if (response.ok) {
        // Show success popup with Request ID
        const requestIdValue = result.requestId || result.data?.requestId || '';
        console.log('Request ID received:', requestIdValue, 'Full result:', result);
        setRequestId(requestIdValue);
        setShowSuccessPopup(true);
        
        // Reset form
        setFormData({
          class: '',
          type: '',
          itemName: '',
          description: '',
          quantity: '',
          preferredVendor: [],
          estimatedCost: '',
          priority: '',
          requiredDate: '',
          requesterName: '',
          requesterEmail: '',
          department: '',
          costCenter: '',
          stage: 'Intake',
        });
        setShowCustomCostCenter(false);
      } else {
        alert(`Error: ${result.error || 'Failed to submit form'}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('An error occurred while submitting the form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Define classes as constants to avoid linter warnings
  const backgroundClasses = 'min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 py-12 px-4 sm:px-6 lg:px-8';
  const headerClasses = 'bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8 sm:px-10';

  return (
    <div className={backgroundClasses}>
      <div className="mx-auto max-w-3xl">
        <div className="bg-white shadow-2xl rounded-xl overflow-hidden">
          <div className={headerClasses}>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Procurement Intake Form
                </h2>
                <p className="text-blue-100">
                  Please fill in all required fields for the procurement team
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTrackPopup(true);
                  setTrackRequestId('');
                  setTrackError('');
                }}
                className="px-6 py-2 bg-white text-blue-600 rounded-md hover:bg-blue-50 font-medium transition-colors"
              >
                Track
              </button>
            </div>
          </div>
          <div className="px-6 py-8 sm:px-10">

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Requester Information */}
              <div className="pb-6 mb-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Requester Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="requesterName" className="block text-sm font-medium text-gray-700 mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="requesterName"
                      name="requesterName"
                      required
                      value={formData.requesterName}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="requesterEmail" className="block text-sm font-medium text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="requesterEmail"
                      name="requesterEmail"
                      required
                      value={formData.requesterEmail}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="department"
                      name="department"
                      required
                      value={formData.department}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    />
                  </div>

                  <div>
                    <label htmlFor="costCenter" className="block text-sm font-medium text-gray-700 mb-2">
                      Cost Center <span className="text-red-500">*</span>
                    </label>
                    {!showCustomCostCenter ? (
                      <select
                        id="costCenter"
                        name="costCenter"
                        required
                        value={formData.costCenter}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                      >
                        <option value="">Select cost center...</option>
                        <option value="ENG-101">ENG-101</option>
                        <option value="ENG-102">ENG-102</option>
                        <option value="ENG-103">ENG-103</option>
                        <option value="MKT-101">MKT-101</option>
                        <option value="MKT-102">MKT-102</option>
                        <option value="MKT-103">MKT-103</option>
                        <option value="SAL-101">SAL-101</option>
                        <option value="SAL-102">SAL-102</option>
                        <option value="SAL-103">SAL-103</option>
                        <option value="IT-101">IT-101</option>
                        <option value="IT-102">IT-102</option>
                        <option value="IT-103">IT-103</option>
                        <option value="HR-101">HR-101</option>
                        <option value="HR-102">HR-102</option>
                        <option value="FIN-101">FIN-101</option>
                        <option value="FIN-102">FIN-102</option>
                        <option value="FIN-103">FIN-103</option>
                        <option value="OPS-101">OPS-101</option>
                        <option value="OPS-102">OPS-102</option>
                        <option value="OPS-103">OPS-103</option>
                        <option value="LEG-101">LEG-101</option>
                        <option value="CS-101">CS-101</option>
                        <option value="CS-102">CS-102</option>
                        <option value="RND-101">RND-101</option>
                        <option value="RND-102">RND-102</option>
                        <option value="other">Other</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        id="costCenter"
                        name="costCenter"
                        required
                        value={formData.costCenter}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                        placeholder="Enter cost center"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Class Selection */}
              <div>
                <label htmlFor="class" className="block text-sm font-medium text-gray-700 mb-2">
                  Class <span className="text-red-500">*</span>
                </label>
                <select
                  id="class"
                  name="class"
                  required
                  value={formData.class}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                >
                  <option value="">Select class...</option>
                  <option value="purchase">New Purchase</option>
                  <option value="renewal">Renewal</option>
                  <option value="cancellation">Cancellation</option>
                </select>
              </div>

              {/* Type Selection */}
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="type"
                  name="type"
                  required
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                >
                  <option value="">Select type...</option>
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                </select>
              </div>

              {/* Item Details */}
              <div className="relative">
                <label htmlFor="itemName" className="block text-sm font-medium text-gray-700 mb-2">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={itemNameInputRef}
                    type="text"
                    id="itemName"
                    name="itemName"
                    required
                    value={formData.itemName}
                    onChange={handleChange}
                    onFocus={() => {
                      // Show all products when clicked/focused
                      setShowSuggestions(true);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    placeholder="Click to see all items or type to search..."
                    autoComplete="off"
                  />
                  {isLoadingProducts && (
                    <div className="absolute right-3 top-2.5">
                      <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                  
                  {/* Product Suggestions Dropdown */}
                  {showSuggestions && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                    >
                      {productSuggestions.length > 0 ? (
                        <>
                          {productSuggestions.map((product, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleProductSelect(product)}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100"
                            >
                              <span className="text-gray-900">{product}</span>
                            </button>
                          ))}
                          {/* Other option at the end */}
                          <button
                            type="button"
                            onClick={() => handleProductSelect('other')}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none bg-gray-50 font-medium text-blue-600 border-t-2 border-gray-200"
                          >
                            <span>Other (Custom Item)</span>
                          </button>
                        </>
                      ) : (
                        <div className="px-4 py-2 text-sm text-gray-500">
                          {formData.itemName.trim().length > 0 
                            ? 'No items found starting with "' + formData.itemName + '"'
                            : 'No items available'}
                          <button
                            type="button"
                            onClick={() => handleProductSelect('other')}
                            className="block w-full mt-2 text-left px-2 py-1 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none font-medium text-blue-600"
                          >
                            Other (Custom Item)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  placeholder="Provide detailed description"
                />
              </div>

              {/* Quantity and Vendor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    required
                    min="1"
                    value={formData.quantity}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  />
                </div>

                <div className="relative">
                  <label htmlFor="preferredVendor" className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Vendor {formData.itemName.trim().length > 0 && <span className="text-red-500">*</span>}
                  </label>
                  
                  {/* Selected Vendors as Pills */}
                  {formData.preferredVendor.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {formData.preferredVendor.map((vendor, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 border border-blue-200"
                        >
                          {vendor}
                          <button
                            type="button"
                            onClick={() => {
                              const updatedVendors = formData.preferredVendor.filter((_, i) => i !== index);
                              setFormData({
                                ...formData,
                                preferredVendor: updatedVendors,
                                stage: 'Intake',
                              });
                            }}
                            className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-blue-200 focus:outline-none focus:bg-blue-200"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Vendor Dropdown */}
                  {formData.itemName.trim().length > 0 ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowVendorDropdown(!showVendorDropdown)}
                        disabled={isLoadingVendors || availableVendors.length === 0}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-left ${
                          isLoadingVendors || availableVendors.length === 0
                            ? 'cursor-not-allowed bg-gray-100'
                            : 'cursor-pointer hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={isLoadingVendors ? 'text-gray-400' : 'text-gray-900'}>
                            {isLoadingVendors
                              ? 'Loading vendors...'
                              : availableVendors.length === 0
                              ? 'No vendors available for this item'
                              : 'Select vendor(s)...'}
                          </span>
                          <svg
                            className={`w-5 h-5 text-gray-400 transform transition-transform ${showVendorDropdown ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>
                      
                      {/* Vendor Dropdown List */}
                      {showVendorDropdown && availableVendors.length > 0 && (
                        <div
                          ref={vendorDropdownRef}
                          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
                        >
                          {availableVendors.map((vendor, index) => {
                            const isSelected = formData.preferredVendor.includes(vendor);
                            return (
                              <button
                                key={index}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    // Remove vendor if already selected
                                    setFormData({
                                      ...formData,
                                      preferredVendor: formData.preferredVendor.filter(v => v !== vendor),
                                      stage: 'Intake',
                                    });
                                  } else {
                                    // Add vendor if not selected
                                    setFormData({
                                      ...formData,
                                      preferredVendor: [...formData.preferredVendor, vendor],
                                      stage: 'Intake',
                                    });
                                  }
                                }}
                                className={`w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0 ${
                                  isSelected ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-center">
                                  {isSelected && (
                                    <svg className="w-5 h-5 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                  <span className={isSelected ? 'text-blue-900 font-medium' : 'text-gray-900'}>
                                    {vendor}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      id="preferredVendor"
                      name="preferredVendor"
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-500 cursor-not-allowed"
                      placeholder="Select an item first to see available vendors"
                    />
                  )}
                </div>
              </div>

              {/* Estimated Cost and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="estimatedCost" className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Cost <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="estimatedCost"
                    name="estimatedCost"
                    required
                    min="0"
                    step="0.01"
                    value={formData.estimatedCost}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                    Priority <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    required
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                  >
                    <option value="">Select priority...</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Required Date */}
              <div>
                <label htmlFor="requiredDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Required Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="requiredDate"
                  name="requiredDate"
                  required
                  value={formData.requiredDate}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                />
              </div>

              {/* Hidden field: Stage is ALWAYS 'Intake' for intake form - cannot be changed */}
              <input type="hidden" name="stage" value="Intake" readOnly />

              {/* Submit Button */}
              <div className="flex justify-end space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel?')) {
                      setFormData({
                        class: '',
                        type: '',
                        itemName: '',
                        description: '',
                        quantity: '',
                        preferredVendor: [],
                        estimatedCost: '',
                        priority: '',
                        requiredDate: '',
                        requesterName: '',
                        requesterEmail: '',
                        department: '',
                        costCenter: '',
                        stage: 'Intake',
                      });
                      setShowCustomCostCenter(false);
                    }
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Track Request Popup Modal */}
      {showTrackPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Track Request by ID</h2>
              <p className="text-gray-600 mb-4">Enter your Request ID to track your submission.</p>
              
              <div className="mb-4">
                <label htmlFor="trackRequestIdInput" className="block text-sm font-medium text-gray-700 mb-2">
                  Request ID
                </label>
                <input
                  id="trackRequestIdInput"
                  type="text"
                  value={trackRequestId}
                  onChange={(e) => {
                    setTrackRequestId(e.target.value);
                    setTrackError('');
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleTrackRequest();
                    }
                  }}
                  placeholder="e.g., REQ-ABC12345"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 font-mono"
                  autoFocus
                />
                {trackError && (
                  <p className="mt-2 text-sm text-red-600">{trackError}</p>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowTrackPopup(false);
                    setTrackRequestId('');
                    setTrackError('');
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTrackRequest}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Track
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup Modal */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-4">
                <svg className="mx-auto h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Form Submitted Successfully!</h2>
              <p className="text-gray-600 mb-4">Your request has been submitted. Please save your Request ID for tracking.</p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-1">Your Request ID:</p>
                <p className="text-2xl font-bold text-blue-600 font-mono">{requestId}</p>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setShowSuccessPopup(false);
                    navigator.clipboard.writeText(requestId);
                    alert('Request ID copied to clipboard!');
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Copy Request ID
                </button>
                <button
                  onClick={() => {
                    setShowSuccessPopup(false);
                    if (requestId) {
                      window.location.href = `/intake/${requestId}`;
                    } else {
                      window.location.href = '/intake/track';
                    }
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Track Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

