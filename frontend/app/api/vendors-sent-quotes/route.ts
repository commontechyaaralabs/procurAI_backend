import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || '';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const requestId = searchParams.get('requestId');

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: 'Request ID is required' },
        { status: 400 }
      );
    }

    if (!GOOGLE_SCRIPT_URL) {
      return NextResponse.json(
        { success: false, error: 'Google Script URL not configured' },
        { status: 500 }
      );
    }

    // Get quotations to find which vendors have entries (even if they haven't submitted quotes)
    // Vendors who received quotes will have entries in the quotation sheet
    const url = `${GOOGLE_SCRIPT_URL}?action=quotations&requestId=${encodeURIComponent(requestId)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch quotations' },
        { status: response.status || 500 }
      );
    }

    // Extract unique vendor names from quotations
    // This includes vendors who received quotes (have entries) even if they haven't submitted yet
    const vendorsSet = new Set<string>();
    if (result.quotations && Array.isArray(result.quotations)) {
      result.quotations.forEach((q: any) => {
        const vendorName = q['vendorname'] || q['Vendor Name'] || q['vendorname'];
        if (vendorName) {
          vendorsSet.add(vendorName.toString().trim());
        }
      });
    }

    return NextResponse.json({
      success: true,
      vendors: Array.from(vendorsSet),
      count: vendorsSet.size,
    });
  } catch (error) {
    console.error('Error fetching vendors sent quotes:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while fetching vendors' },
      { status: 500 }
    );
  }
}

