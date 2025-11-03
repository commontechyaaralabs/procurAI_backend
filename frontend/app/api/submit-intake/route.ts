import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Google Apps Script Web App URL (replace with your actual URL)
    const GOOGLE_SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL || '';

    if (!GOOGLE_SCRIPT_URL) {
      console.error('GOOGLE_SCRIPT_URL is not configured in environment variables');
      return NextResponse.json(
        { error: 'Google Script URL not configured. Please set GOOGLE_SCRIPT_URL in .env file' },
        { status: 500 }
      );
    }

    console.log('Submitting to Google Script:', GOOGLE_SCRIPT_URL);
    console.log('Form data being sent:', JSON.stringify(formData, null, 2));
    console.log('Stage value in formData:', formData.stage);

    // Forward the data to Google Apps Script
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      // If not JSON, read as text to see what we got
      const textResult = await response.text();
      console.error('Google Script returned non-JSON response:', textResult.substring(0, 500));
      return NextResponse.json(
        { error: 'Invalid response from Google Script. Make sure your Google Apps Script is deployed correctly and has "Execute as: Me" and "Who has access: Anyone" settings.' },
        { status: 500 }
      );
    }

    if (response.ok) {
      // Pass through the requestId and customerId from Google Script response
      return NextResponse.json({ 
        success: true, 
        data: result,
        requestId: result.requestId,
        customerId: result.customerId 
      });
    } else {
      console.error('Google Script error:', result);
      return NextResponse.json(
        { error: result.error || 'Failed to submit form' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error submitting form:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

