var SHEET_NAME = 'signups';

function doOptions() {
  return createJsonOutput({
    ok: true
  });
}

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    validatePayload(payload);

    var sheet = getSheet_();
    ensureHeader_(sheet);

    var friend = payload.friend || {};
    var selections = payload.selections || {};
    var attendee = payload.attendee || {};

    sheet.appendRow([
      new Date(),
      payload.activityId || '',
      payload.activityTitle || '',
      payload.submittedAt || '',
      attendee.lineUserId || '',
      attendee.displayName || '',
      attendee.pictureUrl || '',
      selections.joinGroup ? 'TRUE' : 'FALSE',
      selections.outsideGroup ? 'TRUE' : 'FALSE',
      friend.name || '',
      friend.gender || '',
      payload.appVersion || ''
    ]);

    return createJsonOutput({
      ok: true,
      message: 'Signup saved'
    });
  } catch (error) {
    return createJsonOutput({
      ok: false,
      message: error.message || 'Unknown error'
    });
  }
}

function getSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) {
    return;
  }

  sheet.appendRow([
    'createdAt',
    'activityId',
    'activityTitle',
    'submittedAt',
    'lineUserId',
    'displayName',
    'pictureUrl',
    'joinGroup',
    'outsideGroup',
    'friendName',
    'friendGender',
    'appVersion'
  ]);
}

function validatePayload(payload) {
  if (!payload || !payload.attendee || !payload.attendee.lineUserId) {
    throw new Error('Missing attendee.lineUserId');
  }

  if (!payload.activityId) {
    throw new Error('Missing activityId');
  }

  if (!payload.selections || (!payload.selections.joinGroup && !payload.selections.outsideGroup)) {
    throw new Error('At least one selection is required');
  }

  if (payload.selections.outsideGroup) {
    if (!payload.friend || !payload.friend.name || !payload.friend.gender) {
      throw new Error('Friend info is required when outsideGroup is selected');
    }
  }
}

function createJsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
