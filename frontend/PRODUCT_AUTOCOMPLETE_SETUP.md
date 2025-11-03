# Product Autocomplete Setup Guide

## Overview
The Item Name field now has autocomplete functionality that fetches product names from the Google Sheet `bosch_automotive_india_brakes_catalogue`.

## Setup Instructions

### 1. Google Sheet Configuration

Your Google Sheet should have:
- **Sheet Name**: `bosch_automotive_india_brakes_catalogue`
- **Tab Name**: `product`
- **Column Name**: `product_name` (case-insensitive)

### 2. Google Apps Script Configuration

**Option A: Catalogue in Same Spreadsheet (Recommended)**
- The script is already configured to use `SpreadsheetApp.getActiveSpreadsheet()`
- Just make sure your intake form spreadsheet also has the `product` tab

**Option B: Catalogue in Different Spreadsheet**
1. Open `frontend/GOOGLE_SCRIPT_CODE.gs`
2. Find the `getProductNames` function (around line 298)
3. Uncomment Option 1 and set your spreadsheet ID:
   ```javascript
   var catalogueSpreadsheet = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID_HERE');
   ```
4. Comment out Option 2 (the `getActiveSpreadsheet()` line)

**Option C: Open by Name**
1. In `GOOGLE_SCRIPT_CODE.gs`, use Option 3:
   ```javascript
   var catalogueSpreadsheet = SpreadsheetApp.open('bosch_automotive_india_brakes_catalogue');
   ```

### 3. Deploy Updated Google Script

1. Copy the updated code from `frontend/GOOGLE_SCRIPT_CODE.gs`
2. Paste into Google Apps Script editor
3. Deploy as **NEW version**
4. Update your `.env` file with the new deployment URL

### 4. Test the Setup

1. Open the intake form at `/intake`
2. Click on the "Item Name" field
3. Type at least 1 letter (e.g., "B")
4. You should see a dropdown with matching products
5. Click a product to select it

## Features

- ✅ **Real-time search**: Fetches products as you type
- ✅ **Debounced**: Waits 300ms after typing stops to reduce API calls
- ✅ **Unique values**: Only shows unique product names (no duplicates)
- ✅ **Case-insensitive**: Searches regardless of case
- ✅ **Starts with matching**: Shows products starting with the typed letters
- ✅ **Loading indicator**: Shows spinner while fetching
- ✅ **Auto-close**: Dropdown closes when clicking outside

## Troubleshooting

### Products not appearing?
1. Check Google Apps Script logs (Executions tab)
2. Verify the sheet name, tab name, and column name match exactly
3. Check browser console for API errors
4. Verify `.env` has correct `GOOGLE_SCRIPT_URL`

### "Product sheet not found" error?
- Make sure the tab is named exactly `product` (case-sensitive)
- Verify the spreadsheet ID is correct (if using Option A)

### "product_name column not found" error?
- Make sure the column header is exactly `product_name` (case-insensitive)
- Check the first row of the `product` tab has this header

### Dropdown doesn't show?
- Check browser console for JavaScript errors
- Verify `/api/products` endpoint is working (check Network tab)
- Make sure products exist in the sheet

## Data Format Example

Your `product` tab should look like this:

| product_name |
|-------------|
| Brake Pad A |
| Brake Pad B |
| Brake Disc C |
| ... |

The script will automatically:
- Find the `product_name` column
- Get all unique product names
- Filter by what the user types
- Return matching products starting with the search term

