import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { 
      requestId, 
      vendorName, 
      vendorEmail, 
      poNumber, 
      poDate, 
      itemName, 
      quantity, 
      unitPrice, 
      totalPrice,
      requesterEmail,
      requesterName,
      department
    } = await request.json();

    if (!requestId || !vendorName || !vendorEmail) {
      return NextResponse.json(
        { success: false, error: 'Request ID, Vendor Name, and Vendor Email are required' },
        { status: 400 }
      );
    }

    const GOOGLE_SCRIPT_UPDATE_URL = process.env.GOOGLE_SCRIPT_UPDATE_URL || process.env.GOOGLE_SCRIPT_URL || '';

    if (!GOOGLE_SCRIPT_UPDATE_URL) {
      console.error('GOOGLE_SCRIPT_UPDATE_URL is not configured');
      return NextResponse.json(
        { success: false, error: 'Update URL not configured. Please set GOOGLE_SCRIPT_UPDATE_URL in .env file' },
        { status: 500 }
      );
    }

    console.log('Sending Purchase Order:', { requestId, vendorName, vendorEmail, poNumber });

    const response = await fetch(GOOGLE_SCRIPT_UPDATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'sendPurchaseOrder',
        requestId: requestId,
        vendorName: vendorName,
        vendorEmail: vendorEmail,
        poNumber: poNumber,
        poDate: poDate,
        itemName: itemName || '',
        quantity: quantity || 1,
        unitPrice: unitPrice || 0,
        totalPrice: totalPrice || 0,
        requesterEmail: requesterEmail || '',
        requesterName: requesterName || '',
        department: department || ''
      }),
    });

    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const textResult = await response.text();
      console.error('Non-JSON response:', textResult.substring(0, 500));
      return NextResponse.json(
        { success: false, error: 'Invalid response from Google Script' },
        { status: 500 }
      );
    }

    if (response.ok) {
      return NextResponse.json({ success: true, data: result });
    } else {
      console.error('Send PO error:', result);
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send Purchase Order' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error sending Purchase Order:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

