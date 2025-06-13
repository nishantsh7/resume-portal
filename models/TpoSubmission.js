const mongoose = require('mongoose');

// Define a schema for individual resume entries, including the student's name
const resumeSchema = new mongoose.Schema({
    studentName: {
        type: String,
        required: true // Student name is now a required field for each resume
    },
    originalName: {
        type: String,
        required: true // It's good practice to make this required
    },
    mimeType: {
        type: String,
        required: true // Also good practice to make this required
    },
    // You had 'size' here, but it's often not directly needed if using Google Drive for storage.
    // If your `uploadToGoogleDrive` function returns size, you can keep it.
    // size: Number,

    driveFileId: {
        type: String,
        required: true // ID of the file on Google Drive
    },
    // I've updated 'driveFileUrl' to 'driveViewLink' to match typical Google Drive API responses
    // and made it required as it's useful for direct access.
    driveViewLink: {
        type: String,
        required: true // Direct link to view the file on Google Drive
    },
    // You might also want to add a timestamp for when this specific resume was added/processed
    // resumeUploadedAt: { type: Date, default: Date.now }
}, { _id: false }); // _id: false means Mongoose won't create an _id for each embedded document

// Define the main TPO Submission Schema
const tpoSubmissionSchema = new mongoose.Schema({
    madeBy: {
        type: String,
        required: true
    },
    driveName: {
        type: String,
        required: true
    },
    branch: {
        type: String,
        required: true
    },
    batchYear: {
        type: Number,
        required: true
    },
    notes: {
        type: String
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true // Assuming uploadedBy should always be present
    },
    // The resumes array now uses the new resumeSchema
    resumes: [resumeSchema], // Embedded array of resume metadata, each with a student name
}, {
    timestamps: true // This will add createdAt and updatedAt fields to the main submission
});

module.exports = mongoose.model('TpoSubmission', tpoSubmissionSchema);