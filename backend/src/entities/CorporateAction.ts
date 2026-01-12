import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Security } from './Security.js';

export type CorporateActionType = 'split' | 'consolidation' | 'merger' | 'spinoff' | 'name_change';

/**
 * CorporateAction entity - tracks stock splits, mergers, spin-offs, etc.
 */
@Entity('corporate_actions')
export class CorporateAction {
    @PrimaryColumn('varchar', { length: 36 })
    id!: string;

    @Column('date')
    date!: Date;

    @Column('varchar', { length: 36 })
    securityId!: string;

    @ManyToOne(() => Security)
    @JoinColumn({ name: 'securityId' })
    security?: Security;

    @Column('varchar', { length: 20 })
    type!: CorporateActionType;

    // Ratio for splits/consolidations (e.g., 2 for 2:1 split, 0.1 for 10:1 consolidation)
    @Column('decimal', { precision: 10, scale: 4, nullable: true })
    ratio?: number;

    // New security for mergers/spinoffs
    @Column('varchar', { length: 36, nullable: true })
    newSecurityId?: string;

    @ManyToOne(() => Security)
    @JoinColumn({ name: 'newSecurityId' })
    newSecurity?: Security;

    // Cash component per share (for mergers with cash boot)
    @Column('decimal', { precision: 15, scale: 4, nullable: true })
    cashPerShare?: number;

    // ACB allocation percentage for spinoffs (e.g., 0.25 means 25% to new security)
    @Column('decimal', { precision: 5, scale: 4, nullable: true })
    acbAllocationPercent?: number;

    @Column('text', { nullable: true })
    notes?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
