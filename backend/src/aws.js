const { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const crypto = require('crypto');

const region = process.env.AWS_REGION || 'us-east-1';
const bucketName = process.env.AWS_S3_BUCKET_NAME || 'goodtogo-assets';
const fromEmail = process.env.AWS_SES_FROM_EMAIL || 'no-reply@goodtogo.com';

const hasCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
const isTestEnv = process.env.NODE_ENV === 'test';

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

  sesClient = new SESClient({
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

/**
 * Uploads a base64 encoded image to AWS S3.
 * If the input is not base64 (e.g. already a URL), it returns the input as-is.
 * If AWS credentials are not set or in test mode, it falls back to a dry-run local mode.
 * 
 * @param {string} base64OrUrl 
 * @returns {Promise<string>} The uploaded image URL, or original string on failure/bypass.
 */
async function uploadImageToS3(base64OrUrl) {
  if (typeof base64OrUrl !== 'string') return base64OrUrl;

  const matches = base64OrUrl.match(base64Regex);
  if (!matches) {
    return base64OrUrl; // Return as-is (already a URL or file path)
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

    try {
      await s3Client.send(new PutObjectCommand({ ...commandParams, ACL: 'public-read' }));
    } catch (aclError) {
      console.warn('PutObject with ACL public-read failed, retrying without ACL:', aclError.message);
      await s3Client.send(new PutObjectCommand(commandParams));
    }

    console.log(`Uploaded image to S3: ${s3Url}`);
    return s3Url;
  } catch (error) {
    console.error('Failed to upload image to AWS S3:', error);
    return base64OrUrl; // Fallback to raw base64 string on error so functionality isn't completely broken
  }
}

/**
 * Sends an email using AWS SES.
 * If AWS credentials are not set or in test mode, it falls back to logging the email details.
 * 
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.html
 * @param {string} params.text
 * @returns {Promise<object>}
 */
async function sendEmail({ to, subject, html, text }) {
  if (!sesClient) {
    console.log(`[MOCK AWS SES] Mock send email:
      To:      ${to}
      From:    ${fromEmail}
      Subject: ${subject}
      HTML:    ${html}
      Text:    ${text}
    `);
    return { MessageId: 'mock-message-id' };
  }

  const command = new SendEmailCommand({
    Source: fromEmail,
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: html,
          Charset: 'UTF-8'
        },
        Text: {
          Data: text,
          Charset: 'UTF-8'
        }
      }
    }
  });

  try {
    const result = await sesClient.send(command);
    console.log(`Email sent successfully via SES. MessageId: ${result.MessageId}`);
    return result;
  } catch (error) {
    console.error(`Failed to send email via AWS SES to ${to}:`, error);
    throw error;
  }
}

module.exports = {
  uploadImageToS3,
  sendEmail
};
