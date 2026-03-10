// @ts-ignore
import Amadeus from 'amadeus';

/**
 * Converts dd/mm/yyyy to Amadeus's YYYY-MM-DD format
 */
function formatDate(dateStr: string): string {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
}

export async function searchFlights(params: any): Promise<any[]> {
    const clientId = process.env.AMADEUS_CLIENT_ID;
    const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

    // 如果沒有 Key，改為模擬數據模式，避免程式當機
    if (!clientId || !clientSecret) {
        console.warn('[Amadeus] API Keys are missing! Operating in MOCK MODE.');
        const randomPrice = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
        return [{
            id: `mock-${Date.now()}`,
            cityFrom: params.fly_from,
            cityTo: params.fly_to,
            price: randomPrice,
            currency: 'TWD',
            deep_link: 'https://example.com/mock-booking'
        }];
    }

    // 延遲初始化：確保 dotenv.config() 已經執行完畢
    const amadeus = new Amadeus({
        clientId,
        clientSecret
    });

    console.log(`[Amadeus] Starting search for ${params.fly_from} -> ${params.fly_to}`);
    
    try {
        const response = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode: params.fly_from.toUpperCase(),
            destinationLocationCode: params.fly_to.toUpperCase(),
            departureDate: formatDate(params.date_from),
            returnDate: params.date_to ? formatDate(params.date_to) : undefined,
            adults: '1',
            currencyCode: params.curr || 'TWD',
            max: '5' 
        });

        const flightOffers = response.data;

        if (!flightOffers || flightOffers.length === 0) {
            console.warn('[Amadeus] No flights found for given criteria.');
            return [];
        }

        // 回傳所有查到的機票 (最多 5 筆)，解決您說只看到一筆的問題
        const flights = flightOffers.map((offer: any) => ({
            id: `amadeus-${offer.id}`,
            cityFrom: params.fly_from,
            cityTo: params.fly_to,
            price: parseFloat(offer.price.total),
            currency: offer.price.currency,
            deep_link: `https://www.google.com/travel/flights?q=Flights%20to%20${params.fly_to}%20from%20${params.fly_from}%20on%20${formatDate(params.date_from)}`
        }));

        const sortedFlights = flights.sort((a: any, b: any) => a.price - b.price);
        console.log(`[Amadeus] Found ${sortedFlights.length} flight(s). Lowest: ${sortedFlights[0].price} TWD`);

        return sortedFlights;

    } catch (error: any) {
        console.error('[Amadeus] Error during API call:', error.description || error.message || error);
        return [];
    }
}
