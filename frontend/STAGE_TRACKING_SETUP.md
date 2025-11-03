# Stage Tracking Setup

## Overview

The procurement intake system now includes a complete stage tracking feature that allows you to monitor and update the status of each procurement request as it moves through the pipeline.

## Stages

The procurement process follows these stages in order:

1. **Intake** - Initial submission
2. **Internal Approval** - Manager/department approval
3. **Sourcing** - Finding vendors (new or existing)
4. **Negotiations** - Price and terms negotiation
5. **Finalisation** - Finalizing the deal
6. **Approval** - Final approval from stakeholders
7. **PO Creation** - Creating the purchase order
8. **Track the Delivery** - Monitoring delivery status
9. **Completion** - Delivery completed
10. **Payment Done** - Invoice paid

## Files Created

1. **`frontend/app/intake/page.tsx`** - Updated with `stage` field (default: "Intake")
2. **`frontend/app/intake/track/page.tsx`** - New tracking dashboard to view and update stages

## How It Works

### 1. Form Submission

When a user submits the intake form, it automatically sets the stage to "Intake" and includes this in the submission to Google Sheets.

### 2. Tracking Dashboard

Access the tracking dashboard at `/intake/track` to:
- View all submissions
- See current stage for each item
- Move items to next/previous stages
- See visual progress indicators
- Filter by stage, priority, department, etc.

### 3. Automatic Stage Management

Stages progress automatically through the workflow:
- Each stage has a "Next" button to advance
- Each stage (except Intake) has a "Previous" button to go back
- Progress bar shows completion percentage
- Stage changes are saved to Google Sheets

## Google Sheets Integration

### Update Your Google Apps Script

Add the **Stage** column to your Google Apps Script. Update your script to include:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Check if headers exist, if not add them
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp',
        'Name',
        'Email',
        'Department',
        'Cost Center',
        'Class',
        'Type',
        'Item Name',
        'Description',
        'Quantity',
        'Preferred Vendor',
        'Estimated Cost',
        'Priority',
        'Required Date',
        'Stage'  // Added Stage column
      ]);
    }
    
    // Add timestamp
    var timestamp = new Date();
    
    // Append the form data (handle missing values)
    sheet.appendRow([
      timestamp,
      data.requesterName || '',
      data.requesterEmail || '',
      data.department || '',
      data.costCenter || '',
      data.class || '',
      data.type || '',
      data.itemName || '',
      data.description || '',
      data.quantity || '',
      data.preferredVendor || '',
      data.estimatedCost || '',
      data.priority || '',
      data.requiredDate || '',
      data.stage || 'Intake'  // Default to Intake
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Data saved successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Add Update Stage Function

Create a new Apps Script function to update stages:

```javascript
function doPostUpdateStage(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Find the row with matching timestamp or ID
    // For now, we'll search by timestamp
    var lastRow = sheet.getLastRow();
    var timestampColumn = 1; // Column A
    var stageColumn = 15; // Column O
    
    for (var i = 2; i <= lastRow; i++) {
      if (sheet.getRange(i, timestampColumn).getValue() == data.id) {
        // Update the stage
        sheet.getRange(i, stageColumn).setValue(data.stage);
        break;
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Stage updated successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

## API Routes Needed

### Create Update Stage API Route

Create `frontend/app/api/update-stage/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { id, stage } = await request.json();

    const GOOGLE_SCRIPT_UPDATE_URL = process.env.GOOGLE_SCRIPT_UPDATE_URL || '';

    if (!GOOGLE_SCRIPT_UPDATE_URL) {
      return NextResponse.json(
        { error: 'Update URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(GOOGLE_SCRIPT_UPDATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, stage }),
    });

    const result = await response.json();

    if (response.ok) {
      return NextResponse.json({ success: true, data: result });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to update stage' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error updating stage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Create Fetch Submissions API Route

Create `frontend/app/api/fetch-submissions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const GOOGLE_SHEETS_READ_URL = process.env.GOOGLE_SHEETS_READ_URL || '';

    if (!GOOGLE_SHEETS_READ_URL) {
      return NextResponse.json(
        { error: 'Read URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(GOOGLE_SHEETS_READ_URL, {
      method: 'GET',
    });

    const result = await response.json();

    if (response.ok) {
      return NextResponse.json({ success: true, data: result });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch submissions' },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Environment Variables

Add to your `.env` file:

```
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec
GOOGLE_SCRIPT_UPDATE_URL=https://script.google.com/macros/s/YOUR_UPDATE_ID/exec
GOOGLE_SHEETS_READ_URL=https://script.google.com/macros/s/YOUR_READ_ID/exec
```

## Usage

1. **Submit Intake Form**: User fills form at `/intake` → automatically sets stage to "Intake"
2. **View Dashboard**: Navigate to `/intake/track` to see all submissions
3. **Update Stage**: Click "Next →" to advance or "← Previous" to go back
4. **Track Progress**: Visual progress bar shows completion status

## Features

- ✅ Automatic stage initialization on form submission
- ✅ Visual progress indicators
- ✅ Next/Previous stage navigation
- ✅ Stage validation (can't skip stages)
- ✅ Color-coded priority badges
- ✅ Responsive design
- ✅ Google Sheets integration

## Future Enhancements

- Add user authentication for stage updates
- Email notifications on stage changes
- Filters and search functionality
- Export to PDF/Excel
- Custom workflows per department
- Comments/notes per stage
- Document attachments






