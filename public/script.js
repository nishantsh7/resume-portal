// Check if user is logged in and redirect based on role
function checkAuth() {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const currentPage = window.location.pathname;

    if (!token) {
        if (!currentPage.includes('index.html') && !currentPage.includes('signup.html')) {
            window.location.href = 'index.html';
        }
        return;
    }

    // Redirect based on role
    if (userRole === 'admin') {
        if (currentPage.includes('dashboard.html')) {
            window.location.href = 'admin.html';
        }
    } else if(userRole==="student"){
        if (currentPage.includes('admin.html')) {
            window.location.href = 'dashboard.html';
        }
    }
    else if(userRole==="tpo"){
        if (currentPage.includes('admin.html')) {
            window.location.href = 'tpo-dashboard.html';
        }
    }
    else{
        if(currentPage.includes('admin.html')){
            window.location.href='recruiter-dashboard.html'
        }
    }
}
const userEmail= localStorage.getItem('userEmail');
// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const spinner = document.getElementById('loginSpinner');
    
    try {
        spinner.style.display = 'inline-block';
        console.log('Attempting login...');
        
        const response = await fetch('https://resume-portal-907r.onrender.com/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        
        console.log('Login successful');
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userName', data.user.fullName || data.user.email);
        if(data.user.collegeName)
        localStorage.setItem('collegeName',data.user.collegeName);
        
        // Redirect based on role
        if (data.user.role === 'admin') 
            window.location.href = 'admin.html';
        else if(data.user.role==='student')
            window.location.href = 'dashboard.html';
        else if(data.user.role==='tpo')
            window.location.href='tpo-dashboard.html';
        else 
        window.location.href='recruiter-dashboard.html';

        
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message || 'Failed to connect to server. Please make sure the server is running.');
    } finally {
        spinner.style.display = 'none';
    }
}
document.addEventListener("DOMContentLoaded", function () {
  const roleRadios = document.querySelectorAll('input[name="role"]');
  const collegeContainer = document.getElementById('collegeFieldContainer');
  const collegeInput = document.getElementById('collegeName');

  roleRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'student' || radio.value === 'tpo') {
        collegeContainer.style.display = 'block';
        collegeInput.required = true;
      } else {
        collegeContainer.style.display = 'none';
        collegeInput.required = false;
      }
    });
  });
});


// Handle signup form submission
async function handleSignup(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const spinner = document.getElementById('signupSpinner');
    const role = document.querySelector('input[name="role"]:checked').value;
    

    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    try {
        spinner.style.display = 'inline-block';
        
        const response = await fetch('https://resume-portal-907r.onrender.com/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fullName, email, passwordHash: password, role  })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        alert('Registration successful! Please login.');
        window.location.href = 'index.html';
    } catch (error) {
        alert(error.message);
    } finally {
        spinner.style.display = 'none';
    }
}

// Handle profile form submission
async function handleProfileSubmit(event) {
    event.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const mobile = document.getElementById('mobile').value.trim();
    const email = document.getElementById('email').value.trim();
    const institution = document.getElementById('institution').value.trim();
    const bio = document.getElementById('bio').value.trim();
    const resumeFile = document.getElementById('resumeFile').files[0];
    const spinner = document.getElementById('submitSpinner');
    
    // Basic validation
    if (!fullName || !mobile || !email || !institution || !bio) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
    }
    
    // Check if this is an initial submission
    const form = event.target;
    const isUpdate = !!form.dataset.submissionId;
    
    if (!isUpdate && !resumeFile) {
        alert('Please upload your resume for initial submission');
        return;
    }
    
    // File type validation (if file is provided)
    if (resumeFile) {
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(resumeFile.type)) {
            alert('Please upload only PDF or Word documents');
            return;
        }
        
        // File size validation (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (resumeFile.size > maxSize) {
            alert('File size must be less than 10MB');
            return;
        }
    }
    
    const formData = new FormData();
    formData.append('fullName', fullName);
    formData.append('mobile', mobile);
    formData.append('email', email);
    formData.append('institution', institution);
    formData.append('bio', bio);
    if (resumeFile) {
        formData.append('resume', resumeFile);
    }
    
    try {
        spinner.style.display = 'inline-block';
        
        const response = await fetch('https://resume-portal-907r.onrender.com/api/submit', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to submit profile');
        }
        
        // Show success message
        alert(data.message || 'Profile submitted successfully!');
        
        // Clear file input after successful submission
        const fileInput = document.getElementById('resumeFile');
        if (fileInput) {
            fileInput.value = '';
            
            // Update file input label if you have one
            const fileLabel = document.querySelector('label[for="resumeFile"] .file-name');
            if (fileLabel) {
                fileLabel.textContent = 'No file chosen';
            }
        }
        
        // Update form to show it's now an update operation
        if (!isUpdate) {
            form.dataset.submissionId = data.submission._id || data.submission.id;
        }
        
        // Reload the submission data to reflect changes
        await loadSubmission();
        
    } catch (error) {
        console.error('Profile submission error:', error);
        
        // Show user-friendly error messages
        let errorMessage = 'Failed to submit profile. Please try again.';
        
        if (error.message.includes('Failed to upload resume to Google Drive')) {
            errorMessage = 'Failed to upload resume. Please check your file and try again.';
        } else if (error.message.includes('Resume file is required')) {
            errorMessage = 'Please upload your resume file.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        alert(errorMessage);
    } finally {
        spinner.style.display = 'none';
    }
}

// Helper function to validate file on selection (optional)
function handleFileSelect(event) {
    const file = event.target.files[0];
    const fileLabel = document.querySelector('label[for="resumeFile"] .file-name');
    
    if (file) {
        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            alert('Please select only PDF or Word documents');
            event.target.value = '';
            if (fileLabel) fileLabel.textContent = 'No file chosen';
            return;
        }
        
        // Validate file size
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert('File size must be less than 10MB');
            event.target.value = '';
            if (fileLabel) fileLabel.textContent = 'No file chosen';
            return;
        }
        
        // Update label with file name
        if (fileLabel) {
            fileLabel.textContent = file.name;
        }
    } else {
        if (fileLabel) fileLabel.textContent = 'No file chosen';
    }
}

// Add event listener for file input (add this to your page initialization)
// document.getElementById('resumeFile').addEventListener('change', handleFileSelect);
async function handleTPOSubmit(event) {
    event.preventDefault();

    const form = document.getElementById('tpoUploadForm');
    
    const formData = new FormData();
    
    // Get form fields manually
    const driveName = form.querySelector('[name="driveName"]')?.value;
    const branch = form.querySelector('[name="branch"]')?.value;
    const batchYear = form.querySelector('[name="batchYear"]')?.value;
    const notes = form.querySelector('[name="notes"]')?.value;
    
    // Get files manually
    const fileInput = document.getElementById('resumeFiles');
    const files = fileInput.files;
    
    // Validate files
    if (!files || files.length === 0) {
        alert('Please select at least one PDF file.');
        return;
    }
    
    // Add form fields to FormData
    formData.append('driveName', driveName);
    formData.append('branch', branch);
    formData.append('batchYear', batchYear);
    formData.append('notes', notes);
    
    // Add user email
    const userEmail = localStorage.getItem('userEmail');
    if (userEmail) {
        formData.append('userEmail', userEmail);
    }
    
    // Add files to FormData
    for (let i = 0; i < files.length; i++) {
        formData.append('resumeFiles', files[i]);
    }
    
    console.log(`Uploading ${files.length} files`); // Debug log

    const spinner = document.getElementById('uploadSpinner');
    if (spinner) {
        spinner.innerText = 'Uploading...';
        spinner.style.display = 'inline-block';
    }

    const jwtToken = localStorage.getItem('token');
    if (!jwtToken) {
        alert('You are not logged in. Please log in to upload resumes.');
        if (spinner) {
            spinner.innerText = '';
            spinner.style.display = 'none';
        }
        window.location.href = '/tpo-login.html';
        return;
    }

    try {
        const response = await fetch('https://resume-portal-907r.onrender.com/api/tpo/upload-resumes', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${jwtToken}`,
            },
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || 'Resumes uploaded successfully!');
            form.reset();
        } else if (response.status === 401) {
            console.error('Upload failed: 401 Unauthorized', data.error);
            alert(`Session expired or unauthorized. Please log in again. Error: ${data.error || 'Unknown'}`);
            localStorage.removeItem('token');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userName');
            localStorage.removeItem('collegeName');
            window.location.href = 'signup.html';
        } else {
            console.error(`Upload failed: Status ${response.status}`, data.error);
            alert(`Upload failed: ${data.error || 'An unexpected error occurred. Please try again.'}`);
        }
    } catch (err) {
        console.error('Network or unexpected error during upload:', err);
        alert('Could not connect to the server or an unexpected error occurred. Please check your internet connection and try again.');
    } finally {
        if (spinner) {
            spinner.innerText = '';
            spinner.style.display = 'none';
        }
    }
}
// document.addEventListener('DOMContentLoaded', async () => {
//   await loadRecentUploads();
// });

async function loadRecentUploads() {
    const recentUploadsContainer = document.getElementById("recentUploads");
    if (!recentUploadsContainer) {
        console.error("Recent uploads container not found.");
        return;
    }

    // 1. Get the JWT token from localStorage
    const jwtToken = localStorage.getItem('token');
    const userEmail = localStorage.getItem('userEmail'); // Fix: Get userEmail from localStorage

    if (!jwtToken) {
        console.error('No JWT token found. User not authenticated for recent uploads.');
        recentUploadsContainer.innerHTML = "<p class='text-danger'>Please log in to view recent uploads.</p>";
        return;
    }

    if (!userEmail) {
        console.error('No user email found. User session incomplete.');
        recentUploadsContainer.innerHTML = "<p class='text-danger'>Session incomplete. Please log in again.</p>";
        // Clear incomplete session
        clearUserSession();
        return;
    }
   

    // Show loading state
    recentUploadsContainer.innerHTML = "<p>Loading recent uploads...</p>";

    try {
        const res = await fetch(`https://resume-portal-907r.onrender.com/api/tpo/recent-submissions?email=${encodeURIComponent(userEmail)}`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${jwtToken}`,
            },
        });

        const data = await res.json();

        if (!res.ok) {
            handleHttpError(res.status, data, recentUploadsContainer);
            return;
        }

        // Render the data
        renderUploadsTable(data, recentUploadsContainer);

    } catch (err) {
        console.error('Network or unexpected error loading recent uploads:', err);
        recentUploadsContainer.innerHTML = "<p class='text-danger'>Could not connect to the server. Please check your internet connection and try again.</p>";
    }
}

function handleHttpError(status, data, container) {
    switch (status) {
        case 401:
            console.error('Authentication failed for recent uploads:', data.error);
            container.innerHTML = `<p class='text-danger'>Session expired. Please log in again.</p>`;
            clearUserSession();
            // Redirect after a short delay for better UX
            setTimeout(() => {
                window.location.href = '/signup.html';
            }, 2000);
            break;
        case 403:
            console.error('Access denied for recent uploads:', data.error);
            container.innerHTML = `<p class='text-danger'>Access denied: ${data.error || 'You do not have permission to view these uploads.'}</p>`;
            break;
        case 404:
            container.innerHTML = "<p class='text-warning'>No recent uploads found for your account.</p>";
            break;
        case 500:
            container.innerHTML = "<p class='text-danger'>Server error. Please try again later.</p>";
            break;
        default:
            console.error(`Error fetching recent uploads: Status ${status}`, data.error);
            container.innerHTML = `<p class='text-danger'>Failed to load uploads: ${data.error || 'An unexpected error occurred.'}</p>`;
    }
}

function clearUserSession() {
    const keysToRemove = ['token', 'userRole', 'userEmail', 'userName', 'collegeName'];
    keysToRemove.forEach(key => localStorage.removeItem(key));
}

function renderUploadsTable(data, container) {
    if (!data || data.length === 0) {
        container.innerHTML = "<p class='text-muted'>No recent uploads found.</p>";
        return;
    }

    let tableHTML = `
        <div class="table-responsive">
            <table class="table table-bordered table-hover">
                <thead class="table-light">
                    <tr>
                        <th>Drive Name</th>
                        <th>Branch</th>
                        <th>Batch Year</th>
                        <th>Upload Date</th>
                        <th>Resumes Count</th>
                        <th>Drive Folder</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.forEach(upload => {
        const formattedDate = formatDate(upload.uploadedAt);
        const fileCount = upload.resumes?.length || 0;
        
        tableHTML += `
            <tr>
                <td>${escapeHtml(upload.driveName) || 'N/A'}</td>
                <td>${escapeHtml(upload.branch) || 'N/A'}</td>
                <td>${escapeHtml(upload.batchYear) || 'N/A'}</td>
                <td>${formattedDate}</td>
                <td>
                    <span class="badge bg-primary">${fileCount}</span>
                </td>
                <td>
                    ${upload.folderId 
                        ? `<a href="https://drive.google.com/drive/folders/${escapeHtml(upload.folderId)}" 
                             target="_blank" 
                             rel="noopener noreferrer" 
                             class="btn btn-sm btn-outline-primary">
                             <i class="fas fa-external-link-alt"></i> View Folder
                           </a>`
                        : '<span class="text-muted">N/A</span>'
                    }
                </td>
            </tr>
        `;
    });

    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = tableHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.warn('Invalid date format:', dateString);
        return 'Invalid Date';
    }
}

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
// Don't forget to call this function when your TPO dashboard loads, e.g.:
// document.addEventListener('DOMContentLoaded', loadRecentUploads);


// Load user's submission
async function loadSubmission() {
    try {
        const response = await fetch('https://resume-portal-907r.onrender.com/api/submission', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch submission');
        }
        
        const form = document.querySelector('form');
        if (data.submission) {
            // Update form fields
            document.getElementById('fullName').value = data.submission.fullName || '';
            document.getElementById('mobile').value = data.submission.mobileNumber || '';
            document.getElementById('email').value = data.submission.email || '';
            document.getElementById('institution').value = data.submission.institution || '';
            document.getElementById('bio').value = data.submission.bio || '';
            
            // Store submission ID for updates
            form.dataset.submissionId = data.submission._id;
            
            // Display current resume if exists
            const currentResumeDiv = document.getElementById('currentResume');
            if (data.submission.resume[0].driveFileId)
             {
                console.log(data.submission._id);

                currentResumeDiv.innerHTML = `
                    <p>Current Resume: ${data.submission.resume[0].originalName}</p>
           
                `;


//                          <div class="btn-group" role="group">
//                         <button class="btn btn-sm btn-info me-2" 
//                                 onclick="viewResume('${data.submission._id}')">

//                             <i class="fas fa-eye"></i> View
//                         </button>
//                         <button class="btn btn-sm btn-primary"
//                                 onclick="downloadResume(event, '${data.submission._id}')">
//                             <i class="fas fa-download"></i> Download
//                         </button>
//                         <!-- PDF Viewer Modal -->
// <div class="modal fade" id="pdfViewerModal" tabindex="-1" aria-labelledby="pdfViewerModalLabel" aria-hidden="true">
//     <div class="modal-dialog modal-xl">
//         <div class="modal-content">
//             <div class="modal-header">
//                 <h5 class="modal-title" id="pdfViewerModalLabel">Resume Viewer</h5>
//                 <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
//             </div>
//             <div class="modal-body p-0">
//                 <div class="d-flex justify-content-center align-items-center mb-2 p-2">
//                     <button class="btn btn-sm btn-outline-secondary me-2" onclick="zoomOut()">
//                         <i class="fas fa-search-minus"></i> Zoom Out
//                     </button>
//                     <span id="zoomLevel" class="mx-2">100%</span>
//                     <button class="btn btn-sm btn-outline-secondary me-2" onclick="zoomIn()">
//                         <i class="fas fa-search-plus"></i> Zoom In
//                     </button>
//                     <button class="btn btn-sm btn-outline-secondary" onclick="resetZoom()">
//                         <i class="fas fa-expand-arrows-alt"></i> Reset
//                     </button>
//                 </div>
//                 <div style="height: 70vh; overflow: auto;">
//                     <iframe id="pdfViewer" 
//                             style="width: 100%; height: 100%; border: none;" 
//                             title="Resume PDF Viewer">
//                     </iframe>
//                 </div>
//             </div>
//             <div class="modal-footer">
//                 <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
//             </div>
//         </div>
//     </div>
// </div>
//                     </div>

                // Make resume upload optional since one already exists
                const resumeInput = document.getElementById('resumeFile');
                resumeInput.required = false;
            } else {
                currentResumeDiv.innerHTML = '<p>No resume uploaded yet</p>';
                // Make resume upload required for initial submission
                const resumeInput = document.getElementById('resumeFile');
                resumeInput.required = true;
            }

            // Update submit button text to indicate update
            const submitButton = document.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.querySelector('.btn-text').textContent = 'Update Profile & Resume';
            }
        } else {
            // Reset form for new submission
            form.reset();
            form.dataset.submissionId = '';
            document.getElementById('currentResume').innerHTML = '<p>No resume uploaded yet</p>';
            document.getElementById('resumeFile').required = true;
            const submitButton = document.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.querySelector('.btn-text').textContent = 'Save Profile & Upload Resume';
            }
        }
    } catch (error) {
        console.error('Error loading submission:', error);
        alert('Failed to load profile data: ' + error.message);
    }
}

// Handle submission deletion
async function deleteSubmission(submissionId) {
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`https://resume-portal-907r.onrender.com/api/admin/submission/${submissionId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete submission');
        }

        // Refresh the submissions table
        loadAllSubmissions();
        alert('Submission deleted successfully');
    } catch (error) {
        console.error('Error deleting submission:', error);
        alert(error.message);
    }
}

// Handle qualification status change
async function updateQualificationStatus(submissionId, status) {
    try {
        const response = await fetch(`https://resume-portal-907r.onrender.com/api/submissions/${submissionId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update status');
        }

        // Refresh the submissions table
        await loadAllSubmissions();
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status: ' + error.message);
    }
}

// View resume in modal
// Global variable to manage PDF zoom level
let currentPdfZoom = 1.0; // Initial zoom level

// Function to handle PDF zooming
function zoomPDF(direction) {
    const pdfViewer = document.getElementById('pdfViewer');
    if (!pdfViewer) {
        console.error("PDF Viewer iframe not found.");
        return;
    }

    const zoomStep = 0.1; // How much to zoom in/out each step
    const minZoom = 0.5;
    const maxZoom = 3.0;

    if (direction === 'in') {
        currentPdfZoom = Math.min(maxZoom, currentPdfZoom + zoomStep);
    } else if (direction === 'out') {
        currentPdfZoom = Math.max(minZoom, currentPdfZoom - zoomStep);
    } else if (direction === 'reset') {
        currentPdfZoom = 1.0;
    }

    // Apply the zoom using CSS transform
    pdfViewer.style.transform = `scale(${currentPdfZoom})`;
    // Ensure the iframe content itself can be scrolled if it overflows after zoom
    pdfViewer.style.width = `${100 / currentPdfZoom}%`;
    pdfViewer.style.height = `${100 / currentPdfZoom}%`;
    // The parent container (pdf-container) needs overflow: auto to enable scrolling
    // which is already present in your HTML.
}

// Your existing viewResume function with a slight adjustment
// Global zoom state

// Initialize zoom level

async function viewResume(submissionId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please log in again to view resumes.');
            return;
        }

        const pdfViewer = document.getElementById('pdfViewer');
        if (!pdfViewer) {
            console.error("PDF Viewer iframe not found.");
            alert('PDF viewer component not ready.');
            return;
        }
        
        // Show loading state
        pdfViewer.src = '';
        resetZoom();
        
        // Show the modal first
        const pdfViewerModal = new bootstrap.Modal(document.getElementById('pdfViewerModal'));
        pdfViewerModal.show();

        // Add loading indicator (optional enhancement)
        showLoadingInViewer();

        // Fetch the resume PDF as a blob
        const response = await fetch(`https://resume-portal-907r.onrender.com/api/resume/view/${submissionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/pdf, image/*, */*' // Accept multiple file types
            }
        });
        
        if (!response.ok) {
            // Hide modal on error
            pdfViewerModal.hide();
            
            let errorMessage;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || response.statusText;
            } catch {
                errorMessage = response.statusText || 'Unknown error';
            }
            
            console.error('Failed to fetch resume:', response.status, errorMessage);
            
            if (response.status === 401) {
                alert('Session expired or unauthorized. Please log in again.');
                localStorage.removeItem('token');
                localStorage.removeItem('userRole');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userName');
                localStorage.removeItem('collegeName');
                window.location.href = '/tpo-login.html';
            } else if (response.status === 403) {
                alert('Access denied. You do not have permission to view this resume.');
            } else if (response.status === 404) {
                alert('Resume file not found. It may have been deleted or moved.');
            } else {
                alert(`Failed to fetch resume: ${errorMessage}`);
            }
            return;
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Hide loading indicator
        hideLoadingInViewer();
        
        pdfViewer.src = blobUrl;
        
        // Clean up the blob URL when the modal is hidden
        document.getElementById('pdfViewerModal').addEventListener('hidden.bs.modal', () => {
            URL.revokeObjectURL(blobUrl);
            pdfViewer.src = '';
        }, { once: true });
        
    } catch (error) {
    console.error('Error viewing resume:', error);
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('pdfViewerModal'));
    if (modal) {
        modal.hide();
    }
    
    hideLoadingInViewer();
    
    const errorMsg = (error && error.message) 
        ? error.message 
        : (typeof error === 'string' ? error : JSON.stringify(error));

    alert('Failed to view resume: ' + errorMsg);
}
}

// Optional loading indicator functions
function showLoadingInViewer() {
    const pdfViewer = document.getElementById('pdfViewer');
    if (pdfViewer) {
        pdfViewer.style.background = 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBzdHJva2U9IiMwMDciPjxnIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCI+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMSAxKSIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIHN0cm9rZS1vcGFjaXR5PSIuNSIgY3g9IjE4IiBjeT0iMTgiIHI9IjE4Ii8+PHBhdGggZD0ibTM2IDE4YzAtOS45NC04LjA2LTE4LTE4LTE4Ij48YW5pbWF0ZVRyYW5zZm9ybSBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iIHR5cGU9InJvdGF0ZSIgdmFsdWVzPSIwIDE4IDE4OzM2MCAxOCAxOCIgZHVyPSIxcyIgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiLz48L3BhdGg+PC9nPjwvZz48L3N2Zz4=") center center no-repeat';
    }
}

function hideLoadingInViewer() {
    const pdfViewer = document.getElementById('pdfViewer');
    if (pdfViewer) {
        pdfViewer.style.background = 'white';
    }
}

// Zoom functions for PDF viewer
function zoomIn() {
    currentPdfZoom += 0.2;
    if (currentPdfZoom > 3.0) currentPdfZoom = 3.0; // Max zoom
    applyZoom();
}

function zoomOut() {
    currentPdfZoom -= 0.2;
    if (currentPdfZoom < 0.5) currentPdfZoom = 0.5; // Min zoom
    applyZoom();
}

function resetZoom() {
    currentPdfZoom = 1.0;
    applyZoom();
}

function applyZoom() {
    const pdfViewer = document.getElementById('pdfViewer');
    const zoomLevel = document.getElementById('zoomLevel');
    
    if (pdfViewer) {
        pdfViewer.style.transform = `scale(${currentPdfZoom})`;
        pdfViewer.style.transformOrigin = 'top left';
    }
    
    if (zoomLevel) {
        zoomLevel.textContent = `${Math.round(currentPdfZoom * 100)}%`;
    }
}

// Keyboard shortcuts for zoom (optional enhancement)
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('pdfViewerModal');
    const isModalOpen = modal && modal.classList.contains('show');
    
    if (isModalOpen && (e.ctrlKey || e.metaKey)) {
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            zoomIn();
        } else if (e.key === '-') {
            e.preventDefault();
            zoomOut();
        } else if (e.key === '0') {
            e.preventDefault();
            resetZoom();
        }
    }
});
document.addEventListener('DOMContentLoaded', () => {
  const tpoTab = document.getElementById('tpo-tab');
  tpoTab.addEventListener('click', fetchTpoSubmissions);
});

async function fetchTpoSubmissions() {
    // 1. Get the JWT token from localStorage
    const jwtToken = localStorage.getItem('token'); // This should be the same 'token' you store on login

    if (!jwtToken) {
        console.error('No JWT token found for fetching TPO submissions. User not authenticated.');
        alert('You are not logged in or your session has expired. Please log in again.');
        // Optionally, redirect to login page if this function is called on a page that requires authentication
        window.location.href = '/login.html'; // Or your specific admin/tpo login page
        return; // Stop execution if no token
    }

    try {
        const response = await fetch('https://resume-portal-907r.onrender.com/api/admin/tpo-submissions', {
            method: 'GET', // Assuming it's a GET request
            headers: {
                'Authorization': `Bearer ${jwtToken}`, // Add the Authorization header
                'Content-Type': 'application/json' // Good practice to include this for JSON APIs
            }
        });

        const submissions = await response.json();

        if (!response.ok) {
            // Handle HTTP errors (e.g., 401, 403, 500)
            if (response.status === 401) {
                console.error('Authentication failed for TPO submissions:', submissions.error);
                alert(`Authentication failed: ${submissions.error || 'Your session has expired or you are unauthorized.'}. Please log in again.`);
                // Clear invalid token and redirect to login
                localStorage.removeItem('token');
                localStorage.removeItem('userRole'); // Clear other related items too
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userName');
                localStorage.removeItem('collegeName');
                window.location.href = '/login.html'; // Or your specific admin/tpo login page
            } else if (response.status === 403) {
                console.error('Access denied for TPO submissions:', submissions.error);
                alert(`Access denied: ${submissions.error || 'You do not have permission to view these submissions.'}`);
            } else {
                console.error(`Error fetching TPO submissions: Status ${response.status}`, submissions.error);
            
            }
            return; // Stop execution after handling the error
        }

        const tbody = document.querySelector('#tpoTable tbody');
        if (!tbody) {
            console.error('Table body element (#tpoTable tbody) not found.');
            return; // Exit if the table body isn't there
        }
        tbody.innerHTML = ''; // Clear existing rows

        if (submissions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No TPO submissions found.</td></tr>';
            return;
        }

        submissions.forEach(sub => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sub.driveName || 'N/A'}</td>
                <td>${sub.branch || 'N/A'}</td>
                <td>${sub.batchYear || 'N/A'}</td>
                <td>${sub.uploadedBy?.email || 'N/A'}</td>
                <td>${new Date(sub.createdAt).toLocaleDateString()}</td>
                <td>${sub.notes || ''}</td>
                <td>
                    ${sub.files && sub.files.length > 0
                        ? sub.files.map(f => `<a href="${f.fileUrl}" target="_blank">Resume</a>`).join('<br>')
                        : 'No resumes'
                    }
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="sendToRecruiter('${sub._id}', 'tpo')">
                        <i class="fas fa-share-square"></i> Send
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Network or unexpected error fetching TPO submissions:', error);
        alert('Could not connect to the server or an unexpected error occurred while fetching submissions.');
    }
}




// Load all submissions for admin
async function loadAllSubmissions() {
    try {
        const response = await fetch('https://resume-portal-907r.onrender.com/api/submissions', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch submissions');
        }
        
        const submissionsTable = document.getElementById('submissionsTable');
        const tbody = submissionsTable.querySelector('tbody');
        tbody.innerHTML = '';
        
        data.forEach(submission => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${submission.fullName}</td>
                <td>${submission.email}</td>
                <td>${submission.mobileNumber}</td>
                <td>${submission.institution}</td>
                <td>${new Date(submission.createdAt).toLocaleString()}</td>
                <td>
                    <div class="form-check d-flex justify-content-center">
                        <input type="checkbox" class="form-check-input" 
                               ${submission.isDownloaded ? 'checked' : ''} 
                               disabled>
                    </div>
                </td>
                <td>
                    <select class="form-select form-select-sm" 
                            onchange="updateQualificationStatus('${submission._id}', this.value)">
                        <option value="pending" ${submission.qualificationStatus === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="qualified" ${submission.qualificationStatus === 'qualified' ? 'selected' : ''}>Qualified</option>
                        <option value="disqualified" ${submission.qualificationStatus === 'disqualified' ? 'selected' : ''}>Disqualified</option>
                    </select>
                </td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-info" 
                                onclick="viewResume('${submission._id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-sm btn-primary ms-2"
                                onclick="downloadResume(event, '${submission._id}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading submissions:', error);
        alert('Failed to load submissions');
    }
}

// Handle resume download
async function downloadResume(event, submissionId) {
    event.preventDefault();
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`https://resume-portal-907r.onrender.com/api/resume/${submissionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to download resume');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resume-${submissionId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Update the downloaded status
        await fetch(`https://resume-portal-907r.onrender.com/api/submissions/${submissionId}/downloaded`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        // Refresh the submissions table to show updated download status
        await loadAllSubmissions();
    } catch (error) {
        console.error('Error downloading resume:', error);
        alert('Failed to download resume');
    }
}

// Download all resumes as zip
async function downloadAllResumes() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please login again');
            return;
        }

        const response = await fetch('https://resume-portal-907r.onrender.com/api/download-all-resumes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to download resumes');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'all-resumes.zip';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error downloading resumes:', error);
        alert('Failed to download resumes: ' + error.message);
    }
}

// Download all records as Excel
async function downloadAllRecords() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Please login again');
            return;
        }

        const response = await fetch('https://resume-portal-907r.onrender.com/api/download-records', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to download records');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'submissions.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Error downloading records:', error);
        alert('Failed to download records: ' + error.message);
    }
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
}

// Initialize page
function initializePage() {
    checkAuth();
    const userRole= localStorage.getItem('userRole')
    
    // Set user name in navbar
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        const userName = localStorage.getItem('userName');
        userNameElement.textContent = userName || 'User';
    }
    
    // Load appropriate content based on page
    if (window.location.pathname.includes('admin.html')) {
        loadAllSubmissions();
    } else if (window.location.pathname.includes('dashboard.html') && userRole==='student') {
        loadSubmission();
    }
    else if (window.location.pathname.includes('tpo-dashboard.html')&& userRole==='tpo')
        loadRecentUploads();
}

// Call initialize function when page loads
document.addEventListener('DOMContentLoaded', initializePage);

// PDF zoom functionality
let currentZoom = 1;
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

function zoomPDF(action) {
    const iframe = document.getElementById('pdfViewer');
    
    switch(action) {
        case 'in':
            if (currentZoom < MAX_ZOOM) {
                currentZoom += ZOOM_STEP;
            }
            break;
        case 'out':
            if (currentZoom > MIN_ZOOM) {
                currentZoom -= ZOOM_STEP;
            }
            break;
        case 'reset':
            currentZoom = 1;
            break;
    }
    
    iframe.style.transform = `scale(${currentZoom})`;
    
    // Adjust container width to accommodate zoom
    const container = iframe.parentElement;
    container.style.width = currentZoom === 1 ? '100%' : `${100 * currentZoom}%`;
}

// Reset zoom when modal is closed
document.getElementById('pdfViewerModal').addEventListener('hidden.bs.modal', function () {
    currentZoom = 1;
    const iframe = document.getElementById('pdfViewer');
    iframe.style.transform = 'scale(1)';
    iframe.parentElement.style.width = '100%';
}); 