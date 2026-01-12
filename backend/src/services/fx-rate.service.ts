import { Repository } from 'typeorm';
import { FXRate } from '../entities/FXRate.js';
import { AppDataSource } from '../database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * FX Rate Service
 * Fetches and caches Bank of Canada exchange rates
 */
export class FXRateService {
    private fxRateRepository: Repository<FXRate>;

    constructor() {
        this.fxRateRepository = AppDataSource.getRepository(FXRate);
    }

    /**
     * Get exchange rate for a specific date and currency pair
     * Uses Bank of Canada as the official source
     */
    async getRate(date: Date, fromCurrency: string, toCurrency: string): Promise<number> {
        // If same currency, rate is 1
        if (fromCurrency === toCurrency) {
            return 1;
        }

        // Normalize currencies
        fromCurrency = fromCurrency.toUpperCase();
        toCurrency = toCurrency.toUpperCase();

        // Check cache first
        const cached = await this.getCachedRate(date, fromCurrency, toCurrency);
        if (cached) {
            return cached.rate;
        }

        // Fetch from Bank of Canada
        const rate = await this.fetchBankOfCanadaRate(date, fromCurrency, toCurrency);

        // Cache the result
        await this.cacheRate(date, fromCurrency, toCurrency, rate);

        return rate;
    }

    /**
     * Get rate from cache
     */
    private async getCachedRate(
        date: Date,
        fromCurrency: string,
        toCurrency: string
    ): Promise<FXRate | null> {
        const dateStr = this.formatDate(date);

        return await this.fxRateRepository.findOne({
            where: {
                date: new Date(dateStr),
                fromCurrency,
                toCurrency
            }
        });
    }

    /**
     * Cache a rate
     */
    private async cacheRate(
        date: Date,
        fromCurrency: string,
        toCurrency: string,
        rate: number
    ): Promise<FXRate> {
        const fxRate = new FXRate();
        fxRate.id = uuidv4();
        fxRate.date = new Date(this.formatDate(date));
        fxRate.fromCurrency = fromCurrency;
        fxRate.toCurrency = toCurrency;
        fxRate.rate = rate;
        fxRate.source = 'Bank of Canada';

        return await this.fxRateRepository.save(fxRate);
    }

    /**
     * Fetch rate from Bank of Canada Valet API
     * API docs: https://www.bankofcanada.ca/valet/docs
     */
    private async fetchBankOfCanadaRate(
        date: Date,
        fromCurrency: string,
        toCurrency: string
    ): Promise<number> {
        const dateStr = this.formatDate(date);

        // Bank of Canada provides rates relative to CAD
        // Common series: FXUSDCAD for USD/CAD
        let seriesName: string;
        let invertRate = false;

        if (toCurrency === 'CAD') {
            seriesName = `FX${fromCurrency}CAD`;
        } else if (fromCurrency === 'CAD') {
            seriesName = `FX${toCurrency}CAD`;
            invertRate = true;
        } else {
            // For non-CAD pairs, we need to go through CAD
            // Get both rates and calculate cross rate
            const toCadRate = await this.fetchBankOfCanadaRate(date, fromCurrency, 'CAD');
            const fromCadRate = await this.fetchBankOfCanadaRate(date, 'CAD', toCurrency);
            return toCadRate * fromCadRate;
        }

        try {
            const url = `https://www.bankofcanada.ca/valet/observations/${seriesName}/json?start_date=${dateStr}&end_date=${dateStr}`;

            const response = await fetch(url);

            if (!response.ok) {
                // If exact date not found, try to find the most recent rate before this date
                return await this.fetchMostRecentRate(date, seriesName, invertRate);
            }

            const data = await response.json() as {
                observations?: Array<{ [key: string]: { v: string } }>;
            };

            if (!data.observations || data.observations.length === 0) {
                // No data for this date (weekend/holiday), find most recent
                return await this.fetchMostRecentRate(date, seriesName, invertRate);
            }

            const rateValue = parseFloat(data.observations[0][seriesName].v);
            return invertRate ? 1 / rateValue : rateValue;

        } catch (error) {
            console.error('Error fetching Bank of Canada rate:', error);
            // Fallback: try to find most recent cached rate
            const recent = await this.findMostRecentCachedRate(fromCurrency, toCurrency, date);
            if (recent) {
                console.warn(`Using cached rate from ${recent.date} for ${dateStr}`);
                return recent.rate;
            }
            throw new Error(`Unable to fetch exchange rate for ${fromCurrency}/${toCurrency} on ${dateStr}`);
        }
    }

    /**
     * Fetch the most recent rate before a given date
     */
    private async fetchMostRecentRate(
        date: Date,
        seriesName: string,
        invertRate: boolean
    ): Promise<number> {
        // Look back up to 10 days (to cover weekends and holidays)
        const startDate = new Date(date);
        startDate.setDate(startDate.getDate() - 10);

        const url = `https://www.bankofcanada.ca/valet/observations/${seriesName}/json?start_date=${this.formatDate(startDate)}&end_date=${this.formatDate(date)}&order_dir=desc`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Bank of Canada API error: ${response.status}`);
            }

            const data = await response.json() as {
                observations?: Array<{ [key: string]: { v: string } }>;
            };

            if (!data.observations || data.observations.length === 0) {
                throw new Error(`No rate data available for ${seriesName}`);
            }

            const rateValue = parseFloat(data.observations[0][seriesName].v);
            return invertRate ? 1 / rateValue : rateValue;

        } catch (error) {
            console.error('Error fetching recent Bank of Canada rate:', error);
            throw error;
        }
    }

    /**
     * Find most recent cached rate before a date
     */
    private async findMostRecentCachedRate(
        fromCurrency: string,
        toCurrency: string,
        beforeDate: Date
    ): Promise<FXRate | null> {
        return await this.fxRateRepository
            .createQueryBuilder('rate')
            .where('rate.fromCurrency = :from', { from: fromCurrency })
            .andWhere('rate.toCurrency = :to', { to: toCurrency })
            .andWhere('rate.date <= :date', { date: this.formatDate(beforeDate) })
            .orderBy('rate.date', 'DESC')
            .getOne();
    }

    /**
     * Format date as YYYY-MM-DD for API calls
     */
    private formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Get all cached rates for display
     */
    async getAllRates(): Promise<FXRate[]> {
        return await this.fxRateRepository.find({
            order: { date: 'DESC' }
        });
    }

    /**
     * Manually add a rate (for cases where API is unavailable)
     */
    async addManualRate(
        date: Date,
        fromCurrency: string,
        toCurrency: string,
        rate: number
    ): Promise<FXRate> {
        const fxRate = new FXRate();
        fxRate.id = uuidv4();
        fxRate.date = new Date(this.formatDate(date));
        fxRate.fromCurrency = fromCurrency.toUpperCase();
        fxRate.toCurrency = toCurrency.toUpperCase();
        fxRate.rate = rate;
        fxRate.source = 'Manual Entry';

        return await this.fxRateRepository.save(fxRate);
    }
}

// Export singleton instance
export const fxRateService = new FXRateService();
