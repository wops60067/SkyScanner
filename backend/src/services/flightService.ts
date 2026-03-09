// @ts-ignore
import Amadeus from 'amadeus';

// Initialize Amadeus client
const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID,
    clientSecret: process.env.AMADEUS_CLIENT_SECRET
});

/**
 * Converts dd/mm/yyyy to Amadeus's YYYY-MM-DD format
 */
function formatDate(dateStr: string): string {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
}

export async function searchFlights(params: any): Promise<any[]> {
    console.log(`[Amadeus] Starting search for ${params.fly_from} -> ${params.fly_to}`);
    
    try {
        const response = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode: params.fly_from.toUpperCase(),
            destinationLocationCode: params.fly_to.toUpperCase(),
            departureDate: formatDate(params.date_from),
            returnDate: params.date_to ? formatDate(params.date_to) : undefined,
            adults: '1',
            currencyCode: params.curr || 'TWD',
            max: '5' // Limit results for efficiency
        });

        const flightOffers = response.data;

        console.log(`[Amadeus] API Response - Found ${flightOffers?.length || 0} flight offers.`);
        if (flightOffers && flightOffers.length > 0) {
            console.log('[Amadeus] Sample Data (First Offer):', JSON.stringify(flightOffers[0], null, 2).substring(0, 500) + '...');
        }

        if (!flightOffers || flightOffers.length === 0) {
            console.warn('[Amadeus] No flights found for given criteria.');
            return [];
        }

        // Map Amadeus data to our app's internal format
        const flights = flightOffers.map((offer: any) => ({
            id: `amadeus-${offer.id}`,
            cityFrom: params.fly_from,
            cityTo: params.fly_to,
            price: parseFloat(offer.price.total),
            currency: offer.price.currency,
            // Construct a mock deep link or use a generic one as Amadeus API doesn't provide a direct consumer URL
            deep_link: `https://www.google.com/travel/flights?q=Flights%20to%20${params.fly_to}%20from%20${params.fly_from}%20on%20${formatDate(params.date_from)}`
        }));

        // Sort by price ascending
        const sortedFlights = flights.sort((a: any, b: any) => a.price - b.price);
        console.log(`[Amadeus] Successfully found cheapest price: ${sortedFlights[0].price} ${sortedFlights[0].currency}`);

        return sortedFlights;

    } catch (error: any) {
        console.error('[Amadeus] Error during API call:', error.description || error.message || error);
        return [];
    }
}
