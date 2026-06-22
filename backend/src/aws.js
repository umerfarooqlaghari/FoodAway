const { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { fromEmail } = require('./config');

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'goodtogo-assets';

function publicS3Url(key) {
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

const hasCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
const isTestEnv = process.env.NODE_ENV === 'test';

function getApiPublicBase() {
  return (
    process.env.API_PUBLIC_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

let s3Client = null;
let sesClient = null;

if (hasCredentials && !isTestEnv) {
  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  sesClient = new SESv2Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  // Verify bucket existence and try to create it if not present
  (async () => {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      console.log(`AWS S3 Bucket "${bucketName}" verified.`);
    } catch (headError) {
      if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
        console.log(`AWS S3 Bucket "${bucketName}" not found. Attempting to create it...`);
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
          console.log(`AWS S3 Bucket "${bucketName}" created successfully.`);
        } catch (createError) {
          console.error(`Failed to automatically create S3 bucket "${bucketName}":`, createError.message);
          console.error(`Please ensure the bucket is created manually and has public read permissions.`);
        }
      } else {
        console.warn(`Warning: S3 HeadBucket returned an error:`, headError.message);
        console.warn(`Please ensure the bucket "${bucketName}" exists and the provided credentials have permission to access it.`);
      }
    }
  })().catch(err => console.error("Unhandled error checking S3 bucket:", err));
}

const base64Regex = /^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/;

function extractS3Key(url) {
  if (!url || typeof url !== 'string') return null;
  const withoutQuery = url.split('?')[0];
  const bucketPrefix = `https://${bucketName}.s3.${region}.amazonaws.com/`;
  const altPrefix = `https://s3.${region}.amazonaws.com/${bucketName}/`;
  const regionalPrefix = `https://${bucketName}.s3.amazonaws.com/`;
  if (withoutQuery.startsWith(bucketPrefix)) return decodeURIComponent(withoutQuery.slice(bucketPrefix.length));
  if (withoutQuery.startsWith(altPrefix)) return decodeURIComponent(withoutQuery.slice(altPrefix.length));
  if (withoutQuery.startsWith(regionalPrefix)) return decodeURIComponent(withoutQuery.slice(regionalPrefix.length));
  return null;
}

function canonicalS3Url(url) {
  const key = extractS3Key(url);
  return key ? publicS3Url(key) : null;
}

/**
 * Uploads a base64 encoded image to AWS S3.
 * If the input is already a canonical or presigned S3 URL for this bucket, returns the canonical URL.
 * If AWS credentials are not set or in test mode, it falls back to a dry-run local mode.
 * 
 * @param {string} base64OrUrl 
 * @returns {Promise<string>} The uploaded image URL, or original string on failure/bypass.
 */
async function uploadImageToS3(base64OrUrl) {
  if (typeof base64OrUrl !== 'string') return base64OrUrl;

  const existing = canonicalS3Url(base64OrUrl);
  if (existing) return existing;

  const matches = base64OrUrl.match(base64Regex);
  if (!matches) {
    return base64OrUrl;
  }

  const ext = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  const fileKey = `uploads/${crypto.randomUUID()}.${ext}`;
  const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${fileKey}`;

  if (!s3Client) {
    console.log(`[MOCK AWS S3] Mock upload: ${fileKey} (${buffer.length} bytes)`);
    return s3Url;
  }

  try {
    const commandParams = {
      Bucket: bucketName,
      Key: fileKey,
      Body: buffer,
      ContentType: `image/${ext}`
    };

    await s3Client.send(new PutObjectCommand(commandParams));

    console.log(`Uploaded image to S3: ${s3Url}`);
    return s3Url;
  } catch (error) {
    console.error('Failed to upload image to AWS S3:', error);
    return base64OrUrl; // Fallback to raw base64 string on error so functionality isn't completely broken
  }
}

// Nodemailer transporter backed by SES (created lazily once sesClient is ready)
let _sesTransporter = null;
function getSesTransporter() {
  if (!_sesTransporter && sesClient) {
    _sesTransporter = nodemailer.createTransport({
      SES: { sesClient, SendEmailCommand }
    });
  }
  return _sesTransporter;
}

/**
 * Sends an email using AWS SES via nodemailer.
 * Supports optional PDF (or any) attachments.
 *
 * @param {object}  params
 * @param {string}  params.to
 * @param {string}  params.subject
 * @param {string}  params.html
 * @param {string}  [params.text]
 * @param {Array}   [params.attachments]  nodemailer attachment objects
 *   e.g. [{ filename: 'receipt.pdf', content: Buffer, contentType: 'application/pdf' }]
 * @returns {Promise<object>}
 */
async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const transporter = getSesTransporter();

  if (!transporter) {
    console.log(`[MOCK AWS SES] Mock send email:
      To:          ${to}
      From:        ${fromEmail}
      Subject:     ${subject}
      Attachments: ${attachments.map(a => a.filename).join(', ') || 'none'}
      HTML:        ${html?.slice(0, 120)}...
    `);
    return { MessageId: 'mock-message-id' };
  }

  try {
    const info = await transporter.sendMail({
      from:        fromEmail,
      to,
      subject,
      html,
      text:        text || '',
      attachments
    });
    console.log(`Email sent via SES. MessageId: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`Failed to send email via AWS SES to ${to}:`, error);
    throw error;
  }
}

/**
 * Browser-safe image URL — proxies private S3 objects through our API.
 */
function getClientImageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:')) return url;
  const key = extractS3Key(url);
  if (!key) return url;
  return `${getApiPublicBase()}/api/public/media?key=${encodeURIComponent(key)}`;
}

/**
 * Converts a raw S3 URL to a client-accessible URL (proxied when S3 is configured).
 */
async function getPresignedUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const key = extractS3Key(url);
  if (!key) return url;
  if (s3Client) return getClientImageUrl(url);
  return url;
}

async function streamS3Object(key, res) {
  if (!s3Client || !key || key.includes('..')) return false;
  try {
    const response = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
    res.set('Content-Type', response.ContentType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=86400');
    if (response.ETag) res.set('ETag', response.ETag);
    response.Body.pipe(res);
    return true;
  } catch (err) {
    console.warn('S3 stream failed for', key, err.message);
    return false;
  }
}

/**
 * Converts a JSON-encoded array of S3 URLs (or a single URL string) to presigned URLs.
 * Returns a JSON string if input was a JSON string, or a plain string if input was a plain URL.
 */
async function presignImages(images) {
  if (!images || !s3Client) return images;

  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed)) {
      const signed = await Promise.all(parsed.map(url => getPresignedUrl(url)));
      return JSON.stringify(signed);
    }
  } catch {
    // Not JSON — treat as a plain URL
  }

  return getPresignedUrl(images);
}

/**
 * Uploads a local file buffer to S3 under the given key.
 * @param {string} key          e.g. brand/logo.png
 * @param {Buffer} buffer
 * @param {string} contentType
 * @returns {Promise<string>}   Public S3 URL
 */
async function uploadBufferToS3(key, buffer, contentType) {
  const url = publicS3Url(key);

  if (!s3Client) {
    console.log(`[MOCK AWS S3] Mock upload: ${key} (${buffer.length} bytes)`);
    return url;
  }

  const params = {
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  };

  try {
    await s3Client.send(new PutObjectCommand({ ...params, ACL: 'public-read' }));
  } catch (err) {
    if (err.name === 'AccessControlListNotSupported' || err.Code === 'AccessControlListNotSupported') {
      await s3Client.send(new PutObjectCommand(params));
    } else {
      throw err;
    }
  }

  console.log(`Uploaded brand asset to S3: ${url}`);
  return url;
}

module.exports = {
  uploadImageToS3,
  uploadBufferToS3,
  publicS3Url,
  sendEmail,
  getPresignedUrl,
  getClientImageUrl,
  streamS3Object,
  extractS3Key,
  presignImages
};
