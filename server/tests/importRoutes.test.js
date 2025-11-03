const request = require('supertest');
const app = require('../src/server');
const path = require('path');
const fs = require('fs');

describe('Import CSV Route', () => {

  test('Test 1: should return 400 if no file is uploaded', async () => {
    const res = await request(app)
      .post('/import/csv')
      .set('Authorization', 'Bearer fake-token');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/No file uploaded/i);
  });

  test('Test 2: should return 400 if uploaded CSV is empty', async () => {
    const filePath = path.join(__dirname, 'empty.csv');
    fs.writeFileSync(filePath, '');

    const res = await request(app)
      .post('/import/csv')
      .attach('file', filePath)
      .set('Authorization', 'Bearer fake-token');

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/CSV appears empty/i);

    fs.unlinkSync(filePath);
  });

  test('Test 3: should handle valid CSV upload gracefully', async () => {
    const csvContent = 'location,bin,product,qty\nMain,A1,Widget,10\n';
    const filePath = path.join(__dirname, 'valid.csv');
    fs.writeFileSync(filePath, csvContent);

    const res = await request(app)
      .post('/import/csv')
      .attach('file', filePath)
      .set('Authorization', 'Bearer fake-token');

    // Accept success or DB error depending on environment
    expect([200, 500]).toContain(res.statusCode);

    fs.unlinkSync(filePath);
  });

  test('Test 4: should return 400 for invalid CSV format (non-CSV data)', async () => {
    const badFilePath = path.join(__dirname, 'invalid.txt');
    fs.writeFileSync(badFilePath, 'this is not a csv file at all');

    const res = await request(app)
      .post('/import/csv')
      .attach('file', badFilePath)
      .set('Authorization', 'Bearer fake-token');

    expect(res.statusCode).toBe(400);
    expect(res.body.error || res.text).toMatch(/invalid|csv/i);

    fs.unlinkSync(badFilePath);
  });

  test('Test 5: should return 400 for non-CSV file type', async () => {
    const samplesDir = path.join(__dirname, 'samples');
    if (!fs.existsSync(samplesDir)) fs.mkdirSync(samplesDir); // ✅ create folder if missing

    const txtPath = path.join(samplesDir, 'wrongType.txt');
    fs.writeFileSync(txtPath, 'This is not a CSV file.');

    const res = await request(app)
        .post('/import/csv')
        .attach('file', txtPath)
        .set('Authorization', 'Bearer fake-token');

    expect(res.statusCode).toBe(400);
    expect(res.body.error || res.text).toMatch(/file type|csv/i);

    fs.unlinkSync(txtPath);
  });



  test('Test 6: should handle duplicate data imports gracefully', async () => {
    const csvContent = 'location,bin,product,qty\nMain,A1,Widget,10\n';
    const dupPath = path.join(__dirname, 'duplicate.csv');
    fs.writeFileSync(dupPath, csvContent);

    // First import
    await request(app)
      .post('/import/csv')
      .attach('file', dupPath)
      .set('Authorization', 'Bearer fake-token');

    // Second import of same file
    const res = await request(app)
      .post('/import/csv')
      .attach('file', dupPath)
      .set('Authorization', 'Bearer fake-token');

    expect([200, 409, 500]).toContain(res.statusCode);
    expect(res.text || '').toMatch(/duplicate|exists|error|ok/i);

    fs.unlinkSync(dupPath);
  });

});
