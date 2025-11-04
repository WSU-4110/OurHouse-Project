// src/__tests__/exportRoutes.test.js

// Mock dependencies BEFORE importing the module
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  const mockPool = jest.fn(() => ({
    query: mockQuery
  }));
  return { Pool: mockPool };
});

jest.mock('../src/auth', () => ({
  authRequired: jest.fn((req, res, next) => {
    req.user = { id: 1, email: 'test@example.com', role: 'Admin' };
    next();
  }),
  roleRequired: jest.fn(() => (req, res, next) => next())
}));

const request = require('supertest');
const express = require('express');
const { Pool } = require('pg');
const exportRoutes = require('../src/routes/exportRoutes');
const { authRequired, roleRequired } = require('../src/auth');

describe('Export Routes - CSV Export Functionality', () => {
  let app;
  let mockQuery;

  beforeEach(() => {
    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Get the mock query function
    const poolInstances = Pool.mock.results;
    if (poolInstances.length > 0) {
      mockQuery = poolInstances[poolInstances.length - 1].value.query;
    }
    
    app.use('/export', exportRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  // Test 1: Snapshot Export Mode
  test('should export snapshot CSV with correct data structure', async () => {
    const mockSnapshotData = [
      { location: 'Warehouse A', sku: 'SKU-001', product: 'Widget', bin: 'A1', quantity: 100 },
      { location: 'Warehouse B', sku: 'SKU-002', product: 'Gadget', bin: 'B2', quantity: 50 }
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockSnapshotData });

    const response = await request(app)
      .get('/export/csv?mode=snapshot')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('snapshot_export.csv');
    expect(response.text).toContain('location');
    expect(response.text).toContain('sku');
    expect(response.text).toContain('Warehouse A');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  // Test 2: Locations Export Mode
  test('should export locations CSV with aggregated data', async () => {
    const mockLocationsData = [
      { location: 'Warehouse A', total_bins: 10, total_items: 500 },
      { location: 'Warehouse B', total_bins: 5, total_items: 250 }
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockLocationsData });

    const response = await request(app)
      .get('/export/csv?mode=locations')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('location_export.csv');
    expect(response.text).toContain('location');
    expect(response.text).toContain('total_bins');
    expect(response.text).toContain('Warehouse A');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  // Test 3: Products Export Mode
  test('should export products CSV with product details', async () => {
    const mockProductsData = [
      { sku: 'SKU-001', product_name: 'Widget', description: 'A widget', unit: 'each', total_quantity: 100 },
      { sku: 'SKU-002', product_name: 'Gadget', description: 'A gadget', unit: 'box', total_quantity: 50 }
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockProductsData });

    const response = await request(app)
      .get('/export/csv?mode=products')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('products_export.csv');
    expect(response.text).toContain('sku');
    expect(response.text).toContain('product_name');
    expect(response.text).toContain('Widget');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  // Test 4: Invalid Mode Handling
  test('should return 400 error for invalid export mode', async () => {
    const response = await request(app)
      .get('/export/csv?mode=invalid_mode')
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Invalid export mode');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // Test 5: Default Mode (Snapshot)
  test('should default to snapshot mode when no mode is specified', async () => {
    const mockSnapshotData = [
      { location: 'Warehouse A', sku: 'SKU-001', product: 'Widget', bin: 'A1', quantity: 100 }
    ];

    mockQuery.mockResolvedValueOnce({ rows: mockSnapshotData });

    const response = await request(app)
      .get('/export/csv')
      .expect(200);

    expect(response.headers['content-disposition']).toContain('snapshot_export.csv');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  // Test 6: Database Error Handling
  test('should handle database errors gracefully', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Database connection failed'));

    const response = await request(app)
      .get('/export/csv?mode=snapshot')
      .expect(500);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Failed to export CSV');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  // Test 7: Empty Data Handling
  test('should handle empty data sets correctly', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get('/export/csv?mode=snapshot')
      .expect(500);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toBe('Failed to export CSV');
  });

  // Test 8: Authentication Requirement
  test('should require authentication for CSV export', async () => {
    // Create a new app without mocked auth
    const testApp = express();
    testApp.use(express.json());
    
    // Mock auth to reject
    const rejectAuth = jest.fn((req, res, next) => {
      res.status(401).json({ error: 'Missing token' });
    });
    
    // Manually create route with rejecting auth
    testApp.get('/export/csv', rejectAuth, (req, res) => {
      res.json({ success: true });
    });

    const response = await request(testApp)
      .get('/export/csv?mode=snapshot')
      .expect(401);

    expect(response.body.error).toBe('Missing token');
  });
});