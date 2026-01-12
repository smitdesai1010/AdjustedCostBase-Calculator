import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Security } from './Security.js';
import { Account } from './Account.js';

/**
 * Transaction types supported by the system
 */
export type TransactionType =
    | 'buy'
    | 'sell'
    | 'dividend'
    | 'drip'
    | 'roc'
    | 'split'
    | 'consolidation'
    | 'merger'
    | 'spinoff'
    | 'transfer_in'
    | 'transfer_out';

/**
 * Transaction entity - represents any transaction affecting ACB
 * All monetary values are stored in CAD cents for precision
 * Share quantities use decimal for fractional shares
 */
@Entity('transactions')
export class Transaction {
    @PrimaryColumn('varchar', { length: 36 })
    id!: string;

    @Column('date')
    date!: Date;

    @Column('date')
    settlementDate!: Date;

    @Column('varchar', { length: 20 })
    type!: TransactionType;

    @Column('varchar', { length: 36 })
    securityId!: string;

    @ManyToOne(() => Security)
    @JoinColumn({ name: 'securityId' })
    security?: Security;

    @Column('varchar', { length: 36 })
    accountId!: string;

    @ManyToOne(() => Account)
    @JoinColumn({ name: 'accountId' })
    account?: Account;

    // Quantity with up to 6 decimal places for fractional shares
    @Column('decimal', { precision: 15, scale: 6, default: 0 })
    quantity!: number;

    // Price per share in original currency
    @Column('decimal', { precision: 15, scale: 4, default: 0 })
    price!: number;

    // Original currency of the transaction
    @Column('varchar', { length: 3, default: 'CAD' })
    priceCurrency!: string;

    // Fees/commissions in CAD
    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    fees!: number;

    // FX rate used (1 if CAD, rate for foreign currency)
    @Column('decimal', { precision: 15, scale: 6, default: 1 })
    fxRate!: number;

    // ACB values stored as CAD with 2 decimal precision
    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    acbBefore!: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    acbAfter!: number;

    @Column('decimal', { precision: 15, scale: 6, default: 0 })
    sharesBefore!: number;

    @Column('decimal', { precision: 15, scale: 6, default: 0 })
    sharesAfter!: number;

    // Capital gain/loss for sell transactions (CAD)
    @Column('decimal', { precision: 15, scale: 2, nullable: true })
    capitalGain?: number;

    // For corporate actions - ratio (e.g., 2 for 2:1 split)
    @Column('decimal', { precision: 10, scale: 4, nullable: true })
    ratio?: number;

    // For mergers/spinoffs - new security ID
    @Column('varchar', { length: 36, nullable: true })
    newSecurityId?: string;

    // User notes
    @Column('text', { nullable: true })
    notes?: string;

    // Flags for special conditions (JSON array)
    @Column('simple-json', { nullable: true })
    flags?: string[];

    // Detailed calculation breakdown for auditability
    @Column('simple-json', { nullable: true })
    calculationDetails?: Record<string, unknown>;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
