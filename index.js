/**
 * Inspired by https://developers.google.com/sheets/api/quickstart/nodejs?refresh=1
 */
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Sheets API.
  authorize(JSON.parse(content), listAstreints);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function getAstreintsFromSheet(auth, sheetName) {
    return new Promise((resolve, reject) => {
	const sheets = google.sheets({version: 'v4', auth});
	sheets.spreadsheets.values.get({
	    spreadsheetId: process.env.GOOGLE_SHEET_ID,
	    range: sheetName + '!A2:C',
	}, (err, res) => {
	    if (err) {
		reject('The API returned an error: ' + err);
		return;
	    }
	    const rows = res.data.values;
	    if (rows.length) {
		resolve({
		    sheetName: sheetName,
		    rows: rows.map((row) => {
			let r = {
			    firstName: row[0],
			    lastName: row[1],
			    number: row[2]
			};
			if (r.number && r.number.toString().indexOf('00') === 0) {
			    r.number = '+' + r.number.substr(2);
			}
			return r;
		    })
		});
	    } else {
		resolve({
		    sheetName: sheetName,
		    rows: []
		});
	    }
	});
    });
}

/**
 * Gets JSON for the different groups
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function listAstreints(auth) {
    const groups = {};
    const sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.get({
	spreadsheetId: process.env.GOOGLE_SHEET_ID
    }, (err, res) => {
	if (err) {
	  return console.log('The API returned an error: ' + err);
	}
	const sheetNames = res.data.sheets.map((sheet) => {
	    return sheet.properties.title;
	});
	const sheetPromises = sheetNames.map((name) => {
	    return getAstreintsFromSheet(auth, name);
	});
	Promise.all(sheetPromises).then(function (results) {
	    const groups = {};
	    for (let sheet of results) {
		groups[sheet.sheetName] = sheet.rows;
	    }
	    console.log(JSON.stringify(groups));
	});
    });
}
