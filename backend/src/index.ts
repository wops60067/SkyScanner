import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cron from 'node-cron';
import cors from 'cors';
import { searchFlights } from './services/flightService';
import { sendEmailNotification, sendLineNotify } from './services/notificationService';
import prisma from './db';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Flight Tracker Backend is running limit!' });
});

// API: Get all watchers
app.get('/api/watchers', async (req, res) => {
    try {
        const watchers = await prisma.watcher.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(watchers);
    } catch (error) {
        console.error('Error fetching watchers:', error);
        res.status(500).json({ error: 'Failed to fetch watchers' });
    }
});

/**
 * Logic to process a single watcher: search flights and send notifications if needed
 * Returns the best flight found
 */
async function processWatcher(watcher: any) {
    console.log(`\n--- Processing Watcher ${watcher.id} (${watcher.fly_from} -> ${watcher.fly_to}) ---`);
    try {
        const flights = await searchFlights(watcher);
        if (flights && flights.length > 0) {
            // Filter flights that meet the target price
            const matchingFlights = flights.filter(f => f.price <= watcher.targetPrice);
            
            // Update the "best" price for the display block
            const bestFlight = flights[0]; 
            await prisma.watcher.update({
                where: { id: watcher.id },
                data: {
                    lastPrice: Math.round(bestFlight.price),
                    lastCheckedAt: new Date()
                }
            });

            // Save matching flights to results table
            if (matchingFlights.length > 0) {
                // Clear old results for this watcher to keep it clean (optional)
                await prisma.flightResult.deleteMany({ where: { watcherId: watcher.id } });
                
                // Save new results
                for (const f of matchingFlights) {
                    await prisma.flightResult.create({
                        data: {
                            watcherId: watcher.id,
                            price: Math.round(f.price),
                            origin: f.cityFrom,
                            destination: f.cityTo,
                            date: watcher.date_from,
                            deepLink: f.deep_link
                        }
                    });
                }

                console.log(`[ALERT] Found ${matchingFlights.length} matching flight(s) below target!`);
                await sendEmailNotification(watcher.emailUser, matchingFlights, false); // Always treat as one-way now
                
                const best = matchingFlights[0];
                const lineMsg = `Price Alert! Found ${matchingFlights.length} options for ${best.cityFrom}->${best.cityTo}. Cheapest: ${best.price} ${best.currency}.\nCheck here: ${best.deep_link}`;
                await sendLineNotify(lineMsg);
            } else {
                console.log(`[INFO] No flights found below target ${watcher.targetPrice} TWD (Cheapest was ${bestFlight.price}).`);
            }
            return bestFlight;
        }
    } catch (err) {
        console.error(`Error processing watcher ${watcher.id}:`, err);
    }
    return null;
}

// API: Create new watcher(s)
app.post('/api/watchers', async (req, res) => {
    try {
        const data = req.body;
        const createdWatchers = [];

        // Create the Outbound watcher
        const outbound = await prisma.watcher.create({
            data: {
                fly_from: data.fly_from,
                fly_to: data.fly_to,
                date_from: data.date_from,
                curr: data.curr || 'TWD',
                targetPrice: Number(data.targetPrice),
                emailUser: data.emailUser
            }
        });
        createdWatchers.push(outbound);
        await processWatcher(outbound);

        // If date_to is provided, create the Inbound watcher separately
        if (data.date_to) {
            const inbound = await prisma.watcher.create({
                data: {
                    fly_from: data.fly_to, // Swapped
                    fly_to: data.fly_from,   // Swapped
                    date_from: data.date_to, // Return date becomes the new date_from
                    curr: data.curr || 'TWD',
                    targetPrice: Number(data.targetPrice),
                    emailUser: data.emailUser
                }
            });
            createdWatchers.push(inbound);
            await processWatcher(inbound);
        }
        
        res.status(201).json(createdWatchers);
    } catch (error) {
        console.error('Error creating watcher:', error);
        res.status(500).json({ error: 'Failed to create watcher' });
    }
});

// API: Get all flight results (deals found)
app.get('/api/results', async (req, res) => {
    try {
        const results = await prisma.flightResult.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(results);
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});
// API: Delete a watcher
app.delete('/api/watchers/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        await prisma.watcher.delete({ where: { id } });
        res.json({ message: 'Watcher deleted successfully' });
    } catch (error) {
        console.error('Error deleting watcher:', error);
        res.status(500).json({ error: 'Failed to delete watcher' });
    }
});

// Check flight prices every 30 minutes to avoid being blocked by scraper protection
cron.schedule('*/30 * * * *', async () => {
    console.log(`\n[Cron] Checking flight prices at ${new Date().toISOString()}`);
    try {
        const watchers = await prisma.watcher.findMany();
        for (const watcher of watchers) {
            await processWatcher(watcher);
        }
    } catch (error) {
        console.error('[Cron] Error during scheduled flight check:', error);
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Flight tracker cron job started.`);
});
