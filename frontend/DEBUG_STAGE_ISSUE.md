# Debug Guide: Stage Field Not Appearing in Google Sheet

## Quick Fix Steps

### 1. **Deploy the Updated Google Script** (CRITICAL)

The code in `GOOGLE_SCRIPT_CODE.gs` has been updated with debugging and fixes. You MUST deploy it:

1. Go to https://script.google.com
2. Open your project
3. **DELETE ALL existing code** in the editor
4. Copy **ALL** code from `frontend/GOOGLE_SCRIPT_CODE.gs`
5. Paste into Google Apps Script editor
6. Click **Deploy** → **Manage deployments**
7. Click the **pencil/edit icon** ✏️
8. Under "Version", select **"New version"**
9. Settings:
   - **Execute as**: "Me"
   - **Who has access**: "Anyone"
10. Click **Deploy**
11. **Copy the NEW Web App URL**

### 2. Update .env File

Update `frontend/.env`:
```
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_NEW_ID/exec
```

### 3. Restart Your Server

```bash
# Stop server (Ctrl+C)
npm run dev
```

### 4. Test and Check Logs

**A. Check Browser Console:**
- Open browser DevTools (F12)
- Submit the intake form
- Check Console tab - you should see:
  - "Form data being sent: ..."
  - "Stage value in formData: Intake"

**B. Check Google Apps Script Logs:**
1. Go to https://script.google.com
2. Open your project
3. Click **Executions** (left sidebar)
4. Look for recent executions
5. Click on one to see logs
6. You should see:
   - "Received data: ..."
   - "Stage value received: Intake"
   - "Stage value to be saved: Intake"
   - "Stage saved in sheet: Intake"

**C. Check Google Sheet:**
1. Open your Google Sheet
2. Verify Column O (15th column) has "Stage" header
3. Check that new rows have "Intake" in the Stage column

## Common Issues

### Issue: Stage column doesn't exist in sheet
**Solution:** The script will auto-create it on next submission. Make sure you deployed the NEW version.

### Issue: Stage shows empty/null
**Solution:** Check Google Apps Script logs to see if stage value was received and saved.

### Issue: Only 14 columns in sheet
**Solution:** 
1. The script should auto-add the 15th column
2. If it doesn't, manually add "Stage" in cell O1
3. Then submit a new form - it should populate

### Issue: Old rows don't have Stage
**Solution:** The script fills existing rows with "Intake" when Stage column is first added. Or manually:
- Select column O (all rows with data)
- Type "Intake" and press Ctrl+Enter to fill all

## Manual Fix (If Script Fails)

If the script still doesn't work:

1. **Manually add Stage column:**
   - Open Google Sheet
   - Click on Column O (after "Required Date")
   - Right-click → Insert 1 column right (if needed)
   - Type "Stage" in cell O1

2. **Fill existing rows:**
   - Select cells O2:O(last row)
   - Type "Intake"
   - Press Ctrl+Enter

3. **Test new submission** - Stage should appear

## Verification Checklist

- [ ] Updated Google Apps Script code is deployed
- [ ] New version deployed (not just saved)
- [ ] .env file updated with new Web App URL
- [ ] Server restarted
- [ ] Browser console shows stage value being sent
- [ ] Google Apps Script logs show stage value received
- [ ] Google Sheet has 15 columns
- [ ] Column O header is "Stage"
- [ ] New submissions show "Intake" in Stage column

