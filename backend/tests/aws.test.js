const request = require('supertest');
const app = require('../src/index');
const { db, initDB } = require('../src/db');
const { uploadImageToS3, sendEmail } = require('../src/aws');

let adminToken;

beforeAll(async () => {
  db.exec('PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS favorites; DROP TABLE IF EXISTS chat_messages; DROP TABLE IF EXISTS reviews; DROP TABLE IF EXISTS orders; DROP TABLE IF EXISTS food_items; DROP TABLE IF EXISTS surprise_bags; DROP TABLE IF EXISTS stores; DROP TABLE IF EXISTS users; PRAGMA foreign_keys = ON;');
  initDB();

  // Create standard admin user for route testing
  await request(app).post('/api/auth/register').send({
    name: 'AWS Admin', email: 'awsadmin@example.com', password: 'pass', role: 'SellersAdmin'
  });
  const resAdmin = await request(app).post('/api/auth/login').send({ email: 'awsadmin@example.com', password: 'pass' });
  adminToken = resAdmin.body.token;
});

describe('AWS Helper Service Unit Tests', () => {
  it('should parse base64 image and return a mock S3 URL', async () => {
    const base64Png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const s3Url = await uploadImageToS3(base64Png);
    expect(s3Url).toMatch(/^https:\/\/goodtogo-assets\.s3\.us-east-1\.amazonaws\.com\/uploads\/[a-f0-9-]+\.png$/);
  });

  it('should pass normal URLs through as-is', async () => {
    const plainUrl = 'https://example.com/logo.jpg';
    const result = await uploadImageToS3(plainUrl);
    expect(result).toBe(plainUrl);
  });

  it('should send a mock email successfully', async () => {
    const emailResult = await sendEmail({
      to: 'test@example.com',
      subject: 'Test Email',
      html: '<h1>Hello</h1>',
      text: 'Hello'
    });
    expect(emailResult).toHaveProperty('MessageId');
    expect(emailResult.MessageId).toBe('mock-message-id');
  });
});

describe('AWS S3 Integration via Endpoints', () => {
  it('should convert base64 image on store creation and store the S3 URL in database', async () => {
    const base64Jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    
    const res = await request(app)
      .post('/api/stores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'AWS Test Store',
        address: '100 Cloud Ave',
        lat: 34.0522,
        lng: -118.2437,
        image: base64Jpeg
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.image).toMatch(/^https:\/\/goodtogo-assets\.s3\.us-east-1\.amazonaws\.com\/uploads\/[a-f0-9-]+\.jpeg$/);

    // Verify database record
    const storeRecord = db.prepare('SELECT image FROM stores WHERE id = ?').get(res.body.id);
    expect(storeRecord.image).toBe(res.body.image);
    expect(storeRecord.image).not.toBe(base64Jpeg);
  });
});
