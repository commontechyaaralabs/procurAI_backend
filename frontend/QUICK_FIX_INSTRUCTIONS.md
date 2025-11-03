# Quick Fix Instructions

## Problem
Your Google Sheet was showing duplicate headers and timestamps filling all columns.

## Solution
The issue was that the script was checking `getLastRow() === 0` which doesn't work if there's any data. Now it checks if row 1 contains headers.

## Steps to Fix

### 1. Clean Your Google Sheet
Before copying the new code, clean your existing sheet:
- Delete all the duplicate header rows
- Delete all the bad data rows
- Keep ONLY one clean header row OR delete everything and start fresh

### 2. Copy the Fixed Code
1. Open your Google Apps Script project
2. **Delete ALL existing code**
3. Copy **EVERYTHING** from `frontend/GOOGLE_SCRIPT_CODE.gs`
4. Paste it into your script editor

### 3. Deploy New Version
1. Click **Deploy** → **Manage deployments**
2. Click the edit/pencil icon ✏️ next to your deployment
3. Change version to "New version"
4. Make sure settings are:
   - **Execute as**: "Me"
   - **Who has access**: "Anyone"
5. Click **Deploy**
6. Copy the NEW Web App URL

### 4. Update .env File
Update your `frontend/.env` file with the new URL:
```bash
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_NEW_ID/exec
```

### 5. Restart Server
```bash
# Stop your server (Ctrl+C)
npm run dev
```

### 6. Test
1. Submit a form at `/intake`
2. Check your Google Sheet - should have ONE header row and proper data

## What Changed

**OLD CODE (buggy):**
```javascript
// Check if headers exist, if not add them
if (sheet.getLastRow() === 0) {
  sheet.appendRow([...headers...]);
}
```

**NEW CODE (fixed):**
```javascript
// Check if headers exist in row 1, if not add them
var firstRow = sheet.getRange(1, 1, 1, 15).getValues()[0];
var hasHeaders = firstRow && firstRow[0] === 'Timestamp';

if (!hasHeaders) {
  sheet.getRange(1, 1, 1, 15).setValues([[...headers...]]);
}
```

The key difference: Now it checks if row 1 specifically has "Timestamp" as the first cell, rather than checking if the sheet is empty.

## If You Still Have Issues

1. **Delete ALL data** in your Google Sheet
2. Copy the entire fixed script again
3. Deploy as a new version
4. Test with one form submission
5. Check that only ONE header row appears
6. Check that data appears in the correct columns

Your Google Sheet should now look like this:

| Timestamp | Name | Email | Department | Cost Center | Class | Type | Item Name | Description | Quantity | Preferred Vendor | Estimated Cost | Priority | Required Date | Stage |
|-----------|------|-------|------------|-------------|-------|------|-----------|-------------|----------|------------------|----------------|----------|---------------|-------|
| 01/11/2025 15:30:00 | John Doe | john@example.com | Engineering | IT | purchase | hardware | Laptop | Need for new employee | 1 | Dell | 1500 | high | 2025-02-01 | Intake |

Only ONE header row, and data in proper columns!






