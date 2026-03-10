// @ts-ignore
import Amadeus from 'amadeus';

/**
 * Parses "yyyy/mm/dd hh:mm" or "dd/mm/yyyy hh:mm" to Amadeus's YYYY-MM-DD
 * Actually user said dd/mm/yyyy in text but then showed 2026/06/18.
 * Let's extract YYYY-MM-DD from any YYYY/MM/DD or DD/MM/YYYY format.
 */
function extractDate(dateStr: string): string {
    // If it's already ISO format (e.g. 2026-06-18T16:00)
    if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
    }
    // If it's YYYY/MM/DD
    if (dateStr.match(/^\d{4}/)) {
        return dateStr.substring(0, 10).replace(/\//g, '-');
    }
    // If it's DD/MM/YYYY
    const [d, m, y] = dateStr.substring(0, 10).split('/');
    return `${y}-${m}-${d}`;
}

export async function searchFlights(params: any): Promise<any[]> {
    const clientId = process.env.AMADEUS_CLIENT_ID;
    const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.warn('[Amadeus] API Keys are missing! Operating in MOCK MODE.');
        return [1, 2, 3, 4, 5].map(i => ({
            id: `mock-${Date.now()}-${i}`,
            cityFrom: params.fly_from,
            cityTo: params.fly_to,
            price: Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000,
            currency: 'TWD',
            airline: 'Mock Air',
            departureAt: `${extractDate(params.date_from)}T18:30:00`,
            deep_link: 'https://example.com/mock-booking'
        }));
    }

    const amadeus = new Amadeus({ clientId, clientSecret });

    try {
        const departureDate = extractDate(params.date_from);
        console.log(`[Amadeus] 🔍 Searching Flight for ${params.fly_from} -> ${params.fly_to} on ${departureDate}`);
        
        const response = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode: params.fly_from.toUpperCase(),
            destinationLocationCode: params.fly_to.toUpperCase(),
            departureDate: departureDate,
            adults: '1',
            currencyCode: params.curr || 'TWD'
        });

        const flightOffers = response.data;
        const carriers = response.dictionaries?.carriers || {};

        if (!flightOffers || flightOffers.length === 0) {
            console.warn(`[Amadeus] ⚠️ No results for ${params.fly_from} -> ${params.fly_to}`);
            return [];
        }

        const flights = flightOffers.map((offer: any) => {
            const itinerary = offer.itineraries[0];
            const firstSegment = itinerary.segments[0];
            const carrierCode = firstSegment.carrierCode;
            const carrierName = carriers[carrierCode] || carrierCode;
            const departureAt = firstSegment.departure.at; // ISO 8601: 2026-06-18T18:30:00

            return {
                id: `amadeus-${offer.id}`,
                cityFrom: params.fly_from,
                cityTo: params.fly_to,
                price: parseFloat(offer.price.total),
                currency: offer.price.currency,
                airline: carrierName,
                departureAt: departureAt,
                deep_link: `https://www.google.com/travel/flights?q=Flights%20to%20${params.fly_to}%20from%20${params.fly_from}%20on%20${departureDate}`
            };
        });

        // Sort by price
        return flights.sort((a: any, b: any) => a.price - b.price);

    } catch (error: any) {
        console.error('[Amadeus] ❌ API Error Details:', error.response?.data || error.message);
        return [];
    }
}
