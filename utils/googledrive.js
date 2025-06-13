// const { google } = require('googleapis');
// const stream = require('stream');
// const fs = require('fs');

// const encodedKey = process.env.GCP_SERVICE_KEY_BASE64;
// const decodedKey = Buffer.from(encodedKey, 'base64').toString('utf8');
// const credentials = JSON.parse(decodedKey);


// const auth = new google.auth.GoogleAuth({
//   credentials: credentials,
//   scopes: ['https://www.googleapis.com/auth/drive.file'],
// });

// const drive = google.drive({ version: 'v3', auth });

// async function uploadToGoogleDrive(file,email) {
//   const bufferStream = new stream.PassThrough();
//   bufferStream.end(file.buffer);

//   const response = await drive.files.create({
//     requestBody: {
//       name: file.originalname,
//       mimeType: file.mimetype,
//     },
//     media: {
//       mimeType: file.mimetype,
//       body: bufferStream,
//     },
//     fields: 'id, webViewLink',
//   });

//   // Make it public (optional)
//   await drive.permissions.create({
//     fileId: response.data.id,
//     requestBody: {
//       role: 'reader',
//       type: 'user',
//       emailAddress: email
//     },
//   });
//   await drive.permissions.create({
//     fileId: response.data.id,
//     requestBody: {
//       role: 'writer',
//       type: 'user',
//       emailAddress: 'manojpapneja@gmail.com'
//     },
//   });

//   return response.data; // { id, webViewLink }
// }

// module.exports = { uploadToGoogleDrive };


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

// Cache for folder IDs to avoid repeated API calls
const folderCache = new Map();

async function uploadToGoogleDrive(file, userEmail, userRole) {
  try {
    const bufferStream = new stream.PassThrough();
    bufferStream.end(file.buffer);

    // Get or create role-based folder
    const folderId = await getRoleBasedFolder(userRole);

    // Add timestamp and role to avoid naming conflicts
    const fileName = `${userRole}_${Date.now()}_${file.originalname}`;

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: file.mimetype,
        parents: [folderId], // Upload to role-specific folder
      },
      media: {
        mimeType: file.mimetype,
        body: bufferStream,
      },
      fields: 'id, webViewLink, name, parents',
    });

    // Share with the user
    if (userEmail) {
      try {
        await drive.permissions.create({
          fileId: response.data.id,
          requestBody: {
            role: 'reader',
            type: 'user',
            emailAddress: userEmail
          },
        });
        console.log(`File shared with ${userEmail}`);
      } catch (permissionError) {
        console.warn('Failed to share file with user:', permissionError.message);
        // Continue without failing the upload
      }
    }

    try {
            await drive.permissions.create({
                fileId: response.data.id,
                requestBody: {
                    role: 'reader', // Can view the file
                    type: 'anyone', // Anyone on the internet
                },
                // Does not return anything specific, but ensures permission is set
            });
            console.log(`File made public viewable (anyone with the link)`);
        } catch (publicPermissionError) {
            console.error('Failed to make file publicly viewable:', publicPermissionError.message);
            // This might be a critical error if public view is essential
        }

    console.log(`File uploaded successfully to ${userRole} folder: ${response.data.name} (ID: ${response.data.id})`);
    return response.data; // { id, webViewLink, name, parents }

  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw new Error(`Failed to upload file to Google Drive: ${error.message}`);
  }
}

async function getRoleBasedFolder(userRole) {
  const folderName = getFolderNameByRole(userRole);
  
  // Check cache first
  if (folderCache.has(folderName)) {
    return folderCache.get(folderName);
  }

  try {
    // Search for existing folder
    const searchResponse = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
    });

    let folderId;
    
    if (searchResponse.data.files.length > 0) {
      // Folder exists
      folderId = searchResponse.data.files[0].id;
      console.log(`Using existing folder: ${folderName} (ID: ${folderId})`);
    } else {
      // Create new folder
      folderId = await createRoleFolder(folderName);
    }

    // Cache the folder ID
    folderCache.set(folderName, folderId);
    return folderId;

  } catch (error) {
    console.error('Error getting role-based folder:', error);
    throw new Error(`Failed to get/create folder for role ${userRole}: ${error.message}`);
  }
}

async function createRoleFolder(folderName) {
  try {
    // Create folder
    const folderResponse = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id, name, webViewLink',
    });

    const folderId = folderResponse.data.id;
    console.log(`Created new folder: ${folderName} (ID: ${folderId})`);

    // Share folder with your personal Gmail
    const personalEmail = process.env.PERSONAL_GMAIL; // Add this to your environment variables
    if (personalEmail) {
      try {
        await drive.permissions.create({
          fileId: folderId,
          requestBody: {
            role: 'writer', // Give yourself write access
            type: 'user',
            emailAddress: personalEmail
          },
        });
        console.log(`Folder shared with personal Gmail: ${personalEmail}`);
      } catch (shareError) {
        console.warn('Failed to share folder with personal Gmail:', shareError.message);
      }
    }

    return folderId;

  } catch (error) {
    console.error('Error creating role folder:', error);
    throw new Error(`Failed to create folder ${folderName}: ${error.message}`);
  }
}

function getFolderNameByRole(userRole) {
  const folderNames = {
    'student': 'Resume Portal - Student Submissions',
    'tpo': 'Resume Portal - TPO Submissions',
    'admin': 'Resume Portal - Admin Submissions',
    'recruiter': 'Resume Portal - Recruiter Submissions'
  };
  
  return folderNames[userRole.toLowerCase()] || 'Resume Portal - Other Submissions';
}

async function downloadFromGoogleDrive(fileId) {
  try {
    const response = await drive.files.get({
      fileId: fileId,
      alt: 'media',
    }, {
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  } catch (error) {
    console.error('Error downloading from Google Drive:', error);
    throw new Error(`Failed to download file from Google Drive: ${error.message}`);
  }
}

async function deleteFromGoogleDrive(fileId) {
  try {
    await drive.files.delete({
      fileId: fileId,
    });
    console.log(`File deleted successfully: ${fileId}`);
    return true;
  } catch (error) {
    console.error('Error deleting from Google Drive:', error);
    throw new Error(`Failed to delete file from Google Drive: ${error.message}`);
  }
}

// Helper function to get file metadata
async function getFileInfo(fileId) {
  try {
    const response = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType, size, createdTime, webViewLink'
    });
    return response.data;
  } catch (error) {
    console.error('Error getting file info:', error);
    throw new Error(`Failed to get file info: ${error.message}`);
  }
}

module.exports = { 
  uploadToGoogleDrive, 
  downloadFromGoogleDrive, 
  deleteFromGoogleDrive,
  getFileInfo 
};