export type SourceSystem = 'SALES' | 'SERVICE';

export interface SourceDocument {
  documentId: string;
  vin: string;
  type: string;
  title: string;
  issuedAt: string;
  reference: string;
}

/** Contract every upstream document-source client must implement. */
export interface DocumentSourceClient {
  readonly sourceSystem: SourceSystem;
  fetchDocuments(vin: string, correlationId: string): Promise<SourceDocument[]>;
}
