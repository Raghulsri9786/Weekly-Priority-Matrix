
/**
 * MATRIX PRO - GOOGLE SHEETS DATABASE ENGINE
 * Database: Google Sheets
 * Project: weekly-plan-484317
 */

function getDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const users = ss.getSheetByName('USERS') || ss.insertSheet('USERS');
  const archives = ss.getSheetByName('ARCHIVES') || ss.insertSheet('ARCHIVES');
  
  // Ensure headers exist
  if (users.getLastRow() === 0) {
    users.appendRow(['userId', 'name', 'email', 'createdAt']);
    users.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#f1f5f9');
  }
  if (archives.getLastRow() === 0) {
    archives.appendRow(['archiveId', 'userId', 'weekData', 'timestamp']);
    archives.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#f1f5f9');
  }
  
  return { users, archives };
}

function doPost(e) {
  const { users, archives } = getDatabase();
  let payload;
  
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return createResponse({ success: false, error: 'Invalid JSON payload' });
  }

  const action = payload.action;

  try {
    if (action === 'login') {
      const email = payload.email.toLowerCase().trim();
      const name = payload.name.trim();
      
      const userData = users.getDataRange().getValues();
      // Column index 2 is 'email' (0: userId, 1: name, 2: email)
      let userRow = userData.find(r => r[2].toString().toLowerCase() === email);
      
      let userObj;
      if (userRow) {
        // User exists: Retrieve details
        userObj = { 
          id: userRow[0], 
          name: userRow[1], 
          email: userRow[2] 
        };
      } else {
        // User doesn't exist: Create new entry
        const userId = 'U-' + Utilities.getUuid().substring(0, 8).toUpperCase();
        users.appendRow([userId, name, email, new Date().toISOString()]);
        userObj = { id: userId, name: name, email: email };
      }
      
      return createResponse({
        success: true,
        user: userObj
      });
    }

    if (action === 'archive') {
      const archiveId = 'A-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      archives.appendRow([
        archiveId, 
        payload.userId, 
        JSON.stringify(payload.rows), 
        new Date().toISOString()
      ]);
      return createResponse({ success: true, archiveId });
    }
    
    return createResponse({ success: false, error: 'Unknown action: ' + action });
    
  } catch (err) {
    return createResponse({ success: false, error: err.toString() });
  }
}

function createResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
