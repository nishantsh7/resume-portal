const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  originalName: String,
  mimeType: String,
  size: Number,
  driveFileId: String, // ID of the file on Google Drive
  driveFileUrl: String, // Optional direct link
}, { _id: false });

const tpoSubmissionSchema = new mongoose.Schema({
  madeBy: {type:String, required:true},
  driveName: { type: String, required: true },
  branch: { type: String, required: true },
  batchYear: { type: Number, required: true },
  notes: { type: String },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resumes: [fileSchema], // Embedded array of file metadata
}, {
  timestamps: true
});

module.exports = mongoose.model('TpoSubmission', tpoSubmissionSchema);
