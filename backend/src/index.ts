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
            const bestFlight = flights[0]; // Assuming API returns cheapest first
            console.log(`Found flight: ${bestFlight.cityFrom} -> ${bestFlight.cityTo} for ${bestFlight.price} ${bestFlight.currency}`);
            
            if (bestFlight.price <= watcher.targetPrice) {
                console.log(`[ALERT] Price ${bestFlight.price} is <= your target ${watcher.targetPrice}! Triggering notifications...`);
                await sendEmailNotification(watcher.emailUser, bestFlight);
                await sendLineNotify(`Price Alert! Flight to ${bestFlight.cityTo} is now ${bestFlight.price} ${bestFlight.currency}. Link: ${bestFlight.deep_link}`);
            } else {
                console.log(`[INFO] Price ${bestFlight.price} is > target ${watcher.targetPrice}. No alerting.`);
            }
            return bestFlight;
        }
    } catch (err) {
        console.error(`Error processing watcher ${watcher.id}:`, err);
    }
    return null;
}

// API: Create a new watcher
app.post('/api/watchers', async (req, res) => {
    try {
        const data = req.body;
        const newWatcher = await prisma.watcher.create({
            data: {
                fly_from: data.fly_from,
                fly_to: data.fly_to,
                date_from: data.date_from,
                date_to: data.date_to,
                curr: data.curr || 'TWD',
                targetPrice: Number(data.targetPrice),
                emailUser: data.emailUser
            }
        });
        
        // Trigger immediate check and wait for it so we can return the result to frontend
        console.log(`[New Watcher] Created watcher ${newWatcher.id}. Triggering immediate price check...`);
        const initialResult = await processWatcher(newWatcher); 
        
        res.status(201).json({
            ...newWatcher,
            initialCheck: initialResult
        });
    } catch (error) {
        console.error('Error creating watcher:', error);
        res.status(500).json({ error: 'Failed to create watcher' });
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
