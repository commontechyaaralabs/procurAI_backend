import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const GOOGLE_SHEETS_READ_URL = process.env.GOOGLE_SHEETS_READ_URL || process.env.GOOGLE_SCRIPT_URL || '';

    if (!GOOGLE_SHEETS_READ_URL) {
      console.error('GOOGLE_SHEETS_READ_URL is not configured');
      return NextResponse.json(
        { error: 'Read URL not configured. Please set GOOGLE_SHEETS_READ_URL in .env file' },
        { status: 500 }
      );
    }

    // Get itemName from query params if provided
    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName') || '';
    
    // Fetch vendors with action=vendors
    let vendorUrl = GOOGLE_SHEETS_READ_URL.includes('?') 
      ? `${GOOGLE_SHEETS_READ_URL}&action=vendors`
      : `${GOOGLE_SHEETS_READ_URL}?action=vendors`;
    
    if (itemName) {
      vendorUrl += `&itemName=${encodeURIComponent(itemName)}`;
    }

    console.log('Fetching vendors from:', vendorUrl);

    const response = await fetch(vendorUrl, {
      method: 'GET',
    });

    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const textResult = await response.text();
      console.error('Non-JSON response from Google Script:', textResult.substring(0, 500));
      return NextResponse.json(
        { 
          success: false,
          error: `Invalid response from Google Script: ${textResult.substring(0, 200)}` 
        },
        { status: 500 }
      );
    }

    if (response.ok && result.success) {
      return NextResponse.json({ 
        success: true, 
        vendors: result.vendors || []
      });
    } else {
      console.error('Google Script returned error:', result);
      return NextResponse.json(
        { success: false, error: result.error || 'Google Script returned an error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { 
        success: false,
        error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

