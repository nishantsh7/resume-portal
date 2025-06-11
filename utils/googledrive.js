const { google } = require('googleapis');
const stream = require('stream');
const fs = require('fs');

const path = '/etc/secrets/resume-service.json';

const raw = fs.readFileSync(path);
const credentials = JSON.parse(raw);

const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

async function uploadToGoogleDrive(file,email) {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(file.buffer);

  const response = await drive.files.create({
    requestBody: {
      name: file.originalname,
      mimeType: file.mimetype,
    },
    media: {
      mimeType: file.mimetype,
      body: bufferStream,
    },
    fields: 'id, webViewLink',
  });

  // Make it public (optional)
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'user',
      emailAddress: email
    },
  });

  return response.data; // { id, webViewLink }
}

module.exports = { uploadToGoogleDrive };
