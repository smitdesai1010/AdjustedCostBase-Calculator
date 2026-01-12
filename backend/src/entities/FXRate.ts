import { Entity, PrimaryColumn, Column, CreateDateColumn, Unique } from 'typeorm';

/**
 * FXRate entity - stores historical exchange rates
 * Source: Bank of Canada
 */
@Entity('fx_rates')
@Unique(['date', 'fromCurrency', 'toCurrency'])
export class FXRate {
    @PrimaryColumn('varchar', { length: 36 })
    id!: string;

    @Column('date')
    date!: Date;

    @Column('varchar', { length: 3 })
    fromCurrency!: string;

    @Column('varchar', { length: 3 })
    toCurrency!: string;

    // Exchange rate (e.g., 1.35 means 1 USD = 1.35 CAD)
    @Column('decimal', { precision: 15, scale: 6 })
    rate!: number;

    @Column('varchar', { length: 50, default: 'Bank of Canada' })
    source!: string;

    @CreateDateColumn()
    createdAt!: Date;
}
