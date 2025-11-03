import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || '';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const vendorName = searchParams.get('vendorName');

    if (!vendorName) {
      return NextResponse.json(
        { success: false, error: 'Vendor Name is required' },
        { status: 400 }
      );
    }

    if (!GOOGLE_SCRIPT_URL) {
      return NextResponse.json(
        { success: false, error: 'Google Script URL not configured' },
        { status: 500 }
      );
    }

    const url = `${GOOGLE_SCRIPT_URL}?action=vendorHistory&vendorName=${encodeURIComponent(vendorName)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch vendor history' },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json({
      success: true,
      history: result.history || [],
    });
  } catch (error) {
    console.error('Error fetching vendor history:', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while fetching vendor history' },
      { status: 500 }
    );
  }
}

