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

    console.log('Fetching submissions from:', GOOGLE_SHEETS_READ_URL);

    const response = await fetch(GOOGLE_SHEETS_READ_URL, {
      method: 'GET',
    });

    const contentType = response.headers.get('content-type');
    let result;
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
      console.log('Google Script JSON response:', JSON.stringify(result).substring(0, 500));
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

    if (response.ok) {
      // Handle both direct data array and nested data structure
      const data = result.data || result;
      const isArray = Array.isArray(data);
      console.log('Processing Google Script response:', { 
        hasSuccess: 'success' in result, 
        successValue: result.success,
        hasData: 'data' in result,
        dataIsArray: isArray,
        dataLength: isArray ? data.length : 'not array',
        dataType: typeof data
      });
      
      if (!isArray && !result.success) {
        console.error('Google Script returned error:', result);
        return NextResponse.json(
          { success: false, error: result.error || 'Google Script returned an error' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ success: true, data: data });
    } else {
      console.error('Google Script fetch error:', result);
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch submissions' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

