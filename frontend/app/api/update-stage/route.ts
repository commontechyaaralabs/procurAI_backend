import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { id, requestId, stage, sourcingType, vendor, notes } = await request.json();

    const GOOGLE_SCRIPT_UPDATE_URL = process.env.GOOGLE_SCRIPT_UPDATE_URL || process.env.GOOGLE_SCRIPT_URL || '';

    if (!GOOGLE_SCRIPT_UPDATE_URL) {
      console.error('GOOGLE_SCRIPT_UPDATE_URL is not configured');
      return NextResponse.json(
        { error: 'Update URL not configured. Please set GOOGLE_SCRIPT_UPDATE_URL in .env file' },
        { status: 500 }
      );
    }

    // Use requestId if provided, otherwise use id
    const targetId = requestId || id;
    console.log('Updating stage:', { requestId: targetId, stage, sourcingType, vendor, notes });

    const response = await fetch(GOOGLE_SCRIPT_UPDATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        id: targetId, 
        requestId: targetId,
        stage,
        sourcingType,
        vendor,
        notes
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
        { error: 'Invalid response from Google Script' },
        { status: 500 }
      );
    }

    if (response.ok) {
      return NextResponse.json({ success: true, data: result });
    } else {
      console.error('Update error:', result);
      return NextResponse.json(
        { error: result.error || 'Failed to update stage' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error updating stage:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

