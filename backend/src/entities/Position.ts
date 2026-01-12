import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';
import { Security } from './Security.js';
import { Account } from './Account.js';

/**
 * Position entity - represents current holdings of a security in an account
 * This is a computed/cached value derived from transactions
 */
@Entity('positions')
@Unique(['securityId', 'accountId'])
export class Position {
    @PrimaryColumn('varchar', { length: 36 })
    id!: string;

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

    // Current share count (can have decimals for fractional shares)
    @Column('decimal', { precision: 15, scale: 6, default: 0 })
    shares!: number;

    // Total ACB in CAD
    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    totalAcb!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    /**
     * Calculate ACB per share
     * Returns 0 if no shares held
     */
    getAcbPerShare(): number {
        if (this.shares === 0) return 0;
        return this.totalAcb / this.shares;
    }
}
