import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type SourceCallOutcome = 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'CIRCUIT_OPEN';

@Entity('search_audit')
export class SearchAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vin: string;

  @Column()
  correlationId: string;

  @Column()
  salesOutcome: SourceCallOutcome;

  @Column({ nullable: true })
  salesDurationMs: number;

  @Column({ default: 0 })
  salesDocumentCount: number;

  @Column()
  serviceOutcome: SourceCallOutcome;

  @Column({ nullable: true })
  serviceDurationMs: number;

  @Column({ default: 0 })
  serviceDocumentCount: number;

  @Column()
  totalDurationMs: number;

  @Column()
  overallOutcome: 'FULL' | 'PARTIAL' | 'FAILED';

  @CreateDateColumn()
  createdAt: Date;
}
