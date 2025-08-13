// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const fs = require('fs').promises;

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ dest: 'uploads/' });

// Helper to upload GLB as 3D model asset
async function uploadGlb(localPath, options = {}) {
  const result = await cloudinary.uploader.upload(localPath, {
    resource_type: 'raw', // Use 'raw' for non-media files like 3D models
    folder: 'models',
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    ...options,
  });
  return result;
}

// CREATE
app.post('/models', upload.single('model'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  console.log('Received file:', req.file.originalname);

  try {
    const result = await uploadGlb(req.file.path);
    res.status(201).json({
      // Return only the file part of the public_id to the client
      public_id: result.public_id.startsWith('models/') ? result.public_id.substring(7) : result.public_id,
      url: result.secure_url,
      asset_id: result.asset_id,
      resource_type: result.resource_type,
      format: result.format,
      bytes: result.bytes,
    });
    console.log('Upload successful:', result.public_id);
  } catch (e) {
    console.error('Upload failed:', e);
    res.status(500).json({ error: e.message });
  } finally {
    // Ensure the temporary file is always deleted
    try {
      await fs.unlink(req.file.path);
    } catch (unlinkError) {
      console.error('Error deleting temp file:', unlinkError);
    }
  }
});

// READ
app.get('/models/:publicId', async (req, res) => {
  console.log('Fetching model details for:', req.params.publicId);
  try {
    const { publicId } = req.params;
    // Prepend the folder path to construct the full public_id
    const fullPublicId = `models/${publicId}`;
    const details = await cloudinary.api.resource(fullPublicId, { resource_type: 'raw' });
    console.log('Model details:', details);
    res.json(details);
  } catch (e) {
    console.log('Error fetching model details:', e);
    res.status(404).json({ error: e.error && e.error.message ? e.error.message : e.message });
  }
});

// UPDATE
app.put('/models/:publicId', upload.single('model'), async (req, res) => {
  const { publicId } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Prepend the folder path for the update operation
    const fullPublicId = `models/${publicId}`;
    const result = await uploadGlb(req.file.path, { public_id: fullPublicId, overwrite: true });
    res.json({
      public_id: result.public_id.startsWith('models/') ? result.public_id.substring(7) : result.public_id,
      url: result.secure_url,
      bytes: result.bytes,
      version: result.version,
      format: result.format,
    });
    console.log('Update successful for:', result.public_id);
  } catch (e) {
    console.error('Update failed:', e);
    res.status(500).json({ error: e.message });
  } finally {
    try {
      await fs.unlink(req.file.path);
    } catch (unlinkError) {
      console.error('Error deleting temp file:', unlinkError);
    }
  }
});

// DELETE
app.delete('/models/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    // Prepend the folder path for the delete operation
    const fullPublicId = `models/${publicId}`;
    const del = await cloudinary.uploader.destroy(fullPublicId, { resource_type: 'raw' });
    res.json(del);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
