# How to Deploy the Fixed Script

## ⚠️ IMPORTANT: You Need to Deploy the NEW Code

Your Google Sheet is missing the "Stage" column because you're using an OLD version of the script that doesn't have it!

## Step-by-Step Fix

### 1. Add Stage Column to Your Existing Sheet

Your current sheet has 14 columns, but needs 15. You need to add the Stage column manually first:

1. Open your Google Sheet
2. Click on Column O (the column after "Required Date")
3. Right-click → Insert 1 column right
4. Type "Stage" in cell O1
5. For existing rows, type "Intake" in the Stage column (Column O)

### 2. Update Your Google Apps Script

1. Go to https://script.google.com
2. Open your project
3. Click on "Editor" if you're in a different view
4. **DELETE ALL existing code** in the editor
5. Copy **ALL** code from `frontend/GOOGLE_SCRIPT_CODE.gs`
6. Paste it into the editor

### 3. Deploy as NEW Version

1. Click **Deploy** → **Manage deployments**
2. You'll see your current deployment
3. Click the pencil/edit icon ✏️
4. Under "Version", click "New version"
5. Make sure settings are:
   - **Execute as**: "Me"
   - **Who has access**: "Anyone" 
6. Click **Deploy**
7. **IMPORTANT**: Copy the NEW Web App URL

### 4. Update Your .env File

1. Open `frontend/.env` file
2. Replace the old URL with the NEW URL:
   ```
   GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/YOUR_NEW_ID/exec
   ```

### 5. Restart Your Server

```bash
# Stop your server
Ctrl+C

# Start it again
npm run dev
```

### 6. Test It

1. Submit a new form at `/intake`
2. Check your Google Sheet
3. You should now see "Intake" in the Stage column!

## Why This Happened

You deployed the old version of the script before the Stage column was added. The fix includes:
- Check for proper headers with 15 columns
- Stage column is column 15 (O)
- Default stage value is "Intake"

## Verification

After deploying, your Google Sheet should look like this:

| Timestamp | Name | Email | Department | Cost Center | Class | Type | Item Name | Description | Quantity | Preferred Vendor | Estimated Cost | Priority | Required Date | **Stage** |
|-----------|------|-------|------------|-------------|-------|------|-----------|-------------|----------|------------------|----------------|----------|---------------|----------|
| 01/11/2025 15:22:44 | Ranjith | ranjith.bk@yaaralabs.ai | sad | Engineering | purchase | hardware | asdf | sdfs | 55 | asdf | 546 | high | 2025-11-13 | **Intake** |

The Stage column should be populated!






