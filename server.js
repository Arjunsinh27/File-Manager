const express = require('express');
const multer = require('multer');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Azure Blob Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = 'files';

if (!AZURE_STORAGE_CONNECTION_STRING) {
    console.error('AZURE_STORAGE_CONNECTION_STRING environment variable is required');
    process.exit(1);
}

const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allowed file types
        const allowedTypes = ['.txt', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.doc', '.docx', '.xls', '.xlsx'];
        const fileExt = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(fileExt)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${fileExt} is not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
        }
    }
});

// Initialize container
async function initializeContainer() {
    try {
        await containerClient.createIfNotExists({
            access: 'private'
        });
        console.log(`Container "${CONTAINER_NAME}" is ready`);
    } catch (error) {
        console.error('Error initializing container:', error.message);
    }
}

// Routes

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload file
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileName = `${Date.now()}-${req.file.originalname}`;
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);

        // Upload file to Azure Blob Storage
        await blockBlobClient.upload(req.file.buffer, req.file.buffer.length, {
            blobHTTPHeaders: {
                blobContentType: req.file.mimetype
            }
        });

        res.json({
            success: true,
            message: 'File uploaded successfully',
            fileName: fileName,
            originalName: req.file.originalname,
            size: req.file.size,
            contentType: req.file.mimetype
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            error: 'Upload failed: ' + error.message
        });
    }
});

// List all files
app.get('/api/files', async (req, res) => {
    try {
        const files = [];
        
        for await (const blob of containerClient.listBlobsFlat()) {
            const blobClient = containerClient.getBlobClient(blob.name);
            const properties = await blobClient.getProperties();
            
            files.push({
                name: blob.name,
                originalName: blob.name.split('-').slice(1).join('-'), // Remove timestamp prefix
                size: blob.properties.contentLength,
                contentType: blob.properties.contentType,
                lastModified: blob.properties.lastModified,
                url: blobClient.url
            });
        }

        res.json({
            success: true,
            files: files
        });
    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list files: ' + error.message
        });
    }
});

// Download file
app.get('/api/download/:fileName', async (req, res) => {
    try {
        const fileName = req.params.fileName;
        const blobClient = containerClient.getBlobClient(fileName);
        
        // Check if blob exists
        const exists = await blobClient.exists();
        if (!exists) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Get blob properties
        const properties = await blobClient.getProperties();
        
        // Set response headers
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', properties.contentType || 'application/octet-stream');
        res.setHeader('Content-Length', properties.contentLength);

        // Stream the blob
        const downloadResponse = await blobClient.download();
        downloadResponse.readableStreamBody.pipe(res);
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            success: false,
            error: 'Download failed: ' + error.message
        });
    }
});

// Delete file
app.delete('/api/files/:fileName', async (req, res) => {
    try {
        const fileName = req.params.fileName;
        const blobClient = containerClient.getBlobClient(fileName);
        
        // Check if blob exists
        const exists = await blobClient.exists();
        if (!exists) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        // Delete the blob
        await blobClient.delete();
        
        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Delete failed: ' + error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Maximum size is 10MB'
            });
        }
    }
    
    res.status(500).json({
        success: false,
        error: error.message
    });
});

// Start server
async function startServer() {
    await initializeContainer();
    
    app.listen(port, () => {
        console.log(`Azure File Manager running on port ${port}`);
        console.log(`Access the application at: http://localhost:${port}`);
    });
}

startServer().catch(console.error);