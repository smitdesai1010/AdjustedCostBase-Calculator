import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Security entity - represents a stock, ETF, bond, or mutual fund
 */
@Entity('securities')
export class Security {
    @PrimaryColumn('varchar', { length: 36 })
    id!: string;

    @Column('varchar', { length: 20 })
    symbol!: string;

    @Column('varchar', { length: 255 })
    name!: string;

    @Column('varchar', { length: 3, default: 'CAD' })
    currency!: string;

    @Column('varchar', { length: 20, default: 'stock' })
    type!: 'stock' | 'etf' | 'bond' | 'mutual_fund';

    @Column('varchar', { length: 50, nullable: true })
    exchange?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
