const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const Image = require('../models/Image');
const { AppError } = require('../utils/helpers');

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Keep the file in memory just long enough to store it in MongoDB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ALLOWED[file.mimetype] ? cb(null, true) : cb(new AppError('Only JPG, PNG or WEBP images are allowed', 400)),
}).single('image');

// POST /api/uploads/image (multipart, field "image") -> { url }
const uploadImage = (req, res, next) => {
  upload(req, res, async (error) => {
    if (error) return next(error);
    if (!req.file) return next(new AppError('No image uploaded', 400));
    try {
      // Random name + extension from the verified mime type (never trust the client filename).
      const path = crypto.randomBytes(16).toString('hex') + ALLOWED[req.file.mimetype];
      await Image.create({ path, contentType: req.file.mimetype, data: req.file.buffer });
      res.status(201).json({ success: true, url: `/uploads/${path}` });
    } catch (saveError) {
      next(saveError);
    }
  });
};

const ALLOWED_WIDTHS = [160, 320, 480, 640, 960];

// GET /uploads/<path>[?w=480] — serve a stored image. Images never change under the same URL, so cache them hard.
// With ?w= the picture is downscaled and, for browsers that accept it, sent as WebP (far smaller than the stored JPEG/PNG).
const serveImage = async (req, res, next) => {
  try {
    const image = await Image.findOne({ path: [].concat(req.params.imagePath).join('/') }).select('contentType data');
    if (!image) return res.status(404).end();
    let { contentType, data } = image;
    const width = Number(req.query.w);
    if (ALLOWED_WIDTHS.includes(width)) {
      try {
        const pipeline = sharp(data).resize({ width, withoutEnlargement: true });
        if (/image\/webp/.test(req.headers.accept || '')) {
          data = await pipeline.webp({ quality: 68 }).toBuffer();
          contentType = 'image/webp';
        } else {
          data = await pipeline.toBuffer();
        }
      } catch {
        /* unreadable image: fall back to the original bytes */
      }
    }
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, s-maxage=31536000, immutable',
      Vary: 'Accept',
      // The frontend runs on another origin, so allow it to embed these images.
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.send(data);
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadImage, serveImage };
