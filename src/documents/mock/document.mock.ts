export const documentSchemaMockExample = {
    vin: '1HGCM82633A004352',
    correlationId: 'a1b2c3d4...',
    overallStatus: 'FULL',
    documents: [{
        documentId: 'SALES INV 1001',
        vin: '1HGCM82633A004352',
        type: 'INVOICE',
        title: 'Vehicle Sale Invoice',
        issuedAt: '2025-03-12T09:00:00.000Z',
        reference: 'SO 88213',
        sourceSystem: 'SALES',
    }],
    sources: {
        sales: { status: 'SUCCESS', documentCount: 2, durationMs: 145 },
        service: { status: 'SUCCESS', documentCount: 1, durationMs: 98 },
    },
    totalDurationMs: 145,
};
