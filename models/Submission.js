const mongoose = require('mongoose');
const fileSchema = new mongoose.Schema({
  originalName: String,
  mimeType: String,
  size: Number,
  driveFileId: String, // ID of the file on Google Drive
  driveFileUrl: String, // Optional direct link
}, { _id: false });

const submissionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    mobileNumber: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    institution: {
        type: String,
        required: true
    },
    bio: {
        type: String,
        required: true
    },
      resume: [fileSchema], // Embedded array of file metadata
    
    isDownloaded: {
        type: Boolean,
        default: false
    },
    qualificationStatus: {
        type: String,
        enum: ['pending', 'qualified', 'disqualified'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Submission', submissionSchema); 