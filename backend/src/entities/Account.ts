import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Account entity - represents an investment account
 * Account type affects tax treatment (registered vs non-registered)
 */
@Entity('accounts')
export class Account {
    @PrimaryColumn('varchar', { length: 36 })
    id!: string;

    @Column('varchar', { length: 100 })
    name!: string;

    @Column('varchar', { length: 20 })
    type!: 'non-registered' | 'RRSP' | 'TFSA' | 'RESP' | 'LIRA' | 'RRIF';

    @Column('varchar', { length: 100, nullable: true })
    institution?: string;

    @Column('varchar', { length: 50, nullable: true })
    accountNumber?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    /**
     * Returns true if this is a registered account (TFSA, RRSP, etc.)
     * Registered accounts don't have capital gains/losses for tax purposes
     */
    isRegistered(): boolean {
        return this.type !== 'non-registered';
    }
}
