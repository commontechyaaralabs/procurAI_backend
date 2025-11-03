import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { requestId, vendors } = await request.json();

    if (!requestId || !vendors || !Array.isArray(vendors) || vendors.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Request ID and vendors array are required' },
        { status: 400 }
      );
    }

    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || '';

    if (!GOOGLE_SCRIPT_URL) {
      console.error('GOOGLE_SCRIPT_URL is not configured');
      return NextResponse.json(
        { error: 'Google Script URL not configured. Please set GOOGLE_SCRIPT_URL in .env file' },
        { status: 500 }
      );
    }

    console.log('Sending quote requests:', { requestId, vendorCount: vendors.length });

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'sendQuoteRequests',
        requestId: requestId,
        vendors: vendors,
      }),
    });

    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const textResult = await response.text();
      console.error('Non-JSON response from Google Script:', textResult.substring(0, 500));
      return NextResponse.json(
        { success: false, error: 'Invalid response from Google Script' },
        { status: 500 }
      );
    }

    if (response.ok && result.success) {
      return NextResponse.json({ 
        success: true, 
        sentCount: result.sentCount || vendors.length,
        message: result.message
      });
    } else {
      console.error('Google Script error:', result);
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send quotation requests' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error sending quote requests:', error);
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

