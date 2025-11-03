import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { requestId, vendorName, isApproved } = await request.json();

    if (!requestId || !vendorName || typeof isApproved !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Request ID, Vendor Name, and isApproved (boolean) are required' },
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

    console.log('Updating vendor approval:', { requestId, vendorName, isApproved });

    const response = await fetch(GOOGLE_SCRIPT_UPDATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'updateVendorApproval',
        requestId: requestId,
        vendorName: vendorName,
        isApproved: isApproved
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
      console.error('Update error:', result);
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to update vendor approval' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error updating vendor approval:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

