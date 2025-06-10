const { google } = require('googleapis');
const stream = require('stream');


const serviceAccountKey = JSON.parse(process.env.GCP_SERVICE_KEY.replace(/\\n/g, '\n'));

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccountKey,
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
