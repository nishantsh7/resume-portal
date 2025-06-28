const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const archiver = require('archiver');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const FormData = require('form-data');
const axios = require('axios');



// const Joi = require('joi'); // Add this package: npm install joi
require('dotenv').config();
const User = require('./models/User');
const Submission = require('./models/Submission');
const TpoSubmission = require('./models/TpoSubmission');
const Resume = require('./models/Resume'); 
const { uploadToGoogleDrive,downloadFromGoogleDrive, getFileInfo } = require('./utils/googledrive');




const app = express();


// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['https://resume-portal-907r.onrender.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));





// Configure multer for file upload

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});
// MySQL Connection - Fixed to use single consistent connection
mongoose.connect(process.env.CONNECTION_STRING, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('MongoDB connected successfully');
    createAdminUser();
})
.catch(err => {
    console.error('MongoDB connection error:', err);
});



// JWT Secret - No fallback for security
const JWT_SECRET = process.env.JWT_SECRET;



// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No valid token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
    if (req.userRole !== 'admin' ) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

const requireRecruiter=(req,res,next)=>{
    if(req.userRole !== 'recruiter'){
        return res.status(403).json({ error: 'Recruiter access required' });
    }
    next();
}

async function createAdminUser() {
    try {
        const adminEmail = 'team@stabforge.com'
        const adminPassword = process.env.ADMIN_PASSWORD || 'TempAdmin@123';
        hashedPassword = await bcrypt.hash(adminPassword, 10);
        
         const existingAdmin = await User.findOne({ email: adminEmail });

if (!existingAdmin) {
    // Create admin user
    const adminUser = new User({
        fullName: 'Admin',
        email: adminEmail,
        passwordHash: adminPassword,
        role: 'admin'
    });
    await adminUser.save();
    console.log('Admin user created successfully');
}
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

    


// Call createAdminUser when server starts
createAdminUser();

// Register endpoint (for students only)
app.post('/api/register', async (req, res) => {
    const { fullName, email, passwordHash,role } = req.body;
    
    if (!fullName || !email || !passwordHash || !role) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    try {
        const existingUser = await User.findOne({ email });
        
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        const user = await User.create({
            fullName,
            email,
            passwordHash,
            role
        });

        const token = jwt.sign({ userId: user._id, role: role }, JWT_SECRET);
        res.status(201).json({ token, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    console.log('Login attempt received:', req.body.email);
    const { email, password } = req.body;
    
    if (!email || !password) {
        console.log('Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    try {
        const user = await User.findOne({ email });
        console.log('User found:', !!user);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
            
        const validPassword = await user.comparePassword(password);
        console.log('Password valid:', validPassword);
            
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
            
        const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET);
        console.log('Login successful for:', email);
        
        // If user is a student, get their submission to get the full name
        let fullName = user.fullName;
        if (user.role === 'student') {
            const submission = await Submission.findOne({ userId: user._id });
            if (submission) {
                fullName = submission.fullName;
            }
        }
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                fullName: fullName
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
// Submit profile and resume
// app.post('/api/submit', verifyToken, upload.single('resume'), async (req, res) => {
//     try {
        
//         // Check if user already has a submission
//         let submission = await Submission.findOne({ userId: req.userId });
        
//         // If old resume exists and new resume is uploaded, delete the old one from Google Drive
//         if (submission && submission.resume && submission.resume.driveFileId && req.file) {
//             try {
//                 await deleteFromGoogleDrive(submission.resume.driveFileId);
//                 console.log(`Deleted old resume from Drive: ${submission.resume.originalName}`);
//             } catch (deleteError) {
//                 console.error('Error deleting old resume from Drive:', deleteError);
//                 // Continue with the update even if delete fails
//             }
//         }

//         const updateData = {
//             fullName: req.body.fullName,
//             mobileNumber: req.body.mobile,
//             email: req.body.email,
//             institution: req.body.institution,
//             bio: req.body.bio
//         };

//         // Only update resume data if a new file was uploaded
//         if (req.file) {
//             try {
//     const form = new FormData();
//     form.append('file', req.file.buffer, req.file.originalname);

//     const affindaRes = await axios.post(
//       'https://api.affinda.com/v2/resumes',
//       form,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.AFFINDA_API_KEY}`,
//           ...form.getHeaders(),
//         },
//       }
//     );

//     const resumeData = affindaRes.data.data;

//     const structured = {
//       name: resumeData.name?.raw || '',
//       email: resumeData.emails?.[0] || '',
//       phone: resumeData.phoneNumbers?.[0] || '',
//       skills: resumeData.skills?.map(s => s.name) || [],
//       experience: resumeData.totalYearsExperience || 0,
//       projects: (resumeData.projects || []).map(p => ({
//         name: p.name,
//         description: p.description,
//       })),
//     };

//     const savedResume = await Resume.create(structured);

//     const driveRes = await uploadToGoogleDrive(req.file, req.body.email, "student");
//     const resume = {
//       originalName: req.file.originalname,
//       mimeType: req.file.mimetype,
//       driveFileId: driveRes.id,
//       driveViewLink: driveRes.webViewLink,
//     };

//     updateData.resume = resume;

//     res.json({ success: true, savedResume });
//   } catch (driveUploadError) {
//     console.error('Error uploading to Google Drive:', driveUploadError);
//     return res.status(500).json({ error: 'Failed to upload resume to Google Drive' });
//   }
// }

//         if (submission) {
//             // Update existing submission
//             submission = await Submission.findOneAndUpdate(
//                 { userId: req.userId },
//                 updateData,
//                 { new: true }
//             );
//             res.json({
//                 message: 'Profile updated successfully',
//                 submission
//             });
//         } else {
//             // Create new submission
//             if (!req.file) {
//                 return res.status(400).json({ error: 'Resume file is required for initial submission' });
//             }
            
//             try {
//                 const driveRes = await uploadToGoogleDrive(req.file, req.body.email,"student");
//                 const resume = {
//                     originalName: req.file.originalname,
//                     mimeType: req.file.mimetype,
//                     driveFileId: driveRes.id,
//                     driveViewLink: driveRes.webViewLink
//                 };

//                 submission = await Submission.create({
//                     userId: req.userId,
//                     ...updateData,
//                     resume: resume
//                 });

//                 res.status(201).json({
//                     message: 'Profile submitted successfully',
//                     submission
//                 });
//             } catch (driveUploadError) {
//                 console.error('Error uploading to Google Drive:', driveUploadError);
//                 return res.status(500).json({ error: 'Failed to upload resume to Google Drive' });
//             }
//         }
//     } catch (error) {
//         console.error('Submission error:', error);
//         res.status(500).json({ error: 'Error submitting profile' });
//     }
// });


app.post('/api/submit', verifyToken, upload.single('resume'), async (req, res) => {
    try {
        // Check if user already has a submission
        let submission = await Submission.findOne({ userId: req.userId });

        // Delete old resume from Drive if new one is uploaded
        if (submission?.resume?.driveFileId && req.file) {
            try {
                await deleteFromGoogleDrive(submission.resume.driveFileId);
                console.log(`Deleted old resume from Drive: ${submission.resume.originalName}`);
            } catch (deleteError) {
                console.error('Error deleting old resume from Drive:', deleteError);
            }
        }

        const updateData = {
            fullName: req.body.fullName,
            mobileNumber: req.body.mobile,
            email: req.body.email,
            institution: req.body.institution,
            bio: req.body.bio
        };

        let savedResume = null;

        // Upload and parse new resume if provided
        if (req.file) {
            try {
                const form = new FormData();
                form.append('file', req.file.buffer, req.file.originalname);

                const affindaRes = await axios.post(
                    'https://api.affinda.com/v2/resumes',
                    form,
                    {
                        headers: {
                            Authorization: `Bearer ${process.env.AFFINDA_API_KEY}`,
                            ...form.getHeaders()
                        }
                    }
                );

                const resumeData = affindaRes.data.data;
                // console.log('Parsed resume data:', resumeData);

                                const structured = {
                    name: resumeData.name?.raw || '',
                    email: resumeData.emails?.[0] || '',
                    phone: resumeData.phoneNumbers?.[0] || '',
                    linkedIn: resumeData.linkedin || '',
                    skills: resumeData.skills?.map(s => s.name) || [],
                    workExperience: resumeData.workExperience?.map(exp => ({
                        jobTitle: exp.jobTitle,
                        organization: exp.organization,
                        dates: exp.dates,
                        jobDescription: exp.jobDescription
                    })) || [],
                    experience: resumeData.totalYearsExperience || 0,
                    projects: (resumeData.sections || [])
                        .filter(s => s.sectionType === 'Projects')
                        .map(s => ({ details: s.text })),
                    profession: resumeData.profession || '',
                    };


                savedResume = await Resume.create(structured);

                const driveRes = await uploadToGoogleDrive(req.file, req.body.email, "student");
                updateData.resume = {
                    originalName: req.file.originalname,
                    mimeType: req.file.mimetype,
                    driveFileId: driveRes.id,
                    driveViewLink: driveRes.webViewLink
                };
            } catch (uploadError) {
                console.error('Error uploading to Google Drive:', uploadError);
                return res.status(500).json({ error: 'Failed to upload resume to Google Drive' });
            }
        }

        if (submission) {
            // Update existing submission
            const updated = await Submission.findOneAndUpdate(
                { userId: req.userId },
                updateData,
                { new: true }
            );
            return res.json({
                message: 'Profile updated successfully',
                submission: updated,
                savedResume
            });
        } else {
            // Require resume on initial submission
            if (!req.file) {
                return res.status(400).json({ error: 'Resume file is required for initial submission' });
            }

            const created = await Submission.create({
                userId: req.userId,
                ...updateData
            });

            return res.status(201).json({
                message: 'Profile submitted successfully',
                submission: created,
                savedResume
            });
        }
    } catch (error) {
        console.error('Submission error:', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Error submitting profile' });
        }
    }
});

// Initialized with OAuth2 or service accoun


// const router = express.Router();
// const upload = multer({ storage: multer.memoryStorage() });
const uploads = multer({ storage: multer.memoryStorage() });

app.post('/api/tpo/upload-resumes', verifyToken, uploads.array('resumeFiles[]'), async (req, res) => {
    try {
        // Destructure static body fields and the new studentNames array
        const { driveName, branch, batchYear, notes, userEmail, studentNames } = req.body;
        const files = req.files; // Multer parses files into req.files

        // --- New Validations for dynamic inputs ---
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No resume files uploaded' });
        }
        if (!studentNames || !Array.isArray(studentNames) || studentNames.length === 0) {
            return res.status(400).json({ error: 'No student names provided or invalid format' });
        }
        if (studentNames.length !== files.length) {
            return res.status(400).json({ error: 'Mismatch: Number of student names does not match number of resume files.' });
        }
        // --- End New Validations ---

        // Debug logs
        console.log('Request body (static fields):', { driveName, branch, batchYear, notes, userEmail });
        console.log('Student Names:', studentNames); // Log the student names array
        console.log('Files count:', files.length);

        const savedFiles = await Promise.all(
            files.map(async (file, index) => {
                try {
                    // Get the corresponding student name for this file
                    const studentName = studentNames[index];
                    console.log(`Uploading file ${index + 1} for student "${studentName}":`, file.originalname);
                    const form = new FormData();
                form.append('file', file.buffer, file.originalname);

                const affindaRes = await axios.post(
                    'https://api.affinda.com/v2/resumes',
                    form,
                    {
                        headers: {
                            Authorization: `Bearer ${process.env.AFFINDA_API_KEY}`,
                            ...form.getHeaders()
                        }
                    }
                );

                const resumeData = affindaRes.data.data;
                // console.log('Parsed resume data:', resumeData);
                              const structured = {
                    name: resumeData.name?.raw || '',
                    email: resumeData.emails?.[0] || '',
                    phone: resumeData.phoneNumbers?.[0] || '',
                    linkedIn: resumeData.linkedin || '',
                    skills: resumeData.skills?.map(s => s.name) || [],
                    workExperience: resumeData.workExperience?.map(exp => ({
                        jobTitle: exp.jobTitle,
                        organization: exp.organization,
                        dates: exp.dates,
                        jobDescription: exp.jobDescription
                    })) || [],
                    experience: resumeData.totalYearsExperience || 0,
                    projects: (resumeData.sections || [])
                        .filter(s => s.sectionType === 'Projects')
                        .map(s => ({ details: s.text })),
                    profession: resumeData.profession || '',
                    };


                savedResume = await Resume.create(structured);

                    const driveRes = await uploadToGoogleDrive(file, userEmail,"tpo"); // Assuming userEmail for folder context

                    return {
                        studentName: studentName, // Store the student name with the file details
                        originalName: file.originalname,
                        mimeType: file.mimetype,
                        driveFileId: driveRes.id,
                        driveViewLink: driveRes.webViewLink,
                    };
                } catch (fileError) {
                    console.error(`Error uploading file ${file.originalname} for student ${studentNames[index]}:`, fileError);
                    throw new Error(`Failed to upload ${file.originalname}: ${fileError.message}`);
                }
            })
        );

        // Create submission according to your schema
        // Ensure your TpoSubmission schema can store an array of objects for resumes,
        // where each object contains 'studentName' along with other file details.
        const submission = await TpoSubmission.create({
            madeBy: userEmail, // Required string field - using email from form
            uploadedBy: req.userId, // ObjectId reference to User
            driveName,
            branch,
            batchYear: parseInt(batchYear), // Ensure it's a number
            notes,
            resumes: savedFiles, // 'savedFiles' now includes 'studentName' for each entry
        });

        console.log('Submission created:', submission._id);
        res.json({ message: `${files.length} resumes uploaded successfully.` });
    } catch (error) {
        console.error('Upload error details:', error);
        res.status(500).json({
            error: 'Upload failed. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});
app.get("/api/tpo/recent-submissions",verifyToken,async (req, res) => {
  try {
    const email= req.query.email;
    console.log("email at submissions:",email);
    const submissions = await TpoSubmission.find({ madeBy:email })
      .sort({ createdAt: -1 })
      .limit(10);
      console.log("Recent submissions:", submissions);

    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: "No uploads yet." });
  }
});







// Get user's submission
app.get('/api/submission', verifyToken, async (req, res) => {
    try {
        const submission = await Submission.findOne({ userId: req.userId });
        res.json({ submission });
    } catch (error) {
        console.error('Error fetching submission:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/recruiter/submissions', verifyToken, requireRecruiter, async (req, res) => {
  try {
    // Import the Resume model at the top of your file if not already done
    // const Resume = require('./models/Resume'); // Adjust path as needed

    // Fetch student submissions
    const studentSubmissions = await Submission.find().populate('userId', 'email fullName').lean();

    const formattedStudentSubmissions = await Promise.all(
      studentSubmissions.map(async (sub) => {
        // Find corresponding resume data by email
        const resumeData = await Resume.findOne({ 
          email: sub.email 
        }).lean();
        
        return {
          type: 'student',
          fullName: sub.fullName,
          email: sub.email,
          mobile: sub.mobileNumber,
          institution: sub.institution,
          createdAt: sub.createdAt,
          tpoName: '',
          driveLink: `https://drive.google.com/file/d/${sub.resume?.[0]?.driveFileId}/view` || '',
          status: sub.qualificationStatus || 'pending',
          downloaded: sub.isDownloaded || false,
          // Add resume data
          skills: resumeData?.skills || [],
          experience: resumeData?.experience || 0,
          phone: resumeData?.phone || '',
          linkedIn: resumeData?.linkedIn || '',
          workExperience: resumeData?.workExperience || [],
          projects: resumeData?.projects || [],
          profession: resumeData?.profession || '',
          _id: sub._id
        };
      })
    );

    // Fetch TPO submissions
    const tpoSubmissions = await TpoSubmission.find().populate('uploadedBy', 'fullName email').lean();

    const formattedTpoSubmissions = [];

    for (const sub of tpoSubmissions) {
      for (const resume of sub.resumes) {
        // Try to find resume data by multiple criteria
        const resumeData = await Resume.findOne({ 
        name: resume.studentName
        }).lean();

        formattedTpoSubmissions.push({
          type: 'tpo',
          fullName: resume.studentName,
          email: resume.email || '',
          mobile: resume.phone || '',
          institution: sub.branch || '',
          createdAt: sub.createdAt,
          tpoName: sub.uploadedBy?.fullName || '',
          driveLink: resume.driveViewLink,
          status: 'pending',
          downloaded: false,
          // Add resume data
          skills: resumeData?.skills || [],
          experience: resumeData?.experience || 0,
          phone: resumeData?.phone || '',
          linkedIn: resumeData?.linkedIn || '',
          workExperience: resumeData?.workExperience || [],
          projects: resumeData?.projects || [],
          profession: resumeData?.profession || '',
          _id: sub._id
        });
      }
    }

    // Combine & sort by submission date
    const allSubmissions = [...formattedStudentSubmissions, ...formattedTpoSubmissions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(allSubmissions);
  } catch (error) {
    console.error('Error fetching combined submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions.' });
  }
});







// Admin: Get all submissions
app.get('/api/submissions', verifyToken, requireAdmin, async (req, res) => {
  try {
    // Import the Resume model at the top of your file if not already done
    // const Resume = require('./models/Resume'); // Adjust path as needed

    // Fetch student submissions
    const studentSubmissions = await Submission.find().populate('userId', 'email fullName').lean();

    const formattedStudentSubmissions = await Promise.all(
      studentSubmissions.map(async (sub) => {
        // Find corresponding resume data by email
        const resumeData = await Resume.findOne({ 
          email: sub.email 
        }).lean();
        
        return {
          type: 'student',
          fullName: sub.fullName,
          email: sub.email,
          mobile: sub.mobileNumber,
          institution: sub.institution,
          createdAt: sub.createdAt,
          tpoName: '',
          driveLink: `https://drive.google.com/file/d/${sub.resume?.[0]?.driveFileId}/view` || '',
          status: sub.qualificationStatus || 'pending',
          downloaded: sub.isDownloaded || false,
          // Add resume data
          skills: resumeData?.skills || [],
          experience: resumeData?.experience || 0,
          phone: resumeData?.phone || '',
          linkedIn: resumeData?.linkedIn || '',
          workExperience: resumeData?.workExperience || [],
          projects: resumeData?.projects || [],
          profession: resumeData?.profession || '',
          _id: sub._id
        };
      })
    );

    // Fetch TPO submissions
    const tpoSubmissions = await TpoSubmission.find().populate('uploadedBy', 'fullName email').lean();

    const formattedTpoSubmissions = [];

    for (const sub of tpoSubmissions) {
      for (const resume of sub.resumes) {
        // Try to find resume data by multiple criteria
        const resumeData = await Resume.findOne({ 
        name: resume.studentName
        }).lean();

        formattedTpoSubmissions.push({
          type: 'tpo',
          fullName: resume.studentName,
          email: resume.email || '',
          mobile: resume.phone || '',
          institution: sub.branch || '',
          createdAt: sub.createdAt,
          tpoName: sub.uploadedBy?.fullName || '',
          driveLink: resume.driveViewLink,
          status: 'pending',
          downloaded: false,
          // Add resume data
          skills: resumeData?.skills || [],
          experience: resumeData?.experience || 0,
          phone: resumeData?.phone || '',
          linkedIn: resumeData?.linkedIn || '',
          workExperience: resumeData?.workExperience || [],
          projects: resumeData?.projects || [],
          profession: resumeData?.profession || '',
          _id: sub._id
        });
      }
    }

    // Combine & sort by submission date
    const allSubmissions = [...formattedStudentSubmissions, ...formattedTpoSubmissions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(allSubmissions);
  } catch (error) {
    console.error('Error fetching combined submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions.' });
  }
});

// Admin: Download all resumes
app.put('/api/submissions/:id/status', verifyToken, requireAdmin, async (req, res) => {
    try {
        const submission = await Submission.findByIdAndUpdate(
            req.params.id,
            { qualificationStatus: req.body.status },
            { new: true }
        );
        
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        res.json({ success: true, submission });
    } catch (error) {
        console.error('Error updating submission status:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Mark resume as downloaded
app.put('/api/submissions/:id/downloaded', verifyToken, requireAdmin, async (req, res) => {
    try {
        const submission = await Submission.findByIdAndUpdate(
            req.params.id,
            { isDownloaded: true },
            { new: true }
        );
        
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        res.json({ success: true, submission });
    } catch (error) {
        console.error('Error marking resume as downloaded:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// View resume endpoint
// Import your Google Drive functions at the top of your file
// const { downloadFromGoogleDrive, getFileInfo } = require('./'); // Adjust path as needed

app.get('/api/resume/view/:id', verifyToken, async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        
        if (!submission) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Check if user has permission to view this resume
        if (req.userRole !== 'admin' && submission.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const fileId = submission.resume[0].driveFileId;
        
        if (!fileId) {
            return res.status(404).json({ error: 'File ID not found' });
        }

        // Get file metadata first to set proper headers
        const fileInfo = await getFileInfo(fileId);
        
        // Download file from Google Drive
        const fileBuffer = await downloadFromGoogleDrive(fileId);
        
        // Set appropriate headers
        res.set({
            'Content-Type': fileInfo.mimeType || 'application/octet-stream',
            'Content-Length': fileBuffer.length,
            'Content-Disposition': `inline; filename="${fileInfo.name}"`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // Send the file buffer
        res.send(fileBuffer);
        
    } catch (error) {
        console.error('Error serving resume:', error);
        
        // Handle specific Google Drive errors
        if (error.message.includes('File not found')) {
            return res.status(404).json({ error: 'File not found in Google Drive' });
        }
        
        if (error.message.includes('Access denied') || error.message.includes('Forbidden')) {
            return res.status(403).json({ error: 'Access denied to file' });
        }
        
        res.status(500).json({ error: 'Server error while fetching file' });
    }
});

// Alternative endpoint if you want to return file as base64 for frontend handling
app.get('/api/resume/view-base64/:id', verifyToken, async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        
        if (!submission) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Check if user has permission to view this resume
        if (req.userRole !== 'admin' && submission.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const fileId = submission.resume[0].driveFileId;
        
        if (!fileId) {
            return res.status(404).json({ error: 'File ID not found' });
        }

        // Get file metadata and download file
        const [fileInfo, fileBuffer] = await Promise.all([
            getFileInfo(fileId),
            downloadFromGoogleDrive(fileId)
        ]);
        
        // Convert to base64 and send as JSON
        const base64File = fileBuffer.toString('base64');
        
        res.json({
            fileName: fileInfo.name,
            mimeType: fileInfo.mimeType,
            size: fileInfo.size,
            fileData: base64File,
            webViewLink: fileInfo.webViewLink
        });
        
    } catch (error) {
        console.error('Error serving resume as base64:', error);
        
        if (error.message.includes('File not found')) {
            return res.status(404).json({ error: 'File not found in Google Drive' });
        }
        
        if (error.message.includes('Access denied') || error.message.includes('Forbidden')) {
            return res.status(403).json({ error: 'Access denied to file' });
        }
        
        res.status(500).json({ error: 'Server error while fetching file' });
    }
});

// Download resume endpoint
app.get('/api/resume/:id', verifyToken, async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.id);
        
        if (!submission) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Check if user has permission to download this resume
        if (req.userRole !== 'admin' && submission.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const filePath = path.join(__dirname, submission.resumePath);
        
        if (fs.existsSync(filePath)) {
            // Update download status if admin is downloading
            if (req.userRole === 'admin') {
                submission.isDownloaded = true;
                await submission.save();
            }

            // Set headers for file download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=' + submission.resumeFilename);
            res.sendFile(filePath);
        } else {
            res.status(404).json({ error: 'Resume file not found' });
        }
    } catch (error) {
        console.error('Error downloading resume:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Download all resumes endpoint (admin only)
app.get('/api/download-all-resumes', verifyToken, requireAdmin, async (req, res) => {
    try {
        const submissions = await Submission.find();
        const archive = archiver('zip');
        
        archive.on('error', (err) => {
            res.status(500).json({ error: 'Error creating zip file' });
        });
        
        res.attachment('all-resumes.zip');
        archive.pipe(res);
        
        for (const submission of submissions) {
            const filePath = path.join(__dirname, submission.resumePath);
            if (fs.existsSync(filePath)) {
                archive.file(filePath, { name: `${submission.fullName}-resume.pdf` });
            }
        }
        
        await archive.finalize();
    } catch (error) {
        console.error('Error downloading all resumes:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Download records as Excel (admin only)
app.post('/api/download-records', verifyToken, requireAdmin, async (req, res) => {
    try {
        
         const {records}= req.body;
        if (!Array.isArray(records)) {
        return res.status(400).json({ error: 'Records must be an array' });
    }
        
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(records.map(s => ({
            'Full Name': s.fullName,
            'Email': s.email,
            'Mobile': s.mobileNumber,
            'Institution': s.institution,
            'Profession': s.profession,
            'TPO Name': s.tpoName || '',
            'Drive Link': s.driveLink || '',
            'Submission Date': new Date(s.createdAt).toLocaleDateString('en-GB')
        })));
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions');
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=submissions.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Error downloading records:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/recruiter/download-records', verifyToken, requireRecruiter, async (req, res) => {
    try {
        // const submissions = await Submission.find().populate('userId', 'email');
        // const tpoSubmissions = await TpoSubmission.find().populate('uploadedBy', 'fullName email').lean();
        const {records}= req.body;
        if (!Array.isArray(records)) {
        return res.status(400).json({ error: 'Records must be an array' });
    }
        
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(records.map(s => ({
            'Full Name': s.fullName,
            'Email': s.email,
            'Mobile': s.mobileNumber,
            'Institution': s.institution,
            'Profession': s.profession,
            'TPO Name': s.tpoName || '',
            'Drive Link': s.driveLink || '',
            'Submission Date': new Date(s.createdAt).toLocaleDateString('en-GB')
        })));
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions');
        
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=submissions.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Error downloading records:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 