function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
}
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

document.addEventListener('DOMContentLoaded', async () => {
  await loadSubmission();
});


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