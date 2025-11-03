import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || '';

    if (!GOOGLE_SCRIPT_URL) {
      console.error('GOOGLE_SCRIPT_URL is not configured');
      return NextResponse.json(
        { error: 'Google Script URL not configured. Please set GOOGLE_SCRIPT_URL in .env file' },
        { status: 500 }
      );
    }

    // Build URL with search parameter
    const url = new URL(GOOGLE_SCRIPT_URL);
    url.searchParams.set('action', 'products');
    if (search) {
      url.searchParams.set('search', search);
    }

    console.log('Fetching products from:', url.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
    });

    const contentType = response.headers.get('content-type');
    let result;

    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const textResult = await response.text();
      console.error('Non-JSON response:', textResult.substring(0, 500));
      return NextResponse.json(
        { error: 'Invalid response from Google Script' },
        { status: 500 }
      );
    }

    if (response.ok) {
      return NextResponse.json({ success: true, products: result.products || [] });
    } else {
      console.error('Fetch error:', result);
      return NextResponse.json(
        { error: result.error || 'Failed to fetch products' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

