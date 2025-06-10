const { google } = require('googleapis');
const stream = require('stream');


const encodedKey = process.env.GCP_SERVICE_KEY_BASE64;
const decodedKey = Buffer.from(encodedKey, 'base64').toString('utf8');
const credentials = JSON.parse(decodedKey);

const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

const drive = google.drive({ version: 'v3', auth });

async function uploadToGoogleDrive(file,userEmail) {
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
      emailAddress: userEmail
    },
  });

  return response.data; // { id, webViewLink }
}

module.exports = { uploadToGoogleDrive };
