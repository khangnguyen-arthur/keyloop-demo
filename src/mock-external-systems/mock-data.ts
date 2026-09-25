/**
 * Deterministic fixture data for the two mocked upstream systems.
 *
 * VIN cheat sheet used in tests / demo / README:
 *  - 1HGCM82633A004352  -> documents in BOTH Sales and Service systems (happy path)
 *  - 5YJ3E1EA8JF000316  -> documents in Sales ONLY (Service system has nothing for this vehicle)
 *  - 1FTFW1ET1EFA00001  -> documents in Service ONLY (Sales system has nothing for this vehicle)
 *  - WBA3A5C50DF000001  -> exists in neither system (empty-but-successful result)
 *  - FAILSERVICE000001 -> Service System API simulates a hard failure (HTTP 500) every call
 *  - SLOWSALES00000001 -> Sales System API simulates latency beyond the call timeout
 */

export interface MockDocument {
  documentId: string;
  vin: string;
  type: string;
  title: string;
  issuedAt: string; // ISO date
  reference: string;
}

export const SALES_SYSTEM_DOCUMENTS: Record<string, MockDocument[]> = {
  '1HGCM82633A004352': [
    {
      documentId: 'SALES-INV-1001',
      vin: '1HGCM82633A004352',
      type: 'INVOICE',
      title: 'Vehicle Sale Invoice',
      issuedAt: '2025-03-12T09:00:00.000Z',
      reference: 'SO-88213',
    },
    {
      documentId: 'SALES-CTR-1002',
      vin: '1HGCM82633A004352',
      type: 'CONTRACT',
      title: 'Purchase Agreement',
      issuedAt: '2025-03-12T09:05:00.000Z',
      reference: 'SO-88213',
    },
  ],
  '5YJ3E1EA8JF000316': [
    {
      documentId: 'SALES-INV-2001',
      vin: '5YJ3E1EA8JF000316',
      type: 'INVOICE',
      title: 'Vehicle Sale Invoice',
      issuedAt: '2025-06-02T14:30:00.000Z',
      reference: 'SO-91044',
    },
  ],
};

export const SERVICE_SYSTEM_DOCUMENTS: Record<string, MockDocument[]> = {
  '1HGCM82633A004352': [
    {
      documentId: 'SVC-WO-3001',
      vin: '1HGCM82633A004352',
      type: 'WORK_ORDER',
      title: '10,000 km Service Work Order',
      issuedAt: '2025-08-20T11:00:00.000Z',
      reference: 'WO-55210',
    },
  ],
  '1FTFW1ET1EFA00001': [
    {
      documentId: 'SVC-WO-4001',
      vin: '1FTFW1ET1EFA00001',
      type: 'WORK_ORDER',
      title: 'Brake Replacement Work Order',
      issuedAt: '2025-07-01T08:15:00.000Z',
      reference: 'WO-55880',
    },
    {
      documentId: 'SVC-INS-4002',
      vin: '1FTFW1ET1EFA00001',
      type: 'INSPECTION_REPORT',
      title: 'Annual Safety Inspection Report',
      issuedAt: '2025-07-01T09:00:00.000Z',
      reference: 'WO-55880',
    },
  ],
};

export const FAILING_SERVICE_VIN = 'FAILSERVICE000001';
export const SLOW_SALES_VIN = 'SLOWSALES00000001';
