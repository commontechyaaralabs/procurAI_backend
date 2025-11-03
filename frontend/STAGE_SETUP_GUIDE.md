# Complete Stage Tracking Setup Guide

## Overview

This guide will help you set up dynamic stage tracking for your procurement intake system. The stage field will be automatically updated as items move through the procurement pipeline.

## Steps to Complete Setup

### Step 1: Update Your Google Apps Script

1. Open your Google Apps Script project
2. Delete all existing code
3. Copy ALL code from `frontend/GOOGLE_SCRIPT_CODE.gs`
4. Paste it into your Google Apps Script editor
5. **Deploy this as a NEW version**:
   - Click **Deploy** → **Manage deployments**
   - Click the edit icon (pencil) next to your deployment
   - Click **Deploy** with these settings:
     - **Execute as**: "Me"
     - **Who has access**: "Anyone"
   - Copy the **NEW Web App URL**

### Step 2: Update Environment Variables

Update your `.env` file in the `frontend` directory with the new URLs:

```bash
# Main form submission URL
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_NEW_ID/exec

# Optional: Separate URLs for different operations (recommended for production)
GOOGLE_SCRIPT_UPDATE_URL=https://script.google.com/macros/s/YOUR_NEW_ID/exec
GOOGLE_SHEETS_READ_URL=https://script.google.com/macros/s/YOUR_NEW_ID/exec
```

### Step 3: Restart Your Development Server

After updating the `.env` file:
```bash
# Stop your current server (Ctrl+C)
# Then start it again
npm run dev
```

### Step 4: Test the Integration

1. **Submit a Form**:
   - Go to `/intake`
   - Fill out and submit the form
   - Verify it appears in your Google Sheet with "Intake" stage

2. **View Tracking Dashboard**:
   - Go to `/intake/track`
   - Click "Refresh" to load submissions
   - You should see your submitted form

3. **Update Stage**:
   - Click "Next →" on a submission
   - Verify the stage updates in the Google Sheet

## How Stage Updates Work

### Automatic Stage Tracking

1. **Form Submission**: Stage automatically set to "Intake" when form is submitted
2. **Stage Updates**: Use "Next →" or "← Previous" buttons to move through stages
3. **Real-time Sync**: Changes are immediately saved to Google Sheets

### Available Stages

1. Intake - Initial submission
2. Internal Approval - Manager/department approval
3. Sourcing - Finding vendors
4. Negotiations - Price and terms negotiation
5. Finalisation - Finalizing the deal
6. Approval - Final approval from stakeholders
7. PO Creation - Creating the purchase order
8. Track the Delivery - Monitoring delivery status
9. Completion - Delivery completed
10. Payment Done - Invoice paid

## Google Apps Script Functions

The script includes three main functions:

### 1. `doPost(e)` - Handle Form Submissions
- Receives intake form data
- Appends to Google Sheet
- Sets initial stage to "Intake"
- Returns success/error response

### 2. `doPostUpdateStage(e)` - Update Stage
- Finds row by timestamp ID
- Updates the Stage column (Column O)
- Returns success/error response

### 3. `doGet(e)` - Fetch All Submissions
- Retrieves all submission data
- Returns JSON array of submissions
- Used by the tracking dashboard

## Troubleshooting

### Issue: Stage not updating in Google Sheets

**Solution**:
1. Verify you deployed a NEW version of the script
2. Check that the Stage column (Column O) exists in your sheet
3. Verify the deployment URL in your `.env` file
4. Restart your dev server after changing `.env`

### Issue: "Row not found" error

**Solution**:
- This happens when timestamps don't match
- Check that your Google Sheet timestamps are in Column A
- The matching tolerance is 1 second

### Issue: Submissions not appearing in dashboard

**Solution**:
1. Verify `GOOGLE_SHEETS_READ_URL` is set in `.env`
2. Check that `doGet` function is deployed
3. Click "Refresh" button on the dashboard
4. Check browser console for errors

## Column Structure in Google Sheets

Your Google Sheet should have these columns in order:

| Column | Name | Description |
|--------|------|-------------|
| A | Timestamp | Auto-generated submission time |
| B | Name | Requester name |
| C | Email | Requester email |
| D | Department | Department |
| E | Cost Center | Cost center |
| F | Class | Purchase/Renewal/Cancellation |
| G | Type | Hardware/Software |
| H | Item Name | Item name |
| I | Description | Description |
| J | Quantity | Quantity |
| K | Preferred Vendor | Vendor |
| L | Estimated Cost | Cost |
| M | Priority | Priority level |
| N | Required Date | Required date |
| **O** | **Stage** | **Current stage (dynamically updated)** |

## Production Considerations

For production environments:

1. **Add Authentication**: Protect API routes with authentication
2. **Rate Limiting**: Add rate limiting to prevent abuse
3. **Logging**: Add comprehensive logging for audit trails
4. **Error Monitoring**: Set up error monitoring (e.g., Sentry)
5. **Backup**: Regularly backup your Google Sheet data
6. **Permissions**: Restrict Google Sheet access appropriately

## Support

If you encounter issues:
1. Check browser console for client errors
2. Check terminal for server errors
3. Verify all URLs in `.env` file
4. Ensure Google Apps Script is deployed correctly
5. Check Google Sheets permissions

## Next Steps

After successful setup:
- Customize stages if needed
- Add email notifications on stage changes
- Implement filters and search
- Add export functionality
- Create custom reports






