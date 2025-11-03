// Google Apps Script - Complete Implementation for Stage Tracking
// Copy this entire file into your Google Apps Script editor
//
// IMPORTANT: This script automatically creates the Stage column if it doesn't exist
// and ensures all submissions include the stage value.

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Check for special actions
    if (data.action === 'sendQuoteRequests') {
      return handleSendQuoteRequests(data);
    }
    if (data.action === 'submitQuotation') {
      // Called via POST from API route - wrap result in ContentService response
      var result = handleSubmitQuotation(data);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    if (data.action === 'updateStage') {
      return doPostUpdateStage(e);
    }
    if (data.action === 'updateQuotationNegotiation') {
      return handleUpdateQuotationNegotiation(data);
    }
    if (data.action === 'updateVendorSelection') {
      return handleUpdateVendorSelection(data);
    }
    if (data.action === 'updateAgreementAcceptance') {
      return handleUpdateAgreementAcceptance(data);
    }
    if (data.action === 'updateVendorApproval') {
      return handleUpdateVendorApproval(data);
    }
    if (data.action === 'sendPurchaseOrder') {
      return handleSendPurchaseOrder(data);
    }
    
    // Log received data for debugging
    Logger.log('Received data: ' + JSON.stringify(data));
    Logger.log('Stage value received: ' + (data.stage || 'NOT PROVIDED'));
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Ensure we have exactly 15 columns with proper headers
    var lastColumn = sheet.getLastColumn();
    
    // Get first row headers (only read what exists to avoid errors)
    var firstRow = [];
    if (lastColumn > 0) {
      firstRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    }
    
    var hasHeaders = firstRow.length > 0 && firstRow[0] === 'Timestamp';
    
    // Check if Stage column exists at position 17 (will be updated after checking Customer/Request ID)
    var hasStageColumn = false;
    
    // Define all headers (added Customer ID and Request ID)
    var headers = [
      'Timestamp',
      'Customer ID',
      'Request ID',
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
      'Estimated Budget',
      'Priority',
      'Required Date',
      'Stage'
    ];
    
    // Check if Customer ID and Request ID columns exist (columns 2 and 3)
    var hasCustomerIdColumn = false;
    var hasRequestIdColumn = false;
    if (lastColumn >= 2) {
      var customerIdHeader = sheet.getRange(1, 2).getValue();
      hasCustomerIdColumn = (customerIdHeader === 'Customer ID');
    }
    if (lastColumn >= 3) {
      var requestIdHeader = sheet.getRange(1, 3).getValue();
      hasRequestIdColumn = (requestIdHeader === 'Request ID');
    }
    
    if (!hasHeaders) {
      // No headers exist - create all 17 columns
      sheet.getRange(1, 1, 1, 17).setValues([headers]);
    } else {
      // Add missing columns if needed
      // Check current column structure
      var currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
      
      // If Customer ID column is missing, insert it after Timestamp (column 1)
      if (!hasCustomerIdColumn) {
        sheet.insertColumnAfter(1);
        sheet.getRange(1, 2).setValue('Customer ID');
        // Shift all existing data rows to the right if needed
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          // Move existing data to the right
          var dataRange = sheet.getRange(2, 2, lastRow - 1, lastColumn);
          var data = dataRange.getValues();
          sheet.getRange(2, 3, lastRow - 1, lastColumn).setValues(data);
        }
        lastColumn = sheet.getLastColumn();
      }
      
      // If Request ID column is missing, insert it after Customer ID (column 2)
      if (!hasRequestIdColumn) {
        sheet.insertColumnAfter(2);
        sheet.getRange(1, 3).setValue('Request ID');
        // Shift all existing data rows to the right if needed
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          // Move existing data to the right
          var dataRange = sheet.getRange(2, 3, lastRow - 1, lastColumn);
          var data = dataRange.getValues();
          sheet.getRange(2, 4, lastRow - 1, lastColumn).setValues(data);
        }
        lastColumn = sheet.getLastColumn();
      }
    }
    
    // Update Stage column check (now at column 17 instead of 15)
    if (lastColumn >= 17) {
      var stageHeader = sheet.getRange(1, 17).getValue();
      hasStageColumn = (stageHeader === 'Stage');
    }
    
    if (!hasStageColumn) {
      // Headers exist but Stage column is missing - add it
      if (lastColumn < 17) {
        // Sheet has fewer than 17 columns - add Stage column header
        sheet.getRange(1, 17).setValue('Stage');
      } else {
        // Sheet has 17+ columns but Stage header is missing or wrong - update it
        sheet.getRange(1, 17).setValue('Stage');
      }
      
      // Fill existing data rows with default stage 'Intake' if they exist
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Fill all existing rows with 'Intake' in the Stage column
        var stageRange = sheet.getRange(2, 17, lastRow - 1, 1);
        var stageValues = [];
        for (var i = 0; i < lastRow - 1; i++) {
          stageValues.push(['Intake']);
        }
        stageRange.setValues(stageValues);
      }
    }
    
    // Final verification: ensure all required columns exist before appending
    var finalColumnCheck = sheet.getLastColumn();
    if (finalColumnCheck < 17) {
      if (finalColumnCheck < 2) sheet.getRange(1, 2).setValue('Customer ID');
      if (finalColumnCheck < 3) sheet.getRange(1, 3).setValue('Request ID');
      if (finalColumnCheck < 17) sheet.getRange(1, 17).setValue('Stage');
    }
    
    // Generate Customer ID and Request ID
    function generateId(prefix, length) {
      var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      var id = prefix + '-';
      for (var i = 0; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return id;
    }
    
    var customerId = generateId('CUST', 8);
    var requestId = generateId('REQ', 8);
    
    // Add timestamp
    var timestamp = new Date();
    
    // Get the stage value from form data, default to 'Intake' if not provided
    var stageValue = data.stage || 'Intake';
    
    // Log stage value before appending
    Logger.log('Stage value to be saved: ' + stageValue);
    Logger.log('Customer ID: ' + customerId);
    Logger.log('Request ID: ' + requestId);
    Logger.log('Number of columns before append: ' + sheet.getLastColumn());
    
    // Verify Stage column exists one more time
    var finalCheck = sheet.getLastColumn();
    if (finalCheck < 17) {
      Logger.log('WARNING: Only ' + finalCheck + ' columns found, adding missing columns');
      if (finalCheck < 2) sheet.getRange(1, 2).setValue('Customer ID');
      if (finalCheck < 3) sheet.getRange(1, 3).setValue('Request ID');
      if (finalCheck < 17) sheet.getRange(1, 17).setValue('Stage');
    }
    
    // Build row data array (17 columns now)
    var rowData = [
      timestamp,
      customerId,
      requestId,
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
      stageValue  // Always include the stage value
    ];
    
    Logger.log('Row data length: ' + rowData.length);
    Logger.log('Row data to append: ' + JSON.stringify(rowData));
    
    // Ensure we're appending exactly 15 values matching the header structure
    sheet.appendRow(rowData);
    
    // Verify the row was added correctly
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var savedStage = sheet.getRange(lastRow, 17).getValue();
    var savedCustomerId = sheet.getRange(lastRow, 2).getValue();
    var savedRequestId = sheet.getRange(lastRow, 3).getValue();
    
    Logger.log('Row appended at: ' + lastRow);
    Logger.log('Total columns: ' + lastCol);
    Logger.log('Customer ID saved: ' + savedCustomerId);
    Logger.log('Request ID saved: ' + savedRequestId);
    Logger.log('Stage saved in sheet: ' + savedStage);
    
    // Send email notification to manager
    try {
      sendApprovalEmail(savedRequestId, data);
    } catch (emailError) {
      Logger.log('Error sending email: ' + emailError.toString());
      // Don't fail the request if email fails
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Data saved successfully',
      customerId: savedCustomerId,
      requestId: savedRequestId,
      stage: savedStage,
      row: lastRow,
      columns: lastCol
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to update the stage of an existing row
function doPostUpdateStage(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Ensure Stage column exists
    var lastColumn = sheet.getLastColumn();
    if (lastColumn < 17) {
      sheet.getRange(1, 17).setValue('Stage');
    } else {
      var header = sheet.getRange(1, 17).getValue();
      if (header !== 'Stage') {
        sheet.getRange(1, 17).setValue('Stage');
      }
    }
    
    // Find the row with matching Request ID
    var lastRow = sheet.getLastRow();
    var requestIdColumn = 3; // Column C (Request ID column)
    var stageColumn = 17; // Column Q (Stage column)
    
    // Search for the row with the matching Request ID
    var found = false;
    var searchRequestId = data.id || data.requestId;
    
    for (var i = 2; i <= lastRow; i++) {
      var rowRequestId = sheet.getRange(i, requestIdColumn).getValue();
      
      // Check if Request ID matches
      if (rowRequestId && rowRequestId.toString() === searchRequestId.toString()) {
        // Found the row, update the stage
        sheet.getRange(i, stageColumn).setValue(data.stage);
        
        found = true;
        break;
      }
    }
    
    if (!found) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Row not found with matching Request ID'
      })).setMimeType(ContentService.MimeType.JSON);
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

// Function to send approval email to manager
function sendApprovalEmail(requestId, requestData) {
  try {
    var managerEmail = 'usha.j@yaaralabs.ai';
    var fromEmail = 'ranjith.bk@yaaralabs.ai';
    
    // Get the script URL for approve/reject links
    var scriptUrl = ScriptApp.getService().getUrl();
    
    // Build dynamic subject
    var subject = 'Procurement Request Approval Required - ' + requestId + ' - ' + (requestData.itemName || 'New Request');
    
    // Build HTML email body with dynamic content
    var htmlBody = buildApprovalEmailHtml(requestId, requestData, scriptUrl);
    
    // Send email
    MailApp.sendEmail({
      to: managerEmail,
      subject: subject,
      htmlBody: htmlBody,
      from: fromEmail
    });
    
    Logger.log('Approval email sent to ' + managerEmail + ' for request ' + requestId);
  } catch (error) {
    Logger.log('Error in sendApprovalEmail: ' + error.toString());
    throw error;
  }
}

// Function to build HTML email body for approval request
function buildApprovalEmailHtml(requestId, data, scriptUrl) {
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
  html += 'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }';
  html += '.container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }';
  html += '.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }';
  html += '.content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }';
  html += '.details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }';
  html += '.details-table td { padding: 12px; border-bottom: 1px solid #eee; }';
  html += '.details-table td:first-child { font-weight: bold; color: #555; width: 40%; }';
  html += '.button-container { text-align: center; margin: 30px 0; }';
  html += '.btn { display: inline-block; padding: 14px 30px; margin: 0 10px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }';
  html += '.btn-approve { background-color: #28a745; color: white; }';
  html += '.btn-reject { background-color: #dc3545; color: white; }';
  html += '.btn:hover { opacity: 0.9; }';
  html += '.footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; }';
  html += '.priority { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }';
  html += '.priority-urgent { background-color: #f8d7da; color: #721c24; }';
  html += '.priority-high { background-color: #fff3cd; color: #856404; }';
  html += '.priority-medium { background-color: #d1ecf1; color: #0c5460; }';
  html += '.priority-low { background-color: #d4edda; color: #155724; }';
  html += '</style></head><body>';
  
  html += '<div class="container">';
  html += '<div class="header"><h1 style="margin: 0;">Procurement Request Approval Required</h1></div>';
  html += '<div class="content">';
  
  html += '<p>Dear Manager,</p>';
  html += '<p>A new procurement request requires your approval. Please review the details below and take action:</p>';
  
  html += '<table class="details-table">';
  html += '<tr><td>Request ID:</td><td><strong>' + requestId + '</strong></td></tr>';
  html += '<tr><td>Requester Name:</td><td>' + (data.requesterName || 'N/A') + '</td></tr>';
  html += '<tr><td>Requester Email:</td><td>' + (data.requesterEmail || 'N/A') + '</td></tr>';
  html += '<tr><td>Department:</td><td>' + (data.department || 'N/A') + '</td></tr>';
  html += '<tr><td>Cost Center:</td><td>' + (data.costCenter || 'N/A') + '</td></tr>';
  html += '<tr><td>Class:</td><td>' + (data.class || 'N/A') + '</td></tr>';
  html += '<tr><td>Type:</td><td>' + (data.type || 'N/A') + '</td></tr>';
  html += '<tr><td>Item Name:</td><td><strong>' + (data.itemName || 'N/A') + '</strong></td></tr>';
  html += '<tr><td>Description:</td><td>' + (data.description || 'N/A') + '</td></tr>';
  html += '<tr><td>Quantity:</td><td>' + (data.quantity || 'N/A') + '</td></tr>';
  html += '<tr><td>Preferred Vendor:</td><td>' + (data.preferredVendor || 'Not specified') + '</td></tr>';
  html += '<tr><td>Estimated Budget:</td><td><strong>$' + (parseFloat(data.estimatedCost || 0).toLocaleString()) + '</strong></td></tr>';
  
  var priorityClass = 'priority-low';
  if (data.priority === 'urgent') priorityClass = 'priority-urgent';
  else if (data.priority === 'high') priorityClass = 'priority-high';
  else if (data.priority === 'medium') priorityClass = 'priority-medium';
  
  html += '<tr><td>Priority:</td><td><span class="priority ' + priorityClass + '">' + (data.priority || 'N/A').toUpperCase() + '</span></td></tr>';
  html += '<tr><td>Required Date:</td><td>' + (data.requiredDate || 'N/A') + '</td></tr>';
  html += '</table>';
  
  html += '<div class="button-container">';
  var approveUrl = scriptUrl + '?action=approve&requestId=' + encodeURIComponent(requestId);
  var rejectUrl = scriptUrl + '?action=reject&requestId=' + encodeURIComponent(requestId);
  
  html += '<a href="' + approveUrl + '" class="btn btn-approve">✓ Approve Request</a>';
  html += '<a href="' + rejectUrl + '" class="btn btn-reject">✗ Reject Request</a>';
  html += '</div>';
  
  html += '<div class="footer">';
  html += '<p><strong>Note:</strong> Clicking "Approve" will move this request to "Internal Approval" stage. Clicking "Reject" will mark it as "Internal Rejected".</p>';
  html += '<p>This is an automated email from the Procurement System. Please do not reply to this email.</p>';
  html += '</div>';
  
  html += '</div></div></body></html>';
  
  return html;
}

// Function to handle approve/reject actions
function handleApprovalAction(action, requestId) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    var requestIdColumn = 3; // Column C (Request ID column)
    var stageColumn = 17; // Column Q (Stage column)
    
    // Find the row with matching Request ID
    var found = false;
    var foundRow = -1;
    
    for (var i = 2; i <= lastRow; i++) {
      var rowRequestId = sheet.getRange(i, requestIdColumn).getValue();
      
      if (rowRequestId && rowRequestId.toString() === requestId.toString()) {
        foundRow = i;
        found = true;
        break;
      }
    }
    
    if (!found) {
      return '<html><body><h2 style="color: red;">Error</h2><p>Request ID not found: ' + requestId + '</p></body></html>';
    }
    
    // Update stage based on action
    var newStage = '';
    if (action === 'approve') {
      newStage = 'Internal Approval';
    } else if (action === 'reject') {
      newStage = 'Internal Rejected';
    } else {
      return '<html><body><h2 style="color: red;">Error</h2><p>Invalid action: ' + action + '</p></body></html>';
    }
    
    // Update the stage in the sheet
    sheet.getRange(foundRow, stageColumn).setValue(newStage);
    
    // Get request details for confirmation email
    var requestData = {
      requesterName: sheet.getRange(foundRow, 4).getValue(),
      requesterEmail: sheet.getRange(foundRow, 5).getValue(),
      itemName: sheet.getRange(foundRow, 10).getValue(),
      department: sheet.getRange(foundRow, 6).getValue()
    };
    
    // Send confirmation email to requester
    try {
      sendConfirmationEmail(requestId, requestData, action, newStage);
    } catch (emailError) {
      Logger.log('Error sending confirmation email: ' + emailError.toString());
    }
    
    // Return success page
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
    html += 'body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; margin: 0; }';
    html += '.container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; margin: 0 auto; }';
    html += 'h2 { color: ' + (action === 'approve' ? '#28a745' : '#dc3545') + '; }';
    html += '.success-icon { font-size: 60px; margin: 20px 0; }';
    html += '</style></head><body>';
    html += '<div class="container">';
    html += '<div class="success-icon">' + (action === 'approve' ? '✓' : '✗') + '</div>';
    html += '<h2>Request ' + (action === 'approve' ? 'Approved' : 'Rejected') + ' Successfully</h2>';
    html += '<p>Request ID: <strong>' + requestId + '</strong></p>';
    html += '<p>The request has been ' + (action === 'approve' ? 'approved' : 'rejected') + ' and the stage has been updated to: <strong>' + newStage + '</strong></p>';
    html += '<p style="color: #666; margin-top: 30px;">You can close this window.</p>';
    html += '</div></body></html>';
    
    return HtmlService.createHtmlOutput(html);
    
  } catch (error) {
    Logger.log('Error in handleApprovalAction: ' + error.toString());
    return '<html><body><h2 style="color: red;">Error</h2><p>' + error.toString() + '</p></body></html>';
  }
}

// Function to send confirmation email to requester
function sendConfirmationEmail(requestId, requestData, action, newStage) {
  try {
    if (!requestData.requesterEmail) {
      Logger.log('No requester email found, skipping confirmation email');
      return;
    }
    
    var toEmail = requestData.requesterEmail;
    var fromEmail = 'ranjith.bk@yaaralabs.ai';
    
    var subject = 'Procurement Request Update - ' + requestId + ' - ' + (action === 'approve' ? 'Approved' : 'Rejected');
    
    var htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
    htmlBody += 'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }';
    htmlBody += '.container { max-width: 600px; margin: 0 auto; padding: 20px; }';
    htmlBody += '.header { background: ' + (action === 'approve' ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)') + '; color: white; padding: 20px; border-radius: 8px 8px 0 0; }';
    htmlBody += '.content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }';
    htmlBody += '</style></head><body>';
    htmlBody += '<div class="container"><div class="header"><h1 style="margin: 0;">Request ' + (action === 'approve' ? 'Approved' : 'Rejected') + '</h1></div>';
    htmlBody += '<div class="content">';
    htmlBody += '<p>Dear ' + (requestData.requesterName || 'Requester') + ',</p>';
    htmlBody += '<p>Your procurement request has been <strong>' + (action === 'approve' ? 'approved' : 'rejected') + '</strong> by the manager.</p>';
    htmlBody += '<p><strong>Request ID:</strong> ' + requestId + '</p>';
    htmlBody += '<p><strong>Item Name:</strong> ' + (requestData.itemName || 'N/A') + '</p>';
    htmlBody += '<p><strong>Current Stage:</strong> ' + newStage + '</p>';
    if (action === 'reject') {
      htmlBody += '<p style="color: #dc3545;"><strong>Note:</strong> Your request has been rejected by the internal team. The order cannot proceed at this time.</p>';
    }
    htmlBody += '<p style="margin-top: 30px;">You can track your request using the Request ID.</p>';
    htmlBody += '</div></div></body></html>';
    
    MailApp.sendEmail({
      to: toEmail,
      subject: subject,
      htmlBody: htmlBody,
      from: fromEmail
    });
    
    Logger.log('Confirmation email sent to ' + toEmail);
  } catch (error) {
    Logger.log('Error sending confirmation email: ' + error.toString());
  }
}

// Function to get all submissions (for the tracking dashboard)
function doGet(e) {
  try {
    // Check if this is an approve/reject action
    var action = e.parameter.action;
    if (action === 'approve' || action === 'reject') {
      var requestId = e.parameter.requestId;
      if (!requestId) {
        return HtmlService.createHtmlOutput('<html><body><h2 style="color: red;">Error</h2><p>Request ID is required</p></body></html>');
      }
      return handleApprovalAction(action, requestId);
    }
    
    // Check if this is a quotation form request
    if (action === 'quotationForm') {
      var requestId = e.parameter.requestId;
      var vendor = e.parameter.vendor;
      if (!requestId || !vendor) {
        return HtmlService.createHtmlOutput('<html><body><h2 style="color: red;">Error</h2><p>Request ID and Vendor are required</p></body></html>');
      }
      return showQuotationForm(requestId, vendor);
    }
    
    // Check if this is a product search request
    if (action === 'products') {
      return doGetProducts(e);
    }
    
    // Check if this is a vendor fetch request
    if (action === 'vendors') {
      return doGetVendors(e);
    }
    
    // Check if this is a quotations fetch request
    if (action === 'quotations') {
      return doGetQuotations(e);
    }
    
    // Check if this is a vendor history fetch request
    if (action === 'vendorHistory') {
      return doGetVendorHistory(e);
    }
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      // No data rows, only headers
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: []
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get all data rows (skip header row) - now 17 columns
    var dataRange = sheet.getRange(2, 1, lastRow - 1, 17);
    var values = dataRange.getValues();
    
    // Convert to array of objects
    var submissions = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      submissions.push({
        id: row[2], // Request ID as ID (for tracking)
        timestamp: row[0],
        customerId: row[1],
        requestId: row[2],
        requesterName: row[3],
        requesterEmail: row[4],
        department: row[5],
        costCenter: row[6],
        class: row[7],
        type: row[8],
        itemName: row[9],
        description: row[10],
        quantity: row[11],
        preferredVendor: row[12],
        estimatedCost: row[13],
        priority: row[14],
        requiredDate: row[15],
        stage: row[16]
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: submissions
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Router function to handle all requests
function doPostRouter(e) {
  var action = e.parameter.action;
  
  if (action === 'updateStage') {
    return doPostUpdateStage(e);
  } else {
    return doPost(e);
  }
}

// Function to get product names from catalogue sheet
function getProductNames(searchTerm) {
  try {
    // Option 1: If catalogue is in a different spreadsheet, uncomment and set the ID:
    // var catalogueSpreadsheet = SpreadsheetApp.openById('YOUR_CATALOGUE_SPREADSHEET_ID');
    
    // Option 2: If catalogue is in the same spreadsheet (recommended for easier setup):
    var catalogueSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Option 3: Open by name (if you know the exact name):
    // var catalogueSpreadsheet = SpreadsheetApp.open('bosch_automotive_india_brakes_catalogue');
    
    var productSheet = catalogueSpreadsheet.getSheetByName('product');
    
    if (!productSheet) {
      Logger.log('Product sheet not found');
      return [];
    }
    
    // Get all data from product sheet
    var lastRow = productSheet.getLastRow();
    if (lastRow <= 1) {
      return []; // No data (only headers)
    }
    
    // Find the column index for 'product_name'
    var headers = productSheet.getRange(1, 1, 1, productSheet.getLastColumn()).getValues()[0];
    var productNameColIndex = -1;
    
    for (var i = 0; i < headers.length; i++) {
      if (headers[i].toString().toLowerCase() === 'product_name') {
        productNameColIndex = i + 1; // Convert to 1-based index
        break;
      }
    }
    
    if (productNameColIndex === -1) {
      Logger.log('product_name column not found');
      return [];
    }
    
    // Get all product names from the column
    var productNames = productSheet.getRange(2, productNameColIndex, lastRow - 1, 1).getValues();
    
    // Flatten array and filter unique values
    var uniqueProducts = [];
    var seen = {};
    
    for (var j = 0; j < productNames.length; j++) {
      var productName = productNames[j][0];
      if (productName && typeof productName === 'string' && productName.trim() !== '') {
        var trimmedName = productName.trim();
        
        // Filter by search term if provided
        if (!searchTerm || trimmedName.toLowerCase().startsWith(searchTerm.toLowerCase())) {
          // Only add if unique
          if (!seen[trimmedName.toLowerCase()]) {
            seen[trimmedName.toLowerCase()] = true;
            uniqueProducts.push(trimmedName);
          }
        }
      }
    }
    
    // Sort alphabetically
    uniqueProducts.sort();
    
    return uniqueProducts;
    
  } catch (error) {
    Logger.log('Error getting product names: ' + error.toString());
    return [];
  }
}

// Function to handle GET requests for product search
function doGetProducts(e) {
  try {
    var searchTerm = e.parameter.search || '';
    var products = getProductNames(searchTerm);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      products: products
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to get vendors from vendor sheet based on Item Name
function getVendors(itemName) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var vendorSheet = spreadsheet.getSheetByName('vendor');
    
    if (!vendorSheet) {
      Logger.log('Vendor sheet not found');
      return [];
    }
    
    var lastRow = vendorSheet.getLastRow();
    if (lastRow <= 1) {
      return []; // No data (only headers)
    }
    
    // Find column indices
    var headers = vendorSheet.getRange(1, 1, 1, vendorSheet.getLastColumn()).getValues()[0];
    var productNameColIndex = -1;
    var vendorNameColIndex = -1;
    var tierColIndex = -1;
    
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i].toString().toLowerCase();
      // Look for product_name column in vendor sheet
      if (header === 'product_name' || header === 'product name') {
        productNameColIndex = i + 1;
      }
      if (header === 'vendor_name' || header === 'vendor name' || header === 'vendor') {
        vendorNameColIndex = i + 1;
      }
      if (header === 'tier') {
        tierColIndex = i + 1;
      }
    }
    
    if (productNameColIndex === -1 || vendorNameColIndex === -1) {
      Logger.log('Required columns not found in vendor sheet. Looking for: product_name and vendor_name');
      Logger.log('Available headers: ' + headers.join(', '));
      return [];
    }
    
    // Get all data rows
    var dataRange = vendorSheet.getRange(2, 1, lastRow - 1, vendorSheet.getLastColumn());
    var values = dataRange.getValues();
    
    // Filter vendors by item name
    var vendors = [];
    var seen = {};
    
    for (var j = 0; j < values.length; j++) {
      var rowProductName = values[j][productNameColIndex - 1];
      var vendorName = values[j][vendorNameColIndex - 1];
      var tierValue = tierColIndex > 0 ? (values[j][tierColIndex - 1] || '').toString().trim() : '';
      
      // Match product_name from vendor sheet with Item Name from request
      if (rowProductName && vendorName && 
          rowProductName.toString().trim().toLowerCase() === itemName.trim().toLowerCase()) {
        var vendorKey = vendorName.toString().trim().toLowerCase();
        
        // Only add unique vendors
        if (!seen[vendorKey]) {
          seen[vendorKey] = true;
          vendors.push({
            vendor_name: vendorName.toString().trim(),
            name: vendorName.toString().trim(),
            itemName: rowProductName.toString().trim(),
            product_name: rowProductName.toString().trim(),
            tier: tierValue
          });
        }
      }
    }
    
    return vendors;
    
  } catch (error) {
    Logger.log('Error getting vendors: ' + error.toString());
    return [];
  }
}

// Function to send quote request emails to vendors
function handleSendQuoteRequests(data) {
  try {
    var requestId = data.requestId;
    var vendors = data.vendors || [];
    
    if (!requestId || vendors.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Request ID and vendors are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get request details from sheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    var requestIdColumn = 3; // Column C (Request ID column)
    
    // Find the request row
    var requestRow = -1;
    for (var i = 2; i <= lastRow; i++) {
      var rowRequestId = sheet.getRange(i, requestIdColumn).getValue();
      if (rowRequestId && rowRequestId.toString() === requestId.toString()) {
        requestRow = i;
        break;
      }
    }
    
    if (requestRow === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Request ID not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get request data (columns: Timestamp, Customer ID, Request ID, Name, Email, Department, Cost Center, Class, Type, Item Name, Description, Quantity, Preferred Vendor, Estimated Budget, Priority, Required Date, Stage)
    var requestData = {
      timestamp: sheet.getRange(requestRow, 1).getValue(),
      customerId: sheet.getRange(requestRow, 2).getValue(),
      requestId: sheet.getRange(requestRow, 3).getValue(),
      requesterName: sheet.getRange(requestRow, 4).getValue(),
      requesterEmail: sheet.getRange(requestRow, 5).getValue(),
      department: sheet.getRange(requestRow, 6).getValue(),
      costCenter: sheet.getRange(requestRow, 7).getValue(),
      class: sheet.getRange(requestRow, 8).getValue(),
      type: sheet.getRange(requestRow, 9).getValue(),
      itemName: sheet.getRange(requestRow, 10).getValue(),
      description: sheet.getRange(requestRow, 11).getValue(),
      quantity: sheet.getRange(requestRow, 12).getValue(),
      preferredVendor: sheet.getRange(requestRow, 13).getValue(),
      estimatedCost: sheet.getRange(requestRow, 14).getValue(),
      priority: sheet.getRange(requestRow, 15).getValue(),
      requiredDate: sheet.getRange(requestRow, 16).getValue(),
      stage: sheet.getRange(requestRow, 17).getValue()
    };
    
    // Get script URL for quotation form
    var scriptUrl = ScriptApp.getService().getUrl();
    
    // Get vendor emails from vendor sheet
    var vendorSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('vendor');
    var vendorEmails = {};
    
    if (vendorSheet) {
      var vendorLastRow = vendorSheet.getLastRow();
      var vendorHeaders = vendorSheet.getRange(1, 1, 1, vendorSheet.getLastColumn()).getValues()[0];
      var vendorNameColIndex = -1;
      var vendorEmailColIndex = -1;
      
      for (var h = 0; h < vendorHeaders.length; h++) {
        var header = vendorHeaders[h].toString().toLowerCase();
        if (header === 'vendor_name' || header === 'vendor name' || header === 'vendor') {
          vendorNameColIndex = h + 1;
        }
        if (header === 'vendor_email' || header === 'vendor email' || header === 'email') {
          vendorEmailColIndex = h + 1;
        }
      }
      
      if (vendorNameColIndex > 0 && vendorEmailColIndex > 0) {
        var vendorData = vendorSheet.getRange(2, 1, vendorLastRow - 1, vendorSheet.getLastColumn()).getValues();
        for (var v = 0; v < vendorData.length; v++) {
          var vendorName = vendorData[v][vendorNameColIndex - 1];
          var vendorEmail = vendorData[v][vendorEmailColIndex - 1];
          if (vendorName && vendorEmail) {
            vendorEmails[vendorName.toString().trim()] = vendorEmail.toString().trim();
          }
        }
      }
    }
    
    // Store vendors list in quotation sheet (for tracking which vendors received quotes)
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var quotationSheet = ss.getSheetByName('quotation');
    var vendorsSentTo = [];
    
    // Send emails to each vendor
    var sentCount = 0;
    var fromEmail = 'ranjith.bk@yaaralabs.ai';
    var ccEmail = requestData.requesterEmail; // CC the requester email
    
    for (var vIdx = 0; vIdx < vendors.length; vIdx++) {
      var vendorName = vendors[vIdx];
      var vendorEmail = vendorEmails[vendorName] || '';
      
      if (!vendorEmail) {
        Logger.log('Vendor email not found for: ' + vendorName);
        continue;
      }
      
      // Build quotation form URL
      var quotationUrl = scriptUrl + '?action=quotationForm&requestId=' + encodeURIComponent(requestId) + '&vendor=' + encodeURIComponent(vendorName);
      
      // Build email subject
      var subject = 'Quotation Request - ' + requestId + ' - ' + requestData.itemName;
      
      // Build email HTML body
      var htmlBody = buildQuoteRequestEmail(requestData, vendorName, quotationUrl);
      
      try {
        MailApp.sendEmail({
          to: vendorEmail,
          cc: ccEmail,
          subject: subject,
          htmlBody: htmlBody,
          from: fromEmail
        });
        sentCount++;
        vendorsSentTo.push(vendorName); // Track successfully sent vendors
        Logger.log('Quote request email sent to: ' + vendorEmail);
      } catch (emailErr) {
        Logger.log('Error sending email to ' + vendorEmail + ': ' + emailErr.toString());
      }
    }
    
    // Store vendors list in quotation sheet for tracking (create entry if doesn't exist)
    if (quotationSheet && vendorsSentTo.length > 0) {
      ensureQuotationSheetHeaders(quotationSheet);
      var dataRange = quotationSheet.getDataRange();
      var values = dataRange.getValues();
      var headers = values[0];
      
      var findColumnIndex = function(headerName) {
        for (var i = 0; i < headers.length; i++) {
          if (headers[i] && headers[i].toString().trim().toLowerCase() === headerName.toLowerCase()) {
            return i + 1;
          }
        }
        return -1;
      };
      
      var requestIdCol = findColumnIndex('Request ID');
      var vendorNameCol = findColumnIndex('Vendor Name');
      
      // For each vendor, check if entry exists, if not create one with just Request ID and Vendor Name
      for (var v = 0; v < vendorsSentTo.length; v++) {
        var vendor = vendorsSentTo[v];
        var found = false;
        
        // Check if entry already exists
        if (requestIdCol > 0 && vendorNameCol > 0) {
          for (var r = 1; r < values.length; r++) {
            var rowRequestId = values[r][requestIdCol - 1];
            var rowVendorName = values[r][vendorNameCol - 1];
            if (rowRequestId && rowVendorName && 
                String(rowRequestId).trim() === String(requestId).trim() &&
                String(rowVendorName).trim() === String(vendor).trim()) {
              found = true;
              break;
            }
          }
        }
        
        // If not found, create a placeholder entry
        if (!found && requestIdCol > 0 && vendorNameCol > 0) {
          var newRow = new Array(headers.length);
          newRow[requestIdCol - 1] = requestId;
          newRow[vendorNameCol - 1] = vendor;
          newRow[vendorNameCol] = vendorEmail; // Vendor Email if column exists
          quotationSheet.appendRow(newRow);
          Logger.log('Created placeholder entry for vendor: ' + vendor);
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      sentCount: sentCount,
      vendors: vendorsSentTo, // Return list of vendors who received quotes
      message: 'Quotation request emails sent to ' + sentCount + ' vendor(s)'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error in handleSendQuoteRequests: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to build quote request email HTML
function buildQuoteRequestEmail(requestData, vendorName, quotationUrl) {
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
  html += 'body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }';
  html += '.container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }';
  html += '.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }';
  html += '.content { background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }';
  html += '.product-info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }';
  html += '.product-info p { margin: 8px 0; }';
  html += '.product-info strong { color: #555; }';
  html += '.button-container { text-align: center; margin: 30px 0; }';
  html += '.btn { display: inline-block; padding: 14px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; background-color: #28a745; color: white; }';
  html += '.btn:hover { opacity: 0.9; }';
  html += '.footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; }';
  html += '</style></head><body>';
  
  html += '<div class="container">';
  html += '<div class="header"><h1 style="margin: 0;">Quotation Request</h1></div>';
  html += '<div class="content">';
  
  html += '<p>Dear ' + vendorName + ',</p>';
  html += '<p>We are requesting a quotation for the following product:</p>';
  
  html += '<div class="product-info">';
  html += '<p><strong>Product Name:</strong> ' + (requestData.itemName || 'N/A') + '</p>';
  html += '<p><strong>Quantity:</strong> ' + (requestData.quantity || 'N/A') + '</p>';
  html += '<p><strong>Type:</strong> ' + (requestData.type || 'N/A') + '</p>';
  html += '<p><strong>Description:</strong> ' + (requestData.description || 'N/A') + '</p>';
  html += '</div>';
  
  html += '<div class="button-container">';
  html += '<a href="' + quotationUrl + '" class="btn">Submit Quotation</a>';
  html += '</div>';
  
  html += '<p><strong>Important:</strong> When submitting your quotation, please ensure you provide:</p>';
  html += '<ul style="margin: 15px 0; padding-left: 20px;">';
  html += '<li>Your company name</li>';
  html += '<li>Your contact phone number</li>';
  html += '<li>Unit price and total price</li>';
  html += '<li><strong>Detailed quotation document</strong> (PDF, Excel, or Word format) - This is required for review</li>';
  html += '</ul>';
  html += '<p>Please click the button above to submit your quotation. Your quotation will be reviewed by our procurement team.</p>';
  
  html += '<div class="footer">';
  html += '<p><strong>Request ID:</strong> ' + requestData.requestId + '</p>';
  html += '<p>This is an automated email from the Procurement System. Please do not reply to this email.</p>';
  html += '</div>';
  
  html += '</div></div></body></html>';
  
  return html;
}

// Function to show quotation form to vendor
function showQuotationForm(requestId, vendorName) {
  try {
    Logger.log('showQuotationForm called with requestId: ' + requestId + ', vendorName: ' + vendorName);
    
    // Get request details from sheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    var requestIdColumn = 3; // Column C (Request ID column)
    
    // Find the request row
    var requestRow = -1;
    for (var i = 2; i <= lastRow; i++) {
      var rowRequestId = sheet.getRange(i, requestIdColumn).getValue();
      if (rowRequestId && rowRequestId.toString() === requestId.toString()) {
        requestRow = i;
        break;
      }
    }
    
    if (requestRow === -1) {
      Logger.log('Request ID not found: ' + requestId);
      return HtmlService.createHtmlOutput('<html><body style="font-family: Arial; padding: 20px;"><h2 style="color: red;">Error</h2><p>Request ID not found: ' + requestId + '</p></body></html>');
    }
    
    // Get request data
    var itemName = sheet.getRange(requestRow, 10).getValue() || 'N/A';
    var type = sheet.getRange(requestRow, 9).getValue() || 'N/A';
    var quantity = sheet.getRange(requestRow, 12).getValue() || 'N/A';
    var description = sheet.getRange(requestRow, 11).getValue() || 'N/A';
    
    // Escape HTML to prevent XSS
    function escapeHtml(text) {
      if (!text) return '';
      var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
    }
    
    var safeRequestId = escapeHtml(requestId);
    var safeVendorName = escapeHtml(vendorName);
    var safeItemName = escapeHtml(itemName);
    var safeType = escapeHtml(type);
    var safeQuantity = escapeHtml(quantity);
    var safeDescription = escapeHtml(description);
    
    // Build HTML form with comprehensive error handling
    var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>Submit Quotation</title>\n<style>\n';
    html += 'body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }\n';
    html += '.container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }\n';
    html += 'h1 { color: #333; margin-bottom: 10px; }\n';
    html += 'h2 { color: #666; font-size: 16px; margin-bottom: 30px; }\n';
    html += '.product-info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }\n';
    html += '.product-info p { margin: 5px 0; }\n';
    html += 'label { display: block; margin-top: 15px; margin-bottom: 5px; font-weight: bold; color: #555; }\n';
    html += 'input, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 14px; box-sizing: border-box; }\n';
    html += 'textarea { resize: vertical; min-height: 80px; }\n';
    html += '.required { color: red; }\n';
    html += 'button { background: #28a745; color: white; padding: 12px 30px; border: none; border-radius: 5px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 20px; width: 100%; }\n';
    html += 'button:hover { background: #218838; }\n';
    html += 'button:disabled { background: #ccc; cursor: not-allowed; }\n';
    html += '.error { color: red; font-size: 12px; margin-top: 5px; }\n';
    html += '#debugInfo { background: #fff3cd; padding: 10px; border-radius: 5px; margin-top: 20px; font-size: 12px; color: #856404; display: none; }\n';
    html += '</style>\n</head>\n<body>\n';
    
    html += '<div class="container">\n';
    html += '<h1>Submit Quotation</h1>\n';
    html += '<h2>Request ID: ' + safeRequestId + '</h2>\n';
    
    html += '<div class="product-info">\n';
    html += '<p><strong>Product Name:</strong> ' + safeItemName + '</p>\n';
    html += '<p><strong>Type:</strong> ' + safeType + '</p>\n';
    html += '<p><strong>Quantity:</strong> ' + safeQuantity + '</p>\n';
    html += '<p><strong>Description:</strong> ' + safeDescription + '</p>\n';
    html += '</div>\n';
    
    html += '<form id="quotationForm">\n';
    html += '<input type="hidden" name="requestId" id="requestId" value="' + safeRequestId + '">\n';
    html += '<input type="hidden" name="vendorName" id="vendorName" value="' + safeVendorName + '">\n';
    
    html += '<label>Vendor Name <span class="required">*</span></label>\n';
    html += '<input type="text" name="vendorNameDisplay" id="vendorNameDisplay" value="' + safeVendorName + '" required placeholder="Your company name">\n';
    
    html += '<label>Vendor Email <span class="required">*</span></label>\n';
    html += '<input type="email" name="vendorEmail" id="vendorEmail" required placeholder="your.email@vendor.com">\n';
    
    html += '<label>Phone Number <span class="required">*</span></label>\n';
    html += '<input type="tel" name="phoneNumber" id="phoneNumber" required placeholder="+1234567890">\n';
    
    html += '<label>Unit Price <span class="required">*</span></label>\n';
    html += '<input type="number" name="unitPrice" id="unitPrice" step="0.01" min="0" required placeholder="0.00">\n';
    
    html += '<label>Total Price <span class="required">*</span></label>\n';
    html += '<input type="number" name="totalPrice" id="totalPrice" step="0.01" min="0" required placeholder="0.00">\n';
    
    html += '<label>Delivery Time (Optional)</label>\n';
    html += '<input type="text" name="deliveryTime" id="deliveryTime" placeholder="e.g., 2 weeks, 30 days">\n';
    
    html += '<label>Detailed Quotation Document (PDF/Excel/Word) <span class="required">*</span></label>\n';
    html += '<input type="file" name="quotationFile" id="quotationFile" accept=".pdf,.xlsx,.xls,.doc,.docx" required>\n';
    html += '<small style="color: #666; display: block; margin-top: 5px;">Please attach your detailed quotation document for review</small>\n';
    
    html += '<label>Notes (Optional)</label>\n';
    html += '<textarea name="notes" id="notes" placeholder="Additional information about your quotation..."></textarea>\n';
    
    html += '<button type="submit" id="submitBtn">Submit Quotation</button>\n';
    html += '</form>\n';
    
    html += '<div id="message"></div>\n';
    html += '<div id="debugInfo"></div>\n';
    
    // JavaScript with extensive logging
    html += '<script>\n';
    html += 'console.log("=== Quotation Form Script Loading ====");\n';
    html += 'console.log("Document ready state: " + document.readyState);\n';
    html += '\n';
    html += 'function debugLog(message) {\n';
    html += '  console.log("[Quotation Form] " + message);\n';
    html += '  var debugDiv = document.getElementById("debugInfo");\n';
    html += '  if (debugDiv) {\n';
    html += '    debugDiv.style.display = "block";\n';
    html += '    debugDiv.innerHTML += "<div>" + new Date().toLocaleTimeString() + ": " + message + "</div>";\n';
    html += '  }\n';
    html += '}\n';
    html += '\n';
    html += 'function submitQuotation(event) {\n';
    html += '  debugLog("submitQuotation function called");\n';
    html += '  \n';
    html += '  if (event) {\n';
    html += '    event.preventDefault();\n';
    html += '    debugLog("Prevented default form submission");\n';
    html += '  }\n';
    html += '  \n';
    html += '  var form = document.getElementById("quotationForm");\n';
    html += '  var btn = document.getElementById("submitBtn");\n';
    html += '  var message = document.getElementById("message");\n';
    html += '  var fileInput = document.getElementById("quotationFile");\n';
    html += '  \n';
    html += '  debugLog("Form elements check - form: " + (form ? "found" : "NOT FOUND"));\n';
    html += '  debugLog("Form elements check - btn: " + (btn ? "found" : "NOT FOUND"));\n';
    html += '  debugLog("Form elements check - message: " + (message ? "found" : "NOT FOUND"));\n';
    html += '  debugLog("Form elements check - fileInput: " + (fileInput ? "found" : "NOT FOUND"));\n';
    html += '  \n';
    html += '  if (!form || !btn || !message || !fileInput) {\n';
    html += '    var errorMsg = "Form elements not found. form: " + (form ? "OK" : "MISSING") + ", btn: " + (btn ? "OK" : "MISSING") + ", message: " + (message ? "OK" : "MISSING") + ", fileInput: " + (fileInput ? "OK" : "MISSING");\n';
    html += '    console.error(errorMsg);\n';
    html += '    if (message) message.innerHTML = "<div style=\\"background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin-top: 20px;\\"><strong>Error:</strong> " + errorMsg + "</div>";\n';
    html += '    return false;\n';
    html += '  }\n';
    html += '  \n';
    html += '  btn.disabled = true;\n';
    html += '  btn.textContent = "Submitting...";\n';
    html += '  message.innerHTML = "";\n';
    html += '  debugLog("Button disabled, starting validation");\n';
    html += '  \n';
    html += '  // Validate file\n';
    html += '  if (!fileInput.files || fileInput.files.length === 0) {\n';
    html += '    debugLog("File validation failed - no file selected");\n';
    html += '    message.innerHTML = "<div style=\\"background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin-top: 20px;\\"><strong>Error:</strong> Please attach your quotation document.</div>";\n';
    html += '    btn.disabled = false;\n';
    html += '    btn.textContent = "Submit Quotation";\n';
    html += '    return false;\n';
    html += '  }\n';
    html += '  \n';
    html += '  var file = fileInput.files[0];\n';
    html += '  debugLog("File selected: " + file.name + ", size: " + file.size + " bytes");\n';
    html += '  \n';
    html += '  if (file.size > 25 * 1024 * 1024) {\n';
    html += '    debugLog("File validation failed - file too large");\n';
    html += '    message.innerHTML = "<div style=\\"background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin-top: 20px;\\"><strong>Error:</strong> File size must be less than 25MB.</div>";\n';
    html += '    btn.disabled = false;\n';
    html += '    btn.textContent = "Submit Quotation";\n';
    html += '    return false;\n';
    html += '  }\n';
    html += '  \n';
    html += '  debugLog("Starting file read as base64");\n';
    html += '  \n';
    html += '  // Convert file to base64\n';
    html += '  var reader = new FileReader();\n';
    html += '  \n';
    html += '  reader.onload = function(e) {\n';
    html += '    try {\n';
    html += '      debugLog("File read successful, processing data");\n';
    html += '      var base64Data = e.target.result.split(",")[1];\n';
    html += '      debugLog("Base64 data length: " + base64Data.length);\n';
    html += '      \n';
    html += '      var data = {\n';
    html += '        requestId: document.getElementById("requestId").value,\n';
    html += '        vendorName: document.getElementById("vendorNameDisplay").value || document.getElementById("vendorName").value,\n';
    html += '        vendorEmail: document.getElementById("vendorEmail").value,\n';
    html += '        phoneNumber: document.getElementById("phoneNumber").value,\n';
    html += '        unitPrice: document.getElementById("unitPrice").value,\n';
    html += '        totalPrice: document.getElementById("totalPrice").value,\n';
    html += '        deliveryTime: document.getElementById("deliveryTime").value || "",\n';
    html += '        notes: document.getElementById("notes").value || "",\n';
    html += '        fileName: file.name,\n';
    html += '        fileType: file.type || "application/octet-stream",\n';
    html += '        fileData: base64Data\n';
    html += '      };\n';
    html += '      \n';
    html += '      debugLog("Data prepared, calling google.script.run");\n';
    html += '      console.log("Submitting data:", JSON.stringify({ requestId: data.requestId, vendorName: data.vendorName, vendorEmail: data.vendorEmail, hasFile: !!data.fileData, fileSize: data.fileData ? data.fileData.length : 0 }));\n';
    html += '      \n';
    html += '      google.script.run\n';
    html += '        .withSuccessHandler(function(result) {\n';
    html += '          debugLog("Server response received: " + JSON.stringify(result));\n';
    html += '          if (result && result.success) {\n';
    html += '            debugLog("Submission successful");\n';
    html += '            message.innerHTML = "<div style=\\"background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin-top: 20px;\\"><strong>Success!</strong> Your quotation has been submitted successfully.</div>";\n';
    html += '            form.reset();\n';
    html += '            btn.style.display = "none";\n';
    html += '          } else {\n';
    html += '            debugLog("Submission failed: " + (result && result.error ? result.error : "Unknown error"));\n';
    html += '            message.innerHTML = "<div style=\\"background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin-top: 20px;\\"><strong>Error:</strong> " + (result && result.error ? result.error : "Failed to submit quotation") + "</div>";\n';
    html += '            btn.disabled = false;\n';
    html += '            btn.textContent = "Submit Quotation";\n';
    html += '          }\n';
    html += '        })\n';
    html += '        .withFailureHandler(function(error) {\n';
    html += '          debugLog("Server error: " + error.message);\n';
    html += '          console.error("Server error details:", error);\n';
    html += '          message.innerHTML = "<div style=\\"background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin-top: 20px;\\"><strong>Error:</strong> " + (error.message || "An error occurred. Please try again.") + "</div>";\n';
    html += '          btn.disabled = false;\n';
    html += '          btn.textContent = "Submit Quotation";\n';
    html += '        })\n';
    html += '        .handleSubmitQuotationFromForm(data);\n';
    html += '    } catch (err) {\n';
    html += '      debugLog("Error in file processing: " + err.message);\n';
    html += '      console.error("Error processing file:", err);\n';
    html += '      message.innerHTML = "<div style=\\"background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin-top: 20px;\\"><strong>Error:</strong> " + err.message + "</div>";\n';
    html += '      btn.disabled = false;\n';
    html += '      btn.textContent = "Submit Quotation";\n';
    html += '    }\n';
    html += '  };\n';
    html += '  \n';
    html += '  reader.onerror = function() {\n';
    html += '    debugLog("FileReader error occurred");\n';
    html += '    message.innerHTML = "<div style=\\"background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin-top: 20px;\\"><strong>Error:</strong> Failed to read file. Please try again.</div>";\n';
    html += '    btn.disabled = false;\n';
    html += '    btn.textContent = "Submit Quotation";\n';
    html += '  };\n';
    html += '  \n';
    html += '  reader.readAsDataURL(file);\n';
    html += '  return false;\n';
    html += '}\n';
    html += '\n';
    html += 'function initForm() {\n';
    html += '  debugLog("Initializing form...");\n';
    html += '  var form = document.getElementById("quotationForm");\n';
    html += '  if (form) {\n';
    html += '    debugLog("Form found, attaching submit listener");\n';
    html += '    form.addEventListener("submit", submitQuotation);\n';
    html += '    debugLog("Submit listener attached successfully");\n';
    html += '  } else {\n';
    html += '    debugLog("ERROR: Form not found!");\n';
    html += '    console.error("Form element with id \'quotationForm\' not found");\n';
    html += '  }\n';
    html += '}\n';
    html += '\n';
    html += '// Wait for DOM to be ready\n';
    html += 'if (document.readyState === "loading") {\n';
    html += '  debugLog("Document loading, waiting for DOMContentLoaded");\n';
    html += '  document.addEventListener("DOMContentLoaded", function() {\n';
    html += '    debugLog("DOMContentLoaded fired");\n';
    html += '    initForm();\n';
    html += '  });\n';
    html += '} else {\n';
    html += '  debugLog("Document already ready, initializing immediately");\n';
    html += '  initForm();\n';
    html += '}\n';
    html += '\n';
    html += 'debugLog("Script execution completed");\n';
    html += 'console.log("=== Quotation Form Script Loaded ====");\n';
    html += '</script>\n';
    
    html += '</div>\n</body>\n</html>';
    
    Logger.log('HTML generated successfully, length: ' + html.length);
    
    var output = HtmlService.createHtmlOutput(html)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    
    Logger.log('HtmlService output created successfully');
    
    return output;
    
  } catch (error) {
    Logger.log('Error in showQuotationForm: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
    return HtmlService.createHtmlOutput('<html><body style="font-family: Arial; padding: 20px;"><h2 style="color: red;">Error</h2><p>' + error.toString() + '</p><p>Stack: ' + (error.stack || 'No stack trace') + '</p></body></html>');
  }
}

// Function to save uploaded file to Google Drive folder
function saveFileToDrive(base64Data, fileName, fileType, folderId) {
  try {
    // Decode base64 data
    var byteCharacters = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(byteCharacters, fileType, fileName);
    
    // Open the Drive folder
    var folder = DriveApp.getFolderById(folderId);
    
    // Create file in the folder
    var file = folder.createFile(blob);
    
    // Get file URL
    var fileUrl = file.getUrl();
    
    Logger.log('File saved to Drive: ' + fileName + ' at ' + fileUrl);
    
    return {
      success: true,
      fileUrl: fileUrl,
      fileId: file.getId()
    };
  } catch (error) {
    Logger.log('Error saving file to Drive: ' + error.toString());
    throw new Error('Failed to save file to Drive: ' + error.toString());
  }
}

// Function to handle quotation form submission from HTML form (via google.script.run)
function handleSubmitQuotationFromForm(data) {
  try {
    var attachmentUrl = '';
    
    // Handle file upload if present
    if (data.fileData && data.fileName) {
      try {
        // Drive folder ID from the URL: 1uMgMuljWzCBB7JetSCdHY9U4AhTlkZnq
        var driveFolderId = '1uMgMuljWzCBB7JetSCdHY9U4AhTlkZnq';
        var fileResult = saveFileToDrive(data.fileData, data.fileName, data.fileType, driveFolderId);
        if (fileResult.success) {
          attachmentUrl = fileResult.fileUrl;
          Logger.log('Attachment saved successfully: ' + attachmentUrl);
        }
      } catch (fileError) {
        Logger.log('Error saving attachment: ' + fileError.toString());
        // Continue without attachment rather than failing entire submission
        attachmentUrl = 'Error: ' + fileError.toString();
      }
    }
    
    // Add attachment URL to data
    data.attachmentUrl = attachmentUrl;
    
    // This is called directly from the HTML form via google.script.run
    var result = handleSubmitQuotation(data);
    // If result is an object (from direct call), return it; otherwise wrap it
    if (typeof result === 'object' && result !== null) {
      return result;
    }
    return { success: true, message: 'Quotation submitted successfully' };
  } catch (error) {
    Logger.log('Error in handleSubmitQuotationFromForm: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Function to handle quotation negotiation update
function handleUpdateQuotationNegotiation(data) {
  try {
    var requestId = data.requestId;
    var vendorName = data.vendorName;
    var negotiationNotes = data.negotiationNotes || '';
    var negotiatedAmount = data.negotiatedAmount || '';
    
    if (!requestId || !vendorName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Request ID and Vendor Name are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var quotationSheet = ss.getSheetByName('quotation');
    
    if (!quotationSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Quotation sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Ensure headers exist including negotiation columns
    ensureQuotationSheetHeaders(quotationSheet);
    
    var dataRange = quotationSheet.getDataRange();
    var values = dataRange.getValues();
    
    if (values.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No data rows found in quotation sheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var headers = values[0];
    
    // Find column indices (case-insensitive)
    var findColumnIndex = function(headerName) {
      for (var i = 0; i < headers.length; i++) {
        if (headers[i] && headers[i].toString().trim().toLowerCase() === headerName.toLowerCase()) {
          return i + 1; // Return 1-based index
        }
      }
      return -1;
    };
    
    var requestIdCol = findColumnIndex('Request ID');
    var vendorNameCol = findColumnIndex('Vendor Name');
    var negotiationNotesCol = findColumnIndex('Negotiation Notes');
    var negotiatedAmountCol = findColumnIndex('Negotiated Amount');
    
    if (requestIdCol === -1 || vendorNameCol === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Required columns (Request ID, Vendor Name) not found in sheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // If negotiation columns don't exist, create them
    if (negotiationNotesCol === -1 || negotiatedAmountCol === -1) {
      var lastCol = quotationSheet.getLastColumn();
      if (negotiationNotesCol === -1) {
        lastCol = lastCol + 1;
        quotationSheet.getRange(1, lastCol).setValue('Negotiation Notes');
        quotationSheet.getRange(1, lastCol).setFontWeight('bold');
        quotationSheet.getRange(1, lastCol).setBackground('#4285f4');
        quotationSheet.getRange(1, lastCol).setFontColor('#ffffff');
        negotiationNotesCol = lastCol;
        Logger.log('Created Negotiation Notes column at: ' + lastCol);
      }
      if (negotiatedAmountCol === -1) {
        lastCol = lastCol + 1;
        quotationSheet.getRange(1, lastCol).setValue('Negotiated Amount');
        quotationSheet.getRange(1, lastCol).setFontWeight('bold');
        quotationSheet.getRange(1, lastCol).setBackground('#4285f4');
        quotationSheet.getRange(1, lastCol).setFontColor('#ffffff');
        negotiatedAmountCol = lastCol;
        Logger.log('Created Negotiated Amount column at: ' + lastCol);
      }
    }
    
    // Find the row with matching Request ID and Vendor Name
    var found = false;
    var foundRow = -1;
    
    for (var i = 1; i < values.length; i++) {
      var rowRequestId = values[i][requestIdCol - 1];
      var rowVendorName = values[i][vendorNameCol - 1];
      
      // Compare as strings, trimming whitespace
      if (rowRequestId && rowVendorName && 
          String(rowRequestId).trim() === String(requestId).trim() && 
          String(rowVendorName).trim() === String(vendorName).trim()) {
        foundRow = i + 1; // Convert to 1-based row index
        found = true;
        break;
      }
    }
    
    if (!found) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No quotation found with Request ID "' + requestId + '" and Vendor Name "' + vendorName + '"'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Update the negotiation data
    quotationSheet.getRange(foundRow, negotiationNotesCol).setValue(negotiationNotes);
    
    // Handle negotiated amount - convert to number if it's a valid number string
    var amountValue = '';
    if (negotiatedAmount && negotiatedAmount !== '') {
      var parsedAmount = parseFloat(String(negotiatedAmount).replace(/[^\d.-]/g, ''));
      if (!isNaN(parsedAmount)) {
        amountValue = parsedAmount;
      } else {
        amountValue = String(negotiatedAmount).trim();
      }
    }
    quotationSheet.getRange(foundRow, negotiatedAmountCol).setValue(amountValue);
    
    Logger.log('Updated negotiation data for row ' + foundRow + ': notes=' + negotiationNotes + ', amount=' + amountValue);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Negotiation data updated successfully',
      row: foundRow
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error updating quotation negotiation: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Error updating quotation: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to handle vendor selection update
function handleUpdateVendorSelection(data) {
  try {
    var requestId = data.requestId;
    var vendorName = data.vendorName;
    var isSelected = data.isSelected; // true or false
    
    if (!requestId || !vendorName || typeof isSelected !== 'boolean') {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Request ID, Vendor Name, and isSelected (boolean) are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var quotationSheet = ss.getSheetByName('quotation');
    
    if (!quotationSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Quotation sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Ensure headers exist
    ensureQuotationSheetHeaders(quotationSheet);
    
    var dataRange = quotationSheet.getDataRange();
    var values = dataRange.getValues();
    
    if (values.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No data rows found in quotation sheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var headers = values[0];
    
    // Find column indices (case-insensitive)
    var findColumnIndex = function(headerName) {
      for (var i = 0; i < headers.length; i++) {
        if (headers[i] && headers[i].toString().trim().toLowerCase() === headerName.toLowerCase()) {
          return i + 1; // Return 1-based index
        }
      }
      return -1;
    };
    
    var requestIdCol = findColumnIndex('Request ID');
    var vendorNameCol = findColumnIndex('Vendor Name');
    var selectedCol = findColumnIndex('Selected');
    
    if (requestIdCol === -1 || vendorNameCol === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Required columns (Request ID, Vendor Name) not found in sheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // If Selected column doesn't exist, create it
    if (selectedCol === -1) {
      var lastCol = quotationSheet.getLastColumn();
      lastCol = lastCol + 1;
      quotationSheet.getRange(1, lastCol).setValue('Selected');
      quotationSheet.getRange(1, lastCol).setFontWeight('bold');
      quotationSheet.getRange(1, lastCol).setBackground('#4285f4');
      quotationSheet.getRange(1, lastCol).setFontColor('#ffffff');
      selectedCol = lastCol;
      Logger.log('Created Selected column at: ' + lastCol);
    }
    
    // Find the row with matching Request ID and Vendor Name
    var found = false;
    var foundRow = -1;
    
    for (var i = 1; i < values.length; i++) {
      var rowRequestId = values[i][requestIdCol - 1];
      var rowVendorName = values[i][vendorNameCol - 1];
      
      // Compare as strings, trimming whitespace
      if (rowRequestId && rowVendorName && 
          String(rowRequestId).trim() === String(requestId).trim() && 
          String(rowVendorName).trim() === String(vendorName).trim()) {
        foundRow = i + 1; // Convert to 1-based row index
        found = true;
        break;
      }
    }
    
    if (!found) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No quotation found with Request ID "' + requestId + '" and Vendor Name "' + vendorName + '"'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Update the Selected column (1 for selected, 0 for not selected)
    var selectedValue = isSelected ? 1 : 0;
    quotationSheet.getRange(foundRow, selectedCol).setValue(selectedValue);
    
    Logger.log('Updated Selected status for row ' + foundRow + ': ' + selectedValue);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Vendor selection updated successfully',
      row: foundRow,
      selected: selectedValue
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error updating vendor selection: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Error updating vendor selection: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to handle agreement acceptance update
function handleUpdateAgreementAcceptance(data) {
  try {
    var requestId = data.requestId;
    var vendorName = data.vendorName;
    var isAccepted = data.isAccepted; // true or false
    
    if (!requestId || !vendorName || typeof isAccepted !== 'boolean') {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Request ID, Vendor Name, and isAccepted (boolean) are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var quotationSheet = ss.getSheetByName('quotation');
    
    if (!quotationSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Quotation sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Ensure headers exist
    ensureQuotationSheetHeaders(quotationSheet);
    
    var dataRange = quotationSheet.getDataRange();
    var values = dataRange.getValues();
    
    if (values.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No data rows found in quotation sheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var headers = values[0];
    
    // Find column indices (case-insensitive)
    var findColumnIndex = function(headerName) {
      for (var i = 0; i < headers.length; i++) {
        if (headers[i] && headers[i].toString().trim().toLowerCase() === headerName.toLowerCase()) {
          return i + 1; // Return 1-based index
        }
      }
      return -1;
    };
    
    var requestIdCol = findColumnIndex('Request ID');
    var vendorNameCol = findColumnIndex('Vendor Name');
    var agreementAcceptedCol = findColumnIndex('Agreement Accepted');
    var agreementSentDateCol = findColumnIndex('Agreement Sent Date');
    var agreementAcceptedDateCol = findColumnIndex('Agreement Accepted Date');
    
    if (requestIdCol === -1 || vendorNameCol === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Required columns (Request ID, Vendor Name) not found in sheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // If Agreement Accepted column doesn't exist, create it
    if (agreementAcceptedCol === -1) {
      var lastCol = quotationSheet.getLastColumn();
      lastCol = lastCol + 1;
      quotationSheet.getRange(1, lastCol).setValue('Agreement Accepted');
      quotationSheet.getRange(1, lastCol).setFontWeight('bold');
      quotationSheet.getRange(1, lastCol).setBackground('#4285f4');
      quotationSheet.getRange(1, lastCol).setFontColor('#ffffff');
      agreementAcceptedCol = lastCol;
      Logger.log('Created Agreement Accepted column at: ' + lastCol);
    }
    
    // If Agreement Sent Date column doesn't exist, create it
    if (agreementSentDateCol === -1) {
      var lastCol = quotationSheet.getLastColumn();
      lastCol = lastCol + 1;
      quotationSheet.getRange(1, lastCol).setValue('Agreement Sent Date');
      quotationSheet.getRange(1, lastCol).setFontWeight('bold');
      quotationSheet.getRange(1, lastCol).setBackground('#4285f4');
      quotationSheet.getRange(1, lastCol).setFontColor('#ffffff');
      agreementSentDateCol = lastCol;
      Logger.log('Created Agreement Sent Date column at: ' + lastCol);
    }
    
    // If Agreement Accepted Date column doesn't exist, create it
    if (agreementAcceptedDateCol === -1) {
      var lastCol = quotationSheet.getLastColumn();
      lastCol = lastCol + 1;
      quotationSheet.getRange(1, lastCol).setValue('Agreement Accepted Date');
      quotationSheet.getRange(1, lastCol).setFontWeight('bold');
      quotationSheet.getRange(1, lastCol).setBackground('#4285f4');
      quotationSheet.getRange(1, lastCol).setFontColor('#ffffff');
      agreementAcceptedDateCol = lastCol;
      Logger.log('Created Agreement Accepted Date column at: ' + lastCol);
    }
    
    // Find the row with matching Request ID and Vendor Name
    var found = false;
    var foundRow = -1;
    
    for (var i = 1; i < values.length; i++) {
      var rowRequestId = values[i][requestIdCol - 1];
      var rowVendorName = values[i][vendorNameCol - 1];
      
      // Compare as strings, trimming whitespace
      if (rowRequestId && rowVendorName && 
          String(rowRequestId).trim() === String(requestId).trim() && 
          String(rowVendorName).trim() === String(vendorName).trim()) {
        foundRow = i + 1; // Convert to 1-based row index
        found = true;
        break;
      }
    }
    
    if (!found) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No quotation found with Request ID "' + requestId + '" and Vendor Name "' + vendorName + '"'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Update the Agreement Accepted column (1 for accepted, 0 for not accepted)
    var acceptedValue = isAccepted ? 1 : 0;
    quotationSheet.getRange(foundRow, agreementAcceptedCol).setValue(acceptedValue);
    
    // Update dates
    var today = new Date();
    var dateString = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    if (isAccepted) {
      // If accepting, set Agreement Sent Date if not already set
      var currentSentDate = values[foundRow - 1][agreementSentDateCol - 1];
      if (!currentSentDate || currentSentDate === '') {
        quotationSheet.getRange(foundRow, agreementSentDateCol).setValue(dateString);
      }
      // Set Agreement Accepted Date
      quotationSheet.getRange(foundRow, agreementAcceptedDateCol).setValue(dateString);
    } else {
      // If unaccepting, clear the accepted date (but keep sent date)
      quotationSheet.getRange(foundRow, agreementAcceptedDateCol).setValue('');
    }
    
    Logger.log('Updated Agreement Accepted status for row ' + foundRow + ': ' + acceptedValue);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Agreement acceptance updated successfully',
      row: foundRow,
      accepted: acceptedValue
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error updating agreement acceptance: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Error updating agreement acceptance: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to handle vendor approval update
function handleUpdateVendorApproval(data) {
  try {
    var requestId = data.requestId;
    var vendorName = data.vendorName;
    var isApproved = data.isApproved; // true or false
    
    if (!requestId || !vendorName || typeof isApproved !== 'boolean') {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Request ID, Vendor Name, and isApproved (boolean) are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var quotationSheet = ss.getSheetByName('quotation');
    
    if (!quotationSheet) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Quotation sheet not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Ensure headers exist
    ensureQuotationSheetHeaders(quotationSheet);
    
    var dataRange = quotationSheet.getDataRange();
    var values = dataRange.getValues();
    
    if (values.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No data rows found in quotation sheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var headers = values[0];
    
    // Find column indices (case-insensitive)
    var findColumnIndex = function(headerName) {
      for (var i = 0; i < headers.length; i++) {
        if (headers[i] && headers[i].toString().trim().toLowerCase() === headerName.toLowerCase()) {
          return i + 1; // Return 1-based index
        }
      }
      return -1;
    };
    
    var requestIdCol = findColumnIndex('Request ID');
    var vendorNameCol = findColumnIndex('Vendor Name');
    var vendorApprovedCol = findColumnIndex('Vendor Approved');
    var vendorApprovedDateCol = findColumnIndex('Vendor Approved Date');
    
    if (requestIdCol === -1 || vendorNameCol === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Required columns (Request ID, Vendor Name) not found in sheet'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // If Vendor Approved column doesn't exist, create it
    if (vendorApprovedCol === -1) {
      var lastCol = quotationSheet.getLastColumn();
      lastCol = lastCol + 1;
      quotationSheet.getRange(1, lastCol).setValue('Vendor Approved');
      quotationSheet.getRange(1, lastCol).setFontWeight('bold');
      quotationSheet.getRange(1, lastCol).setBackground('#4285f4');
      quotationSheet.getRange(1, lastCol).setFontColor('#ffffff');
      vendorApprovedCol = lastCol;
      Logger.log('Created Vendor Approved column at: ' + lastCol);
    }
    
    // Always ensure Vendor Approved column is formatted as number (not date)
    // This fixes any existing columns that might have date format
    var lastRow = quotationSheet.getLastRow();
    if (lastRow > 1) {
      quotationSheet.getRange(2, vendorApprovedCol, lastRow - 1, 1).setNumberFormat('0');
    }
    
    // If Vendor Approved Date column doesn't exist, create it
    if (vendorApprovedDateCol === -1) {
      var lastCol = quotationSheet.getLastColumn();
      lastCol = lastCol + 1;
      quotationSheet.getRange(1, lastCol).setValue('Vendor Approved Date');
      quotationSheet.getRange(1, lastCol).setFontWeight('bold');
      quotationSheet.getRange(1, lastCol).setBackground('#4285f4');
      quotationSheet.getRange(1, lastCol).setFontColor('#ffffff');
      vendorApprovedDateCol = lastCol;
      Logger.log('Created Vendor Approved Date column at: ' + lastCol);
    }
    
    // Find the row with matching Request ID and Vendor Name
    var found = false;
    var foundRow = -1;
    
    for (var i = 1; i < values.length; i++) {
      var rowRequestId = values[i][requestIdCol - 1];
      var rowVendorName = values[i][vendorNameCol - 1];
      
      // Compare as strings, trimming whitespace
      if (rowRequestId && rowVendorName && 
          String(rowRequestId).trim() === String(requestId).trim() && 
          String(rowVendorName).trim() === String(vendorName).trim()) {
        foundRow = i + 1; // Convert to 1-based row index
        found = true;
        break;
      }
    }
    
    if (!found) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No quotation found with Request ID "' + requestId + '" and Vendor Name "' + vendorName + '"'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Update the Vendor Approved column (1 for approved, 0 for not approved)
    // Ensure it's stored as a number, not a date
    var approvedValue = isApproved ? 1 : 0;
    var approvedRange = quotationSheet.getRange(foundRow, vendorApprovedCol);
    
    // Force set the number format and clear any date format that might be applied
    approvedRange.clearFormat();
    approvedRange.setNumberFormat('0');
    approvedRange.setValue(approvedValue);
    
    Logger.log('Setting Vendor Approved to: ' + approvedValue + ' (type: ' + typeof approvedValue + ')');
    
    // Update dates
    var today = new Date();
    var dateString = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    if (isApproved) {
      // If approving, set Vendor Approved Date
      quotationSheet.getRange(foundRow, vendorApprovedDateCol).setValue(dateString);
    } else {
      // If unapproving, clear the approved date
      quotationSheet.getRange(foundRow, vendorApprovedDateCol).setValue('');
    }
    
    Logger.log('Updated Vendor Approved status for row ' + foundRow + ': ' + approvedValue);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Vendor approval updated successfully',
      row: foundRow,
      approved: approvedValue
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('Error updating vendor approval: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Error updating vendor approval: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to handle sending Purchase Order email
function handleSendPurchaseOrder(data) {
  try {
    var requestId = data.requestId;
    var vendorName = data.vendorName;
    var vendorEmail = data.vendorEmail;
    var poNumber = data.poNumber;
    var poDate = data.poDate;
    var itemName = data.itemName || '';
    var quantity = data.quantity || 1;
    var unitPrice = data.unitPrice || 0;
    var totalPrice = data.totalPrice || 0;
    var requesterEmail = data.requesterEmail || '';
    var requesterName = data.requesterName || '';
    var department = data.department || '';
    
    if (!requestId || !vendorName || !vendorEmail) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Request ID, Vendor Name, and Vendor Email are required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Get requester email from Sheet1 if not provided
    if (!requesterEmail) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var mainSheet = ss.getSheetByName('Sheet1') || ss.getActiveSheet();
      
      if (mainSheet) {
        var lastRow = mainSheet.getLastRow();
        var requestIdColumn = 3; // Column C (Request ID column)
        
        // Find the row with matching Request ID
        for (var i = 2; i <= lastRow; i++) {
          var rowRequestId = mainSheet.getRange(i, requestIdColumn).getValue();
          if (rowRequestId && rowRequestId.toString() === requestId.toString()) {
            // Get requester email from column 5 (Email column)
            requesterEmail = mainSheet.getRange(i, 5).getValue() || '';
            if (!requesterName) {
              requesterName = mainSheet.getRange(i, 4).getValue() || ''; // Name column
            }
            if (!department) {
              department = mainSheet.getRange(i, 6).getValue() || ''; // Department column
            }
            break;
          }
        }
      }
    }
    
    // Update quotation sheet with PO Sent = 1
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var quotationSheet = ss.getSheetByName('quotation');
    
    if (quotationSheet) {
      // Ensure headers exist including PO Sent column
      ensureQuotationSheetHeaders(quotationSheet);
      
      var dataRange = quotationSheet.getDataRange();
      var values = dataRange.getValues();
      
      if (values.length > 1) {
        var headers = values[0];
        
        // Find column indices (case-insensitive)
        var findColumnIndex = function(headerName) {
          for (var i = 0; i < headers.length; i++) {
            if (headers[i] && headers[i].toString().trim().toLowerCase() === headerName.toLowerCase()) {
              return i + 1; // Return 1-based index
            }
          }
          return -1;
        };
        
        var requestIdCol = findColumnIndex('Request ID');
        var vendorNameCol = findColumnIndex('Vendor Name');
        var poSentCol = findColumnIndex('PO Sent');
        
        if (requestIdCol !== -1 && vendorNameCol !== -1 && poSentCol !== -1) {
          // Find the row with matching Request ID and Vendor Name
          for (var i = 1; i < values.length; i++) {
            var rowRequestId = values[i][requestIdCol - 1];
            var rowVendorName = values[i][vendorNameCol - 1];
            
            // Compare as strings, trimming whitespace
            if (rowRequestId && rowVendorName && 
                String(rowRequestId).trim() === String(requestId).trim() && 
                String(rowVendorName).trim() === String(vendorName).trim()) {
              // Mark PO Sent = 1
              quotationSheet.getRange(i + 1, poSentCol).setValue(1);
              Logger.log('Marked PO Sent = 1 for row ' + (i + 1) + ' (Request ID: ' + requestId + ', Vendor: ' + vendorName + ')');
              break;
            }
          }
        }
      }
    }
    
    // Build HTML email with PO content
    var htmlBody = buildPurchaseOrderEmail(data, requesterEmail, requesterName, department);
    
    // Send email
    var fromEmail = 'ranjith.bk@yaaralabs.ai';
    var subject = 'Purchase Order - ' + poNumber + ' - ' + itemName;
    var ccEmails = [];
    
    if (requesterEmail) {
      ccEmails.push(requesterEmail);
    }
    
    try {
      MailApp.sendEmail({
        to: vendorEmail,
        cc: ccEmails.join(','),
        subject: subject,
        htmlBody: htmlBody,
        from: fromEmail
      });
      
      Logger.log('Purchase Order email sent to: ' + vendorEmail);
      if (ccEmails.length > 0) {
        Logger.log('CC recipients: ' + ccEmails.join(', '));
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Purchase Order sent successfully',
        sentTo: vendorEmail,
        ccTo: ccEmails
      })).setMimeType(ContentService.MimeType.JSON);
      
    } catch (emailError) {
      Logger.log('Error sending email: ' + emailError.toString());
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Failed to send email: ' + emailError.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    Logger.log('Error in handleSendPurchaseOrder: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Error sending Purchase Order: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to build Purchase Order HTML email
function buildPurchaseOrderEmail(data, requesterEmail, requesterName, department) {
  var poNumber = data.poNumber;
  var poDate = data.poDate;
  var vendorName = data.vendorName;
  var vendorEmail = data.vendorEmail;
  var itemName = data.itemName || '';
  var quantity = data.quantity || 1;
  var unitPrice = parseFloat(data.unitPrice || 0);
  var totalPrice = parseFloat(data.totalPrice || 0);
  
  // Format currency
  function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>';
  html += 'body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 20px; background-color: #f5f5f5; }';
  html += '.container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }';
  html += '.header { display: flex; justify-content: flex-end; align-items: start; margin-bottom: 30px; border-bottom: 2px solid #ddd; padding-bottom: 20px; }';
  html += '.po-title { text-align: right; }';
  html += '.po-title h1 { font-size: 36px; font-weight: bold; color: #1f2937; margin: 0 0 15px 0; }';
  html += '.po-details { font-size: 14px; color: #1f2937; }';
  html += '.section-title { background: #f3f4f6; color: #1f2937; padding: 10px 15px; font-weight: bold; margin-bottom: 0; border: 1px solid #d1d5db; border-bottom: none; }';
  html += '.section-content { border: 1px solid #d1d5db; border-top: none; padding: 15px; color: #1f2937; }';
  html += '.two-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }';
  html += '.four-columns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }';
  html += '.small-section { font-size: 12px; }';
  html += '.items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }';
  html += '.items-table th { background: #f3f4f6; color: #1f2937; padding: 12px; text-align: left; border: 1px solid #d1d5db; }';
  html += '.items-table td { padding: 12px; border: 1px solid #d1d5db; color: #1f2937; }';
  html += '.items-table th.text-center { text-align: center; }';
  html += '.items-table th.text-right { text-align: right; }';
  html += '.items-table td.text-center { text-align: center; }';
  html += '.items-table td.text-right { text-align: right; }';
  html += '.summary { width: 300px; margin-left: auto; margin-bottom: 20px; }';
  html += '.summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; color: #1f2937; }';
  html += '.summary-total { background: #f3f4f6; padding: 10px; font-weight: bold; display: flex; justify-content: space-between; margin-top: 10px; border: 1px solid #d1d5db; color: #1f2937; }';
  html += '.comments-section { margin-bottom: 20px; }';
  html += '.comments-box { border: 1px solid #d1d5db; border-top: none; padding: 15px; min-height: 80px; font-size: 12px; color: #1f2937; }';
  html += '.footer { text-align: center; font-size: 11px; color: #1f2937; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }';
  html += '</style></head><body>';
  
  html += '<div class="container">';
  
  // Header (removed branding)
  html += '<div class="header">';
  html += '<div class="po-title">';
  html += '<h1>PURCHASE ORDER</h1>';
  html += '<div class="po-details">';
  html += '<p><strong>DATE:</strong> ' + poDate + '</p>';
  html += '<p><strong>PO #:</strong> ' + poNumber + '</p>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  
  // Vendor and Ship To
  html += '<div class="two-columns">';
  html += '<div>';
  html += '<div class="section-title">VENDOR</div>';
  html += '<div class="section-content">';
  html += '<p style="font-weight: bold; margin-bottom: 5px;">' + vendorName + '</p>';
  if (vendorEmail) {
    html += '<p>' + vendorEmail + '</p>';
  }
  html += '</div>';
  html += '</div>';
  html += '<div>';
  html += '<div class="section-title">SHIP TO</div>';
  html += '<div class="section-content">';
  if (requesterName) {
    html += '<p style="font-weight: bold; margin-bottom: 5px;">' + requesterName + '</p>';
  }
  if (department) {
    html += '<p>' + department + '</p>';
  }
  if (requesterEmail) {
    html += '<p>' + requesterEmail + '</p>';
  }
  html += '</div>';
  html += '</div>';
  html += '</div>';
  
  // Order Logistics
  html += '<div class="four-columns">';
  html += '<div>';
  html += '<div class="section-title small-section">REQUISITIONER</div>';
  html += '<div class="section-content small-section">' + (requesterName || '-') + '</div>';
  html += '</div>';
  html += '<div>';
  html += '<div class="section-title small-section">SHIP VIA</div>';
  html += '<div class="section-content small-section">Standard Ground Shipping</div>';
  html += '</div>';
  html += '<div>';
  html += '<div class="section-title small-section">F.O.B.</div>';
  html += '<div class="section-content small-section">Origin</div>';
  html += '</div>';
  html += '<div>';
  html += '<div class="section-title small-section">SHIPPING TERMS</div>';
  html += '<div class="section-content small-section">Net 30 Days</div>';
  html += '</div>';
  html += '</div>';
  
  // Items Table
  html += '<div>';
  html += '<div class="section-title">ITEMS</div>';
  html += '<table class="items-table">';
  html += '<thead>';
  html += '<tr>';
  html += '<th>ITEM #</th>';
  html += '<th>DESCRIPTION</th>';
  html += '<th class="text-center">QTY</th>';
  html += '<th class="text-right">UNIT PRICE</th>';
  html += '<th class="text-right">TOTAL</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody>';
  html += '<tr>';
  html += '<td>' + (data.requestId || '-') + '</td>';
  html += '<td>' + itemName + '</td>';
  html += '<td class="text-center">' + quantity + '</td>';
  html += '<td class="text-right">' + formatCurrency(unitPrice) + '</td>';
  html += '<td class="text-right">' + formatCurrency(totalPrice) + '</td>';
  html += '</tr>';
  html += '</tbody>';
  html += '</table>';
  html += '</div>';
  
  // Summary
  html += '<div class="summary">';
  html += '<div class="summary-row"><span>SUBTOTAL:</span><span>' + formatCurrency(totalPrice) + '</span></div>';
  html += '<div class="summary-row"><span>TAX:</span><span>-</span></div>';
  html += '<div class="summary-row"><span>SHIPPING:</span><span>-</span></div>';
  html += '<div class="summary-row"><span>OTHER:</span><span>-</span></div>';
  html += '<div class="summary-total"><span>TOTAL:</span><span>' + formatCurrency(totalPrice) + '</span></div>';
  html += '</div>';
  
  // Comments
  html += '<div class="comments-section">';
  html += '<div class="section-title">Comments or Special Instructions</div>';
  html += '<div class="comments-box"></div>';
  html += '</div>';
  
  // Footer
  if (requesterName || requesterEmail) {
    html += '<div class="footer">';
    var contactInfo = [];
    if (requesterName) contactInfo.push(requesterName);
    if (requesterEmail) contactInfo.push(requesterEmail);
    html += '<p>If you have any questions about this purchase order, please contact ' + contactInfo.join(', ') + '</p>';
    html += '</div>';
  }
  
  html += '</div></body></html>';
  
  return html;
}

// Helper function to ensure quotation sheet has proper headers
function ensureQuotationSheetHeaders(quotationSheet) {
  var requiredHeaders = ['Request ID', 'Vendor Name', 'Vendor Email', 'Phone Number', 'Unit Price', 'Total Price', 'Delivery Time', 'Notes', 'Attachment URL', 'Submitted Date', 'Negotiation Notes', 'Negotiated Amount', 'Selected', 'Agreement Accepted', 'Agreement Sent Date', 'Agreement Accepted Date', 'Vendor Approved', 'Vendor Approved Date', 'PO Sent'];
  
  if (!quotationSheet) {
    return requiredHeaders;
  }
  
  var firstRowValue = quotationSheet.getRange(1, 1).getValue();
  var lastRow = quotationSheet.getLastRow();
  var lastColumn = quotationSheet.getLastColumn();
  
  // Check if headers row exists
  if (!firstRowValue || firstRowValue.toString().trim().toLowerCase() !== 'request id') {
    Logger.log('Headers row missing. Creating headers row.');
    
    // If there's data in row 1, insert a new row for headers
    if (lastRow > 0 && firstRowValue) {
      Logger.log('Inserting header row before existing data');
      quotationSheet.insertRowBefore(1);
    }
    
    // Set all headers in first row
    quotationSheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    quotationSheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight('bold');
    quotationSheet.getRange(1, 1, 1, requiredHeaders.length).setBackground('#4285f4');
    quotationSheet.getRange(1, 1, 1, requiredHeaders.length).setFontColor('#ffffff');
    
    Logger.log('Headers successfully created in quotation sheet');
    return requiredHeaders;
  }
  
  // Headers exist - check and add missing ones
  var existingHeaders = quotationSheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var headersMap = {};
  
  // Map existing headers by their lowercase names
  for (var i = 0; i < existingHeaders.length; i++) {
    if (existingHeaders[i]) {
      var headerName = existingHeaders[i].toString().trim().toLowerCase();
      headersMap[headerName] = i + 1; // Store column index (1-based)
    }
  }
  
  // Check for missing headers and add them
  for (var j = 0; j < requiredHeaders.length; j++) {
    var requiredHeader = requiredHeaders[j];
    var requiredHeaderLower = requiredHeader.toString().trim().toLowerCase();
    
    if (!headersMap[requiredHeaderLower]) {
      // Header is missing - add it
      var insertColumn = lastColumn + 1;
      quotationSheet.insertColumnAfter(lastColumn);
      quotationSheet.getRange(1, insertColumn).setValue(requiredHeader);
      quotationSheet.getRange(1, insertColumn).setFontWeight('bold');
      quotationSheet.getRange(1, insertColumn).setBackground('#4285f4');
      quotationSheet.getRange(1, insertColumn).setFontColor('#ffffff');
      
      // If this is a numeric column (Selected, Agreement Accepted, Vendor Approved, PO Sent), set number format
      if (requiredHeaderLower === 'selected' || requiredHeaderLower === 'agreement accepted' || requiredHeaderLower === 'vendor approved' || requiredHeaderLower === 'po sent') {
        if (lastRow > 1) {
          quotationSheet.getRange(2, insertColumn, lastRow - 1, 1).setNumberFormat('0');
        }
      }
      
      headersMap[requiredHeaderLower] = insertColumn;
      lastColumn = quotationSheet.getLastColumn();
      Logger.log('Added missing header: ' + requiredHeader);
    } else {
      // Header exists - ensure numeric columns have correct format
      var columnIndex = headersMap[requiredHeaderLower];
      if (requiredHeaderLower === 'selected' || requiredHeaderLower === 'agreement accepted' || requiredHeaderLower === 'vendor approved' || requiredHeaderLower === 'po sent') {
        if (lastRow > 1) {
          quotationSheet.getRange(2, columnIndex, lastRow - 1, 1).setNumberFormat('0');
        }
      }
    }
  }
  
  // Return updated headers in order
  var finalHeaders = quotationSheet.getRange(1, 1, 1, quotationSheet.getLastColumn()).getValues()[0];
  return finalHeaders;
}

// Function to handle quotation form submission
function handleSubmitQuotation(data) {
  try {
    var requestId = data.requestId;
    var vendorName = data.vendorName;
    var vendorEmail = data.vendorEmail;
    var phoneNumber = data.phoneNumber || '';
    var unitPrice = data.unitPrice;
    var totalPrice = data.totalPrice;
    var deliveryTime = data.deliveryTime || '';
    var notes = data.notes || '';
    var attachmentUrl = data.attachmentUrl || '';
    
    if (!requestId || !vendorName || !vendorEmail || !unitPrice || !totalPrice) {
      // Return object for google.script.run calls
      return {
        success: false,
        error: 'Missing required fields'
      };
    }
    
    // Get or create quotation sheet
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var quotationSheet = spreadsheet.getSheetByName('quotation');
    
    if (!quotationSheet) {
      // Create new sheet - headers will be added by ensureQuotationSheetHeaders
      quotationSheet = spreadsheet.insertSheet('quotation');
    }
    
    // Ensure headers exist and are correct - this will add missing columns
    ensureQuotationSheetHeaders(quotationSheet);
    
    // Get all data from sheet - get headers directly from first row
    var dataRange = quotationSheet.getDataRange();
    var values = dataRange.getValues();
    var headers = values[0]; // Get actual headers from first row of sheet
    var existingRowIndex = -1;
    
    Logger.log('Headers from sheet (first ' + Math.min(headers.length, 10) + '): ' + JSON.stringify(headers.slice(0, Math.min(headers.length, 10))));
    
    // Find column indices for Request ID and Vendor Name from actual headers
    var findColumnIndex = function(headerName) {
      var searchName = headerName.toString().trim().toLowerCase();
      for (var i = 0; i < headers.length; i++) {
        var header = headers[i];
        if (header) {
          var headerLower = header.toString().trim().toLowerCase();
          if (headerLower === searchName) {
            Logger.log('Found column "' + headerName + '" at index ' + (i + 1) + ' (0-based: ' + i + ')');
            return i + 1; // Return 1-based index
          }
        }
      }
      Logger.log('Column "' + headerName + '" not found in headers. Available headers: ' + headers.map(function(h) { return h ? String(h) : ''; }).join(', '));
      return -1;
    };
    
    var requestIdCol = findColumnIndex('Request ID');
    var vendorNameCol = findColumnIndex('Vendor Name');
    
    Logger.log('Column indices - Request ID: ' + requestIdCol + ', Vendor Name: ' + vendorNameCol);
    Logger.log('Total rows in sheet: ' + values.length);
    
    // Normalize the search values (trim and convert to string)
    var normalizedRequestId = String(requestId).trim().toLowerCase();
    var normalizedVendorName = String(vendorName).trim().toLowerCase();
    
    Logger.log('Searching for existing quotation - Request ID: "' + requestId + '" (normalized: "' + normalizedRequestId + '"), Vendor: "' + vendorName + '" (normalized: "' + normalizedVendorName + '")');
    
    // Search for existing entry
    if (requestIdCol > 0 && vendorNameCol > 0 && values.length > 1) {
      // Convert 1-based column indices to 0-based array indices
      var requestIdColIndex = requestIdCol - 1;
      var vendorNameColIndex = vendorNameCol - 1;
      
      Logger.log('Searching with column indices - Request ID at array index: ' + requestIdColIndex + ', Vendor Name at array index: ' + vendorNameColIndex);
      
      // Search from top to bottom (skip header row at index 0)
      for (var r = 1; r < values.length; r++) {
        var row = values[r];
        var rowRequestId = row[requestIdColIndex];
        var rowVendorName = row[vendorNameColIndex];
        
        // Normalize comparison values
        var normalizedRowRequestId = rowRequestId ? String(rowRequestId).trim().toLowerCase() : '';
        var normalizedRowVendorName = rowVendorName ? String(rowVendorName).trim().toLowerCase() : '';
        
        // Only log first few rows to avoid too much logging
        if (r <= 5 || normalizedRowRequestId === normalizedRequestId) {
          Logger.log('Checking row ' + (r + 1) + ': Request ID="' + rowRequestId + '" (normalized: "' + normalizedRowRequestId + '"), Vendor="' + rowVendorName + '" (normalized: "' + normalizedRowVendorName + '")');
        }
        
        // Check if both Request ID and Vendor Name match (case-insensitive, trimmed)
        if (normalizedRowRequestId === normalizedRequestId && 
            normalizedRowVendorName === normalizedVendorName) {
          existingRowIndex = r + 1; // Convert to 1-based row index (r is 0-based array index, +1 for sheet row)
          Logger.log('✓✓✓ MATCH FOUND! Existing quotation at row: ' + existingRowIndex + ' (array index: ' + r + ') for Request ID: ' + requestId + ', Vendor: ' + vendorName);
          break; // Update the first match found
        }
      }
      
      // If not found, log for debugging
      if (existingRowIndex === -1) {
        Logger.log('✗✗✗ No existing quotation found for Request ID: ' + requestId + ', Vendor: ' + vendorName);
        Logger.log('Searched through ' + (values.length - 1) + ' data rows');
        Logger.log('Will create a new row instead');
      }
    } else {
      Logger.log('ERROR: Cannot search - Request ID column: ' + requestIdCol + ', Vendor Name column: ' + vendorNameCol);
      Logger.log('Make sure these columns exist in the quotation sheet');
    }
    
    // Build row data matching header order
    var rowData = [];
    for (var h = 0; h < headers.length; h++) {
      var headerName = headers[h].toString().trim().toLowerCase();
      if (headerName === 'request id') {
        rowData.push(requestId);
      } else if (headerName === 'vendor name') {
        rowData.push(vendorName);
      } else if (headerName === 'vendor email') {
        rowData.push(vendorEmail);
      } else if (headerName === 'phone number') {
        rowData.push(phoneNumber);
      } else if (headerName === 'unit price') {
        rowData.push(parseFloat(unitPrice));
      } else if (headerName === 'total price') {
        rowData.push(parseFloat(totalPrice));
      } else if (headerName === 'delivery time') {
        rowData.push(deliveryTime);
      } else if (headerName === 'notes') {
        rowData.push(notes);
      } else if (headerName === 'attachment url') {
        rowData.push(attachmentUrl);
      } else if (headerName === 'submitted date') {
        rowData.push(new Date());
      } else {
        // For columns that shouldn't be overwritten on resubmission, preserve existing values
        // These include: Selected, Agreement Accepted, Agreement Sent Date, Agreement Accepted Date,
        // Vendor Approved, Vendor Approved Date, PO Sent, Negotiation Notes, Negotiated Amount
        if (existingRowIndex > 0) {
          var existingValue = values[existingRowIndex - 1][h];
          // Preserve existing value if it exists, otherwise leave empty
          rowData.push(existingValue !== undefined && existingValue !== null && existingValue !== '' ? existingValue : '');
        } else {
          rowData.push(''); // Fill empty for new rows
        }
      }
    }
    
    if (existingRowIndex > 0) {
      // Update existing row - update only quotation-specific columns, preserve workflow columns
      // Find column indices for fields we want to update
      var vendorEmailCol = findColumnIndex('Vendor Email');
      var phoneNumberCol = findColumnIndex('Phone Number');
      var unitPriceCol = findColumnIndex('Unit Price');
      var totalPriceCol = findColumnIndex('Total Price');
      var deliveryTimeCol = findColumnIndex('Delivery Time');
      var notesCol = findColumnIndex('Notes');
      var attachmentUrlCol = findColumnIndex('Attachment URL');
      var submittedDateCol = findColumnIndex('Submitted Date');
      
      Logger.log('Updating row ' + existingRowIndex + ' with quotation data');
      
      // Update specific columns only (preserve other columns like Selected, Agreement Accepted, etc.)
      if (vendorEmailCol > 0) {
        quotationSheet.getRange(existingRowIndex, vendorEmailCol).setValue(vendorEmail);
        Logger.log('Updated Vendor Email at column ' + vendorEmailCol);
      }
      if (phoneNumberCol > 0) {
        quotationSheet.getRange(existingRowIndex, phoneNumberCol).setValue(phoneNumber);
        Logger.log('Updated Phone Number at column ' + phoneNumberCol);
      }
      if (unitPriceCol > 0) {
        quotationSheet.getRange(existingRowIndex, unitPriceCol).setValue(parseFloat(unitPrice));
        Logger.log('Updated Unit Price at column ' + unitPriceCol + ' with value: ' + unitPrice);
      }
      if (totalPriceCol > 0) {
        quotationSheet.getRange(existingRowIndex, totalPriceCol).setValue(parseFloat(totalPrice));
        Logger.log('Updated Total Price at column ' + totalPriceCol + ' with value: ' + totalPrice);
      }
      if (deliveryTimeCol > 0) {
        quotationSheet.getRange(existingRowIndex, deliveryTimeCol).setValue(deliveryTime);
        Logger.log('Updated Delivery Time at column ' + deliveryTimeCol);
      }
      if (notesCol > 0) {
        quotationSheet.getRange(existingRowIndex, notesCol).setValue(notes);
        Logger.log('Updated Notes at column ' + notesCol);
      }
      if (attachmentUrlCol > 0) {
        quotationSheet.getRange(existingRowIndex, attachmentUrlCol).setValue(attachmentUrl);
        Logger.log('Updated Attachment URL at column ' + attachmentUrlCol);
      }
      if (submittedDateCol > 0) {
        quotationSheet.getRange(existingRowIndex, submittedDateCol).setValue(new Date());
        Logger.log('Updated Submitted Date at column ' + submittedDateCol);
      }
      
      Logger.log('Successfully updated existing quotation at row ' + existingRowIndex + ' for request: ' + requestId + ', vendor: ' + vendorName);
    } else {
      // Append new row only if no existing entry found
      quotationSheet.appendRow(rowData);
      Logger.log('Created new quotation row for request: ' + requestId + ', vendor: ' + vendorName);
    }
    
    Logger.log('Quotation saved for request: ' + requestId + ', vendor: ' + vendorName);
    Logger.log('Attachment URL: ' + attachmentUrl);
    
    // Return object for google.script.run (will be wrapped for API calls)
    return {
      success: true,
      message: 'Quotation submitted successfully'
    };
    
  } catch (error) {
    Logger.log('Error in handleSubmitQuotation: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Function to fetch quotations by requestId
function getQuotations(requestId) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var quotationSheet = spreadsheet.getSheetByName('quotation');
    
    if (!quotationSheet) {
      return [];
    }
    
    var lastRow = quotationSheet.getLastRow();
    if (lastRow <= 1) {
      return [];
    }
    
    var headers = quotationSheet.getRange(1, 1, 1, quotationSheet.getLastColumn()).getValues()[0];
    var requestIdColIndex = -1;
    
    // Find Request ID column
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i].toString().toLowerCase();
      if (header === 'request id' || header === 'requestid' || header === 'request_id') {
        requestIdColIndex = i + 1;
        break;
      }
    }
    
    if (requestIdColIndex === -1) {
      Logger.log('Request ID column not found in quotation sheet');
      return [];
    }
    
    var quotations = [];
    var data = quotationSheet.getRange(2, 1, lastRow - 1, quotationSheet.getLastColumn()).getValues();
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][requestIdColIndex - 1] && data[i][requestIdColIndex - 1].toString() === requestId) {
        var quotation = {};
        for (var j = 0; j < headers.length; j++) {
          var key = headers[j].toString().toLowerCase().replace(/\s+/g, '');
          quotation[key] = data[i][j];
        }
        // Also keep original column names for compatibility
        quotation['Request ID'] = data[i][requestIdColIndex - 1];
        quotation['Vendor Name'] = data[i][1]; // Assuming Vendor Name is column 2
        quotation['Vendor Email'] = data[i][2]; // Assuming Vendor Email is column 3
        quotation['Unit Price'] = data[i][3]; // Assuming Unit Price is column 4
        quotation['Total Price'] = data[i][4]; // Assuming Total Price is column 5
        quotation['Delivery Time'] = data[i][5]; // Assuming Delivery Time is column 6
        quotation['Notes'] = data[i][6]; // Assuming Notes is column 7
        quotation['Submitted Date'] = data[i][7]; // Assuming Submitted Date is column 8
        quotations.push(quotation);
      }
    }
    
    return quotations;
  } catch (error) {
    Logger.log('Error in getQuotations: ' + error.toString());
    return [];
  }
}

// Function to handle GET requests for quotations
function doGetQuotations(e) {
  try {
    var requestId = e.parameter.requestId || '';
    
    if (!requestId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Request ID is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var quotations = getQuotations(requestId);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      quotations: quotations
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error in doGetQuotations: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to fetch vendor history from vendor sheet
function getVendorHistory(vendorName) {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var vendorSheet = spreadsheet.getSheetByName('vendor');
    
    if (!vendorSheet) {
      return [];
    }
    
    var lastRow = vendorSheet.getLastRow();
    if (lastRow <= 1) {
      return [];
    }
    
    var headers = vendorSheet.getRange(1, 1, 1, vendorSheet.getLastColumn()).getValues()[0];
    var vendorNameColIndex = -1;
    
    // Find Vendor Name column
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i].toString().toLowerCase();
      if (header === 'vendor name' || header === 'vendorname' || header === 'vendor_name' || header === 'name') {
        vendorNameColIndex = i + 1;
        break;
      }
    }
    
    if (vendorNameColIndex === -1) {
      Logger.log('Vendor Name column not found in vendor sheet');
      return [];
    }
    
    var history = [];
    var data = vendorSheet.getRange(2, 1, lastRow - 1, vendorSheet.getLastColumn()).getValues();
    
    for (var i = 0; i < data.length; i++) {
      if (data[i][vendorNameColIndex - 1] && data[i][vendorNameColIndex - 1].toString().toLowerCase() === vendorName.toLowerCase()) {
        var record = {};
        for (var j = 0; j < headers.length; j++) {
          record[headers[j].toString()] = data[i][j];
        }
        history.push(record);
      }
    }
    
    return history;
  } catch (error) {
    Logger.log('Error in getVendorHistory: ' + error.toString());
    return [];
  }
}

// Function to handle GET requests for vendor history
function doGetVendorHistory(e) {
  try {
    var vendorName = e.parameter.vendorName || '';
    
    if (!vendorName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Vendor Name is required'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var history = getVendorHistory(vendorName);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      history: history
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error in doGetVendorHistory: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Function to handle GET requests for vendor search
function doGetVendors(e) {
  try {
    var itemName = e.parameter.itemName || '';
    var allVendors = [];
    
    if (itemName) {
      // Get vendors for specific item
      allVendors = getVendors(itemName);
    } else {
      // Get all vendors from vendor sheet
      try {
        var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        var vendorSheet = spreadsheet.getSheetByName('vendor');
        
        if (vendorSheet) {
          var lastRow = vendorSheet.getLastRow();
          if (lastRow > 1) {
            var headers = vendorSheet.getRange(1, 1, 1, vendorSheet.getLastColumn()).getValues()[0];
            var productNameColIndex = -1;
            var vendorNameColIndex = -1;
            var tierColIndex = -1;
            
            for (var i = 0; i < headers.length; i++) {
              var header = headers[i].toString().toLowerCase();
              // Look for product_name column in vendor sheet
              if (header === 'product_name' || header === 'product name') {
                productNameColIndex = i + 1;
              }
              if (header === 'vendor_name' || header === 'vendor name' || header === 'vendor') {
                vendorNameColIndex = i + 1;
              }
              if (header === 'tier') {
                tierColIndex = i + 1;
              }
            }
            
            if (productNameColIndex > 0 && vendorNameColIndex > 0) {
              var dataRange = vendorSheet.getRange(2, 1, lastRow - 1, vendorSheet.getLastColumn());
              var values = dataRange.getValues();
              var seen = {};
              
              for (var j = 0; j < values.length; j++) {
                var rowProductName = values[j][productNameColIndex - 1];
                var vendorName = values[j][vendorNameColIndex - 1];
                var tierValue = tierColIndex > 0 ? (values[j][tierColIndex - 1] || '').toString().trim() : '';
                
                if (rowProductName && vendorName) {
                  var key = rowProductName.toString().trim() + '|' + vendorName.toString().trim().toLowerCase();
                  if (!seen[key]) {
                    seen[key] = true;
                    allVendors.push({
                      vendor_name: vendorName.toString().trim(),
                      name: vendorName.toString().trim(),
                      itemName: rowProductName.toString().trim(),
                      product_name: rowProductName.toString().trim(),
                      tier: tierValue
                    });
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        Logger.log('Error getting all vendors: ' + err.toString());
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      vendors: allVendors
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}


