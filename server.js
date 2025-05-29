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
const Joi = require('joi'); // Add this package: npm install joi
require('dotenv').config();

const app = express();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DB_USER', 'DB_PASS', 'DB_NAME', 'INSTANCE_CONNECTION_NAME'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars.join(', '));
    process.exit(1);
}

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(__dirname));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'resumes');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Create a safe filename
        let safeName = 'resume';
        
        if (req.body && req.body.fullName) {
            safeName = req.body.fullName.replace(/[^a-zA-Z0-9]/g, '_');
        }
        
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const finalName = `${safeName}-${uniqueSuffix}${path.extname(file.originalname)}`;
        
        req.resumeFileName = finalName;
        cb(null, finalName);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// MySQL Connection - Fixed to use single consistent connection
const db = mysql.createConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    socketPath: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
    acquireTimeout: 60000,
    // Remove 'timeout' - it's not a valid option for mysql2
    connectTimeout: 60000,  // Use connectTimeout instead
    ssl: false // Explicitly disable SSL for Unix socket connections
});

// Test database connection
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        console.error('Connection config:', {
            user: process.env.DB_USER,
            database: process.env.DB_NAME,
            socketPath: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
        });
        process.exit(1);
    }
    console.log('Database connected successfully');
});

// Handle connection errors
db.on('error', (err) => {
    console.error('Database error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Attempting to reconnect...');
        // For production, you might want to implement a more robust reconnection strategy
        setTimeout(() => {
            db.connect((reconnectErr) => {
                if (reconnectErr) {
                    console.error('Reconnection failed:', reconnectErr);
                } else {
                    console.log('Reconnected to database');
                }
            });
        }, 2000);
    }
});

// JWT Secret - No fallback for security
const JWT_SECRET = process.env.JWT_SECRET;

// Input validation schemas
const registerSchema = Joi.object({
    fullName: Joi.string().min(2).max(100).required().trim(),
    email: Joi.string().email().required().lowercase().trim(),
    password: Joi.string().min(8).max(128).required()
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
        .messages({
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        })
});

const loginSchema = Joi.object({
    email: Joi.string().email().required().lowercase().trim(),
    password: Joi.string().required()
});

const submissionSchema = Joi.object({
    fullName: Joi.string().min(2).max(100).required().trim(),
    mobile: Joi.string().pattern(/^[+]?[\d\s\-()]{10,15}$/).required().messages({
        'string.pattern.base': 'Please enter a valid mobile number'
    }),
    email: Joi.string().email().required().lowercase().trim(),
    institution: Joi.string().min(2).max(200).required().trim(),
    bio: Joi.string().max(1000).optional().trim()
});

// Validation middleware
const validateInput = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                error: error.details[0].message 
            });
        }
        req.body = value; // Use validated and sanitized data
        next();
    };
};

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
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Rate limiting for auth endpoints (basic implementation)
const authAttempts = new Map();
const rateLimitAuth = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const attempts = authAttempts.get(ip) || { count: 0, resetTime: now + 15 * 60 * 1000 };
    
    if (now > attempts.resetTime) {
        attempts.count = 0;
        attempts.resetTime = now + 15 * 60 * 1000;
    }
    
    if (attempts.count >= 5) {
        return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    
    attempts.count++;
    authAttempts.set(ip, attempts);
    next();
};

// Create admin user with secure hashed password
async function createAdminUser() {
    try {
        const adminPassword = process.env.ADMIN_PASSWORD || 'TempAdmin@123';
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        
        // Check if admin exists
        const [existingAdmin] = await new Promise((resolve, reject) => {
            db.query('SELECT id FROM users WHERE email = ?', ['team@stabforge.com'], (err, results) => {
                if (err) reject(err);
                else resolve([results]);
            });
        });

        if (existingAdmin.length === 0) {
            // Create admin user
            await new Promise((resolve, reject) => {
                db.query(
                    'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                    ['Admin User', 'team@stabforge.com', hashedPassword, 'admin'],
                    (err, results) => {
                        if (err) reject(err);
                        else resolve(results);
                    }
                );
            });
            console.log('Admin user created successfully');
        } else {
            // Update existing admin password
            await new Promise((resolve, reject) => {
                db.query(
                    'UPDATE users SET password_hash = ? WHERE email = ?',
                    [hashedPassword, 'team@stabforge.com'],
                    (err, results) => {
                        if (err) reject(err);
                        else resolve(results);
                    }
                );
            });
            console.log('Admin user password updated');
        }
    } catch (error) {
        console.error('Error managing admin user:', error);
    }
}

// Call createAdminUser when server starts
createAdminUser();

// Register endpoint (for students only)
app.post('/api/register', rateLimitAuth, validateInput(registerSchema), async (req, res) => {
    const { fullName, email, password } = req.body;
    
    try {
        // Check if user already exists
        const existingUser = await new Promise((resolve, reject) => {
            db.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
        
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
            
        const hashedPassword = await bcrypt.hash(password, 12);
        
        const result = await new Promise((resolve, reject) => {
            db.query(
                'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                [fullName, email, hashedPassword, 'student'],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });

        const token = jwt.sign(
            { userId: result.insertId, role: 'student' }, 
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.status(201).json({ 
            success: true,
            token, 
            message: 'Registration successful',
            user: {
                id: result.insertId,
                email: email,
                fullName: fullName,
                role: 'student'
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// Login endpoint
app.post('/api/login', rateLimitAuth, validateInput(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const users = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
            
        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
            
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
            
        const token = jwt.sign(
            { userId: user.id, role: user.role }, 
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// Submit profile and resume
app.post('/api/submit', verifyToken, (req, res) => {
    upload.single('resume')(req, res, async (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ error: 'File size too large. Maximum 5MB allowed.' });
                }
            }
            return res.status(400).json({ error: err.message });
        }

        // Validate form data
        const { error, value } = submissionSchema.validate(req.body);
        if (error) {
            // Clean up uploaded file if validation fails
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            return res.status(400).json({ error: error.details[0].message });
        }

        try {
            const { fullName, mobile, email, institution, bio } = value;
            const userId = req.userId;
            const resumeFile = req.file;

            if (!resumeFile) {
                return res.status(400).json({ error: 'Resume file is required' });
            }

            // Check if user already has a submission
            const existingSubmission = await new Promise((resolve, reject) => {
                db.query('SELECT id FROM submissions WHERE user_id = ?', [userId], (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });

            if (existingSubmission.length > 0) {
                // Clean up uploaded file
                fs.unlink(resumeFile.path, () => {});
                return res.status(400).json({ error: 'You have already submitted your profile' });
            }

            const result = await new Promise((resolve, reject) => {
                db.query(
                    `INSERT INTO submissions 
                    (user_id, full_name, mobile_number, email, institution, bio, resume_filename, resume_path)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, fullName, mobile, email, institution, bio || '', resumeFile.originalname, resumeFile.path],
                    (err, results) => {
                        if (err) reject(err);
                        else resolve(results);
                    }
                );
            });

            res.json({ 
                success: true, 
                message: 'Submission successful',
                submissionId: result.insertId
            });
        } catch (error) {
            console.error('Submission error:', error);
            // Clean up uploaded file on error
            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }
            res.status(500).json({ error: 'Failed to submit profile. Please try again.' });
        }
    });
});

// Get user's submission
app.get('/api/submission', verifyToken, async (req, res) => {
    try {
        const submissions = await new Promise((resolve, reject) => {
            db.query(
                'SELECT * FROM submissions WHERE user_id = ? ORDER BY submission_date DESC LIMIT 1',
                [req.userId],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });

        res.json({
            success: true,
            submission: submissions.length > 0 ? submissions[0] : null
        });
    } catch (error) {
        console.error('Error fetching submission:', error);
        res.status(500).json({ error: 'Failed to fetch submission' });
    }
});

// Admin: Get all submissions
app.get('/api/admin/submissions', verifyToken, requireAdmin, async (req, res) => {
    try {
        const submissions = await new Promise((resolve, reject) => {
            db.query(
                `SELECT s.*, u.email as user_email 
                 FROM submissions s 
                 JOIN users u ON s.user_id = u.id 
                 ORDER BY s.submission_date DESC`,
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });

        res.json({
            success: true,
            submissions: submissions
        });
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});

// Admin: Download all resumes
app.get('/api/admin/download-all', verifyToken, requireAdmin, async (req, res) => {
    try {
        const submissions = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM submissions', (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
        
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        res.attachment('all-resumes.zip');
        archive.pipe(res);

        for (const submission of submissions) {
            if (submission.resume_path && fs.existsSync(submission.resume_path)) {
                archive.file(submission.resume_path, { 
                    name: `${submission.full_name.replace(/[^a-zA-Z0-9]/g, '_')}-${submission.id}.pdf`
                });
            }
        }

        archive.on('error', (err) => {
            console.error('Archive error:', err);
            res.status(500).json({ error: 'Failed to create zip file' });
        });

        await archive.finalize();
    } catch (error) {
        console.error('Error creating zip:', error);
        res.status(500).json({ error: 'Failed to create zip file' });
    }
});

// Download single resume
app.get('/api/resume/:submissionId', verifyToken, async (req, res) => {
    try {
        const submissionId = parseInt(req.params.submissionId);
        if (isNaN(submissionId)) {
            return res.status(400).json({ error: 'Invalid submission ID' });
        }

        const submissions = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM submissions WHERE id = ?', [submissionId], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        if (submissions.length === 0 || !submissions[0].resume_path) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        const submission = submissions[0];

        // Check if user is admin or the owner of the submission
        if (req.userRole !== 'admin' && req.userId !== submission.user_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if file exists
        if (!fs.existsSync(submission.resume_path)) {
            return res.status(404).json({ error: 'Resume file not found' });
        }

        // Update is_downloaded status if admin is downloading
        if (req.userRole === 'admin') {
            db.query('UPDATE submissions SET is_downloaded = TRUE WHERE id = ?', [submissionId], () => {});
        }

        // Set proper headers for file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${submission.resume_filename}"`);
        
        // Send the file
        const absolutePath = path.resolve(submission.resume_path);
        res.sendFile(absolutePath, (err) => {
            if (err) {
                console.error('Download error:', err);
                return res.status(500).json({ error: 'Error downloading file' });
            }
        });
    } catch (error) {
        console.error('Resume download error:', error);
        res.status(500).json({ error: 'Failed to download resume' });
    }
});

// View single resume
app.get('/api/resume/view/:submissionId', verifyToken, async (req, res) => {
    try {
        const submissionId = parseInt(req.params.submissionId);
        if (isNaN(submissionId)) {
            return res.status(400).json({ error: 'Invalid submission ID' });
        }

        const submissions = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM submissions WHERE id = ?', [submissionId], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        if (submissions.length === 0 || !submissions[0].resume_path) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        const submission = submissions[0];

        // Check if user is admin or the owner of the submission
        if (req.userRole !== 'admin' && req.userId !== submission.user_id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if file exists
        if (!fs.existsSync(submission.resume_path)) {
            return res.status(404).json({ error: 'Resume file not found' });
        }

        // Set proper headers for PDF viewing in browser
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${submission.resume_filename}"`);
        
        // Send the file
        const absolutePath = path.resolve(submission.resume_path);
        res.sendFile(absolutePath, (err) => {
            if (err) {
                console.error('View error:', err);
                return res.status(500).json({ error: 'Error viewing file' });
            }
        });
    } catch (error) {
        console.error('Resume view error:', error);
        res.status(500).json({ error: 'Failed to view resume' });
    }
});

// Admin: Delete submission
app.delete('/api/admin/submission/:submissionId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const submissionId = parseInt(req.params.submissionId);
        if (isNaN(submissionId)) {
            return res.status(400).json({ error: 'Invalid submission ID' });
        }

        // Get submission details first to get the file path
        const submissions = await new Promise((resolve, reject) => {
            db.query('SELECT * FROM submissions WHERE id = ?', [submissionId], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        if (submissions.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const submission = submissions[0];

        // Delete the file if it exists
        if (submission.resume_path && fs.existsSync(submission.resume_path)) {
            fs.unlinkSync(submission.resume_path);
        }

        // Delete from database
        await new Promise((resolve, reject) => {
            db.query('DELETE FROM submissions WHERE id = ?', [submissionId], (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });

        res.json({ success: true, message: 'Submission deleted successfully' });
    } catch (error) {
        console.error('Delete submission error:', error);
        res.status(500).json({ error: 'Failed to delete submission' });
    }
});

// Admin: Update submission qualification status
app.put('/api/admin/submission/:submissionId/status', verifyToken, requireAdmin, async (req, res) => {
    try {
        const submissionId = parseInt(req.params.submissionId);
        if (isNaN(submissionId)) {
            return res.status(400).json({ error: 'Invalid submission ID' });
        }

        const { status } = req.body;
        const validStatuses = ['pending', 'qualified', 'disqualified'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        await new Promise((resolve, reject) => {
            db.query(
                'UPDATE submissions SET qualification_status = ? WHERE id = ?',
                [status, submissionId],
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });

        res.json({ success: true, message: 'Status updated successfully' });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// Admin: Download all records in Excel
app.get('/api/admin/download-records', verifyToken, requireAdmin, async (req, res) => {
    try {
        // Fetch all submissions
        const submissions = await new Promise((resolve, reject) => {
            db.query(
                `SELECT full_name, email, mobile_number, institution, 
                 DATE_FORMAT(submission_date, '%Y-%m-%d %H:%i:%s') as submission_date,
                 qualification_status
                 FROM submissions 
                 ORDER BY submission_date DESC`,
                (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                }
            );
        });

        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(submissions);

        // Set column widths
        const columnWidths = [
            { wch: 20 }, // full_name
            { wch: 25 }, // email
            { wch: 15 }, // mobile_number
            { wch: 30 }, // institution
            { wch: 20 }, // submission_date
            { wch: 15 }  // qualification_status
        ];
        worksheet['!cols'] = columnWidths;

        // Add the worksheet to the workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions');

        // Generate buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=submissions.xlsx');
        
        // Send the file
        res.send(excelBuffer);

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ error: 'Failed to generate Excel file' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.status(500).json({ 
        error: 'Internal server error',
        ...(isDevelopment && { details: err.message })
    });
});

// Handle 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    db.end(() => {
        console.log('Database connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    db.end(() => {
        console.log('Database connection closed');
        process.exit(0);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});