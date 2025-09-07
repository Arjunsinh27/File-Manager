// Global variables
let files = [];

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const loadingSpinner = document.getElementById('loadingSpinner');
const noFiles = document.getElementById('noFiles');
const filesGrid = document.getElementById('filesGrid');
const toastContainer = document.getElementById('toastContainer');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadFiles();
});

// Setup all event listeners
function setupEventListeners() {
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Prevent default drag behaviors on the document
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        uploadFile(file);
    }
}

// Drag and drop handlers
function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('drag-over');
}

function handleDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
}

// Upload file function
async function uploadFile(file) {
    // Validate file type
    const allowedTypes = ['.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.doc', '.docx', '.xls', '.xlsx'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
        showToast('error', 'Invalid File Type', `File type ${fileExt} is not allowed. Please select a valid file type.`);
        return;
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('error', 'File Too Large', 'File size must be less than 10MB.');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Show progress
    uploadProgress.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Uploading...';
    
    try {
        // Simulate progress for better UX
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            progressFill.style.width = progress + '%';
        }, 200);
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        
        const result = await response.json();
        
        if (result.success) {
            progressText.textContent = 'Upload complete!';
            showToast('success', 'Upload Successful', `${result.originalName} has been uploaded successfully.`);
            
            // Reset form
            fileInput.value = '';
            setTimeout(() => {
                uploadProgress.style.display = 'none';
            }, 2000);
            
            // Reload files
            loadFiles();
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('error', 'Upload Failed', error.message || 'An error occurred while uploading the file.');
        uploadProgress.style.display = 'none';
    }
}

// Load files from server
async function loadFiles() {
    try {
        loadingSpinner.style.display = 'block';
        noFiles.style.display = 'none';
        filesGrid.style.display = 'none';
        
        const response = await fetch('/api/files');
        const result = await response.json();
        
        if (result.success) {
            files = result.files;
            displayFiles(files);
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Load files error:', error);
        showToast('error', 'Load Failed', 'Failed to load files from server.');
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// Display files in the grid
function displayFiles(filesToDisplay) {
    if (filesToDisplay.length === 0) {
        noFiles.style.display = 'block';
        filesGrid.style.display = 'none';
        return;
    }
    
    noFiles.style.display = 'none';
    filesGrid.style.display = 'grid';
    
    filesGrid.innerHTML = '';
    
    filesToDisplay.forEach(file => {
        const fileCard = createFileCard(file);
        filesGrid.appendChild(fileCard);
    });
}

// Create a file card element
function createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card fade-in';
    
    const fileIcon = getFileIcon(file.contentType);
    const fileSize = formatFileSize(file.size);
    const uploadDate = new Date(file.lastModified).toLocaleDateString();
    
    card.innerHTML = `
        <div class="file-header">
            <i class="fas ${fileIcon} file-icon"></i>
            <span class="file-name" title="${file.originalName}">${truncateFileName(file.originalName, 25)}</span>
        </div>
        <div class="file-info">
            <span>${fileSize}</span>
            <span>${uploadDate}</span>
        </div>
        <div class="file-actions">
            <button class="download-btn" onclick="downloadFile('${file.name}', '${file.originalName}')">
                <i class="fas fa-download"></i> Download
            </button>
            <button class="delete-btn" onclick="deleteFile('${file.name}', '${file.originalName}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    return card;
}

// Get appropriate icon for file type
function getFileIcon(contentType) {
    if (!contentType) return 'fa-file';
    
    if (contentType.startsWith('image/')) return 'fa-file-image';
    if (contentType.includes('pdf')) return 'fa-file-pdf';
    if (contentType.includes('word') || contentType.includes('document')) return 'fa-file-word';
    if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'fa-file-excel';
    if (contentType.includes('text')) return 'fa-file-alt';
    
    return 'fa-file';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Truncate filename if too long
function truncateFileName(filename, maxLength) {
    if (filename.length <= maxLength) return filename;
    
    const extension = filename.split('.').pop();
    const name = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = name.substring(0, maxLength - extension.length - 4) + '...';
    
    return truncatedName + '.' + extension;
}

// Download file
async function downloadFile(fileName, originalName) {
    try {
        showToast('info', 'Download Started', `Downloading ${originalName}...`);
        
        const response = await fetch(`/api/download/${encodeURIComponent(fileName)}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Download failed');
        }
        
        // Create blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('success', 'Download Complete', `${originalName} downloaded successfully.`);
        
    } catch (error) {
        console.error('Download error:', error);
        showToast('error', 'Download Failed', error.message || 'Failed to download file.');
    }
}

// Delete file
async function deleteFile(fileName, originalName) {
    if (!confirm(`Are you sure you want to delete "${originalName}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/files/${encodeURIComponent(fileName)}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('success', 'File Deleted', `${originalName} has been deleted successfully.`);
            loadFiles(); // Reload files list
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('Delete error:', error);
        showToast('error', 'Delete Failed', error.message || 'Failed to delete file.');
    }
}

// Show toast notification
function showToast(type, title, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
    
    // Remove on click
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}