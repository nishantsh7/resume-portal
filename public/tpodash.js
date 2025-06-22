
// function checkAuth() {
//     const token = localStorage.getItem('token');
//     const userRole = localStorage.getItem('userRole');
//     const currentPage = window.location.pathname;

//     if (!token) {
//         if (!currentPage.includes('index.html') && !currentPage.includes('signup.html')) {
//             window.location.href = 'index.html';
//         }
//         return;
//     }

//     // Redirect based on role
//     if (userRole === 'admin') {
//         if (currentPage.includes('dashboard.html')) {
//             window.location.href = 'admin.html';
//         }
//     } else if(userRole==="student"){
//         if (currentPage.includes('admin.html')) {
//             window.location.href = 'dashboard.html';
//         }
//     }
//     else if(userRole==="tpo"){
//         if (currentPage.includes('admin.html')) {
//             window.location.href = 'tpo-dashboard.html';
//         }
//     }
//     else{
//         if(currentPage.includes('admin.html')){
//             window.location.href='recruiter-dashboard.html'
//         }
//     }
// }



document.addEventListener('DOMContentLoaded', function() {
    const resumeInputsContainer = document.getElementById('resumeInputsContainer');
    const addAnotherFileBtn = document.getElementById('addAnotherFileBtn');
    let inputGroupCount = 0; 

    // Function to add a new input group
    function addNewInputGroup() {
        inputGroupCount++;
        const newInputGroup = document.createElement('div');
        newInputGroup.classList.add('mb-3', 'file-input-group'); // Add class for easy selection
        newInputGroup.innerHTML = `
            <label for="studentName${inputGroupCount}" class="form-label">Student Name *</label>
            <input
                type="text"
                class="form-control student-name-input"
                id="studentName${inputGroupCount}"
                name="studentNames"
                placeholder="Enter student name"
                required
            />
            <label for="resumeFile${inputGroupCount}" class="form-label mt-2">Select PDF File *</label>
            <input
                type="file"
                class="form-control resume-file-input"
                id="resumeFile${inputGroupCount}"
                name="resumeFiles"
                accept=".pdf"
                required
            />
            <div class="form-text">Upload a resume PDF for this student.</div>
            <button type="button" class="btn btn-danger btn-sm mt-2 remove-file-btn">Remove</button>
        `;
        resumeInputsContainer.appendChild(newInputGroup);

        // Add event listener for the new remove button
        newInputGroup.querySelector('.remove-file-btn').addEventListener('click', function() {
            newInputGroup.remove();
            // You might want to re-index IDs if you care about sequential numbering after removal
            // For form submission, however, this isn't strictly necessary as we iterate over existing elements.
        });
    }

    // Add the initial input group when the page loads
    addNewInputGroup();

    addAnotherFileBtn.addEventListener('click', addNewInputGroup);

    // Attach handleTPOSubmit to your form's submit event
    // Ensure your form has an ID like 'tpoUploadForm'
    const uploadForm = document.getElementById('tpoUploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleTPOSubmit);
    }

    // --- Your handleTPOSubmit function, modified ---
    async function handleTPOSubmit(event) {
        event.preventDefault();

        const form = document.getElementById('tpoUploadForm'); // Ensure this ID matches your form
        const formData = new FormData();

        // Get form fields manually (these are static elements)
        const driveName = form.querySelector('[name="driveName"]')?.value;
        const branch = form.querySelector('[name="branch"]')?.value;
        const batchYear = form.querySelector('[name="batchYear"]')?.value;
        const notes = form.querySelector('[name="notes"]')?.value;

        // Add static form fields to FormData
        formData.append('driveName', driveName);
        formData.append('branch', branch);
        formData.append('batchYear', batchYear);
        formData.append('notes', notes);

        // Add user email
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
            formData.append('userEmail', userEmail);
        }

        // --- Collect dynamic student name and resume files ---
        const fileInputGroups = document.querySelectorAll('.file-input-group'); // Select all dynamic groups

        let allInputsValid = true;
        let filesPresent = false; // To check if at least one file is selected across all inputs

        fileInputGroups.forEach((group, index) => {
            const studentNameInput = group.querySelector('.student-name-input');
            const resumeFileInput = group.querySelector('.resume-file-input');

            // Basic validation for each pair
            if (!studentNameInput || !studentNameInput.value.trim()) {
                alert(`Please enter a student name for resume entry #${index + 1}.`);
                allInputsValid = false;
                return; // Stop processing this group and mark as invalid
            }

            if (!resumeFileInput || resumeFileInput.files.length === 0) {
                alert(`Please select a resume file for student "${studentNameInput.value.trim()}".`);
                allInputsValid = false;
                return; // Stop processing this group and mark as invalid
            }

            // If valid, append to FormData
            formData.append('studentNames[]', studentNameInput.value.trim());
            formData.append('resumeFiles[]', resumeFileInput.files[0]); // Append the single file
            filesPresent = true; // Mark that at least one file pair was found
        });

        // Overall validation before proceeding
        if (!allInputsValid) {
            return; // Stop submission if any validation failed
        }
        if (!filesPresent) {
            alert('Please add at least one student resume pair.');
            return;
        }

        console.log(`Uploading ${fileInputGroups.length} student-resume pairs`); // Debug log

        const uploadButton = form.querySelector('button[type="submit"]');
        const spinner = document.getElementById('uploadSpinner');
        const btnText = uploadButton.querySelector('.btn-text');

        // Show spinner and disable button
        if (spinner) {
            spinner.style.display = 'inline-block';
        }
        if (btnText) {
            btnText.textContent = 'Uploading...';
        }
        if (uploadButton) {
            uploadButton.disabled = true;
        }

        const jwtToken = localStorage.getItem('token');
        if (!jwtToken) {
            alert('You are not logged in. Please log in to upload resumes.');
            // Re-enable button and hide spinner before redirect
            if (spinner) spinner.style.display = 'none';
            if (btnText) btnText.textContent = 'Upload Resumes';
            if (uploadButton) uploadButton.disabled = false;
            window.location.href = 'signup.html'; // Assuming this is the correct login page
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
                form.reset(); // This will clear static fields

                // Clear all dynamic inputs and add back one fresh input group
                resumeInputsContainer.innerHTML = '';
                inputGroupCount = 0; // Reset count for fresh start
                addNewInputGroup();

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
            // Hide spinner and enable button
            if (spinner) {
                spinner.style.display = 'none';
            }
            if (btnText) {
                btnText.textContent = 'Upload Resumes';
            }
            if (uploadButton) {
                uploadButton.disabled = false;
            }
        }
    }
});


document.addEventListener('DOMContentLoaded', async () => {
  await loadRecentUploads();
});


async function loadRecentUploads() {
    const recentUploadsContainer = document.getElementById("recentUploads");
    if (!recentUploadsContainer) {
        console.error("Recent uploads container not found.");
        return;
    }

    const jwtToken = localStorage.getItem('token');
    const userEmail = localStorage.getItem('userEmail');

    if (!jwtToken) {
        console.error('No JWT token found. User not authenticated for recent uploads.');
        recentUploadsContainer.innerHTML = "<p class='text-danger'>Please log in to view recent uploads.</p>";
        return;
    }

    if (!userEmail) {
        console.error('No user email found. User session incomplete.');
        recentUploadsContainer.innerHTML = "<p class='text-danger'>Session incomplete. Please log in again.</p>";
        clearUserSession(); // Assuming this function exists to clear local storage
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

/**
 * Renders the fetched upload data into a table, including student names.
 * @param {Array} submissions An array of submission objects, each potentially having a 'resumes' array.
 * @param {HTMLElement} container The DOM element to render the table into.
 */
function renderUploadsTable(submissions, container) {
    if (!submissions || submissions.length === 0) {
        container.innerHTML = "<p>No recent uploads found.</p>";
        return;
    }

    let tableHtml = `
        <table class="table table-hover table-striped">
            <thead class="table-dark">
                <tr>
                    <th>Drive Name</th>
                    <th>Branch</th>
                    <th>Batch Year</th>
                    <th>Uploaded On</th>
                    <th>Student Name</th>
                    <th>Resume File</th>
                </tr>
            </thead>
            <tbody>
    `;
//<th>Actions</th>
    submissions.forEach(submission => {
        const uploadDate = new Date(submission.createdAt).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        if (submission.resumes && submission.resumes.length > 0) {
            submission.resumes.forEach(resume => {
                tableHtml += `
                    <tr>
                        <td>${submission.driveName || 'N/A'}</td>
                        <td>${submission.branch || 'N/A'}</td>
                        <td>${submission.batchYear || 'N/A'}</td>
                        <td>${uploadDate}</td>
                        <td>${resume.studentName || 'N/A'}</td>
                        <td>
                            <a href="${resume.driveViewLink}" target="_blank" class="text-decoration-none">
                                ${resume.originalName || 'N/A'} <i class="bi bi-box-arrow-up-right"></i>
                            </a>
                        </td>
                        <td>
                        </td>
                    </tr>
                `;
            });

            // <button
            //                     class="btn btn-sm btn-info view-resume-btn"
            //                     data-submission-id="${submission._id}"
            //                     data-resume-link="${resume.driveViewLink}"
            //                     data-student-name="${resume.studentName}"
            //                 >
            //                     Preview Resume
            //                 </button>
        } else {
            tableHtml += `
                <tr>
                    <td>${submission.driveName || 'N/A'}</td>
                    <td>${submission.branch || 'N/A'}</td>
                    <td>${submission.batchYear || 'N/A'}</td>
                    <td colspan="4">No resumes uploaded for this submission.</td>
                </tr>
            `;
        }
    });

    tableHtml += `
            </tbody>
        </table>
    `;
    container.innerHTML = tableHtml;
  
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