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

// Helper to parse "yyyy/mm/dd HH:mm" or "dd/mm/yyyy HH:mm" safely
function parseUserDate(str: string | null | undefined, isEnd: boolean = false): Date {
    if (!str || typeof str !== 'string' || str.trim() === '') {
        return new Date(NaN);
    }

    try {
        const trimmed = str.trim();
        
        // Handle ISO format from browser datetime-local picker (e.g. 2026-06-18T16:00)
        if (trimmed.includes('T')) {
            return new Date(trimmed);
        }

        const part = trimmed.split(' ');
        const dateStr = part[0];
        const timePart = part[1] || (isEnd ? '23:59' : '00:00');
        
        let normalizedDate = '';
        if (dateStr.match(/^\d{4}/)) {
            // yyyy/mm/dd or yyyy-mm-dd
            normalizedDate = dateStr.replace(/\//g, '-');
        } else if (dateStr.includes('/')) {
            // dd/mm/yyyy
            const bits = dateStr.split('/');
            if (bits.length === 3) {
                normalizedDate = `${bits[2]}-${bits[1]}-${bits[0]}`;
            }
        }
        
        if (!normalizedDate) return new Date(NaN);

        const isoStr = `${normalizedDate}T${timePart.replace(/:/g, ':')}:00`;
        const d = new Date(isoStr);
        return d;
    } catch (e) {
        return new Date(NaN);
    }
}

/**
 * Logic to process a single watcher: search flights and send notifications if needed
 */
async function processWatcher(watcher: any) {
    console.log(`\n--- Processing Watcher ${watcher.id} (${watcher.fly_from} -> ${watcher.fly_to}) ---`);
    console.log(`[Range] ${watcher.date_from} to ${watcher.date_to}`);
    
    try {
        const startTime = parseUserDate(watcher.date_from, false);
        const endTime = parseUserDate(watcher.date_to, true);
        
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            console.error(`[Error] Invalid date range for watcher ${watcher.id}`);
            return null;
        }

        // Calculate days to search
        const dayMs = 24 * 60 * 60 * 1000;
        const diffDays = Math.ceil((endTime.getTime() - startTime.getTime()) / dayMs) + 1;
        
        let allFlights: any[] = [];
        
        // Search each day in the range (Max 7 days to avoid hitting rate limits too hard)
        const daysToSearch = Math.min(diffDays, 7);
        console.log(`[Info] Searching across ${daysToSearch} day(s)...`);

        for (let i = 0; i < daysToSearch; i++) {
            const currentSearchDate = new Date(startTime.getTime() + (i * dayMs));
            const yyyy = currentSearchDate.getFullYear();
            const mm = String(currentSearchDate.getMonth() + 1).padStart(2, '0');
            const dd = String(currentSearchDate.getDate()).padStart(2, '0');
            
            // Format for flightService (it expects same format as watcher info)
            const searchParams = {
                ...watcher,
                date_from: `${yyyy}/${mm}/${dd}` 
            };
            
            const results = await searchFlights(searchParams);
            allFlights = [...allFlights, ...results];
        }

        if (allFlights.length > 0) {
            // Filter flights by price and EXACT time window
            const matchingFlights = allFlights.filter(f => {
                const flightTime = new Date(f.departureAt);
                return f.price <= watcher.targetPrice && 
                       flightTime >= startTime && 
                       flightTime <= endTime;
            }).sort((a, b) => a.price - b.price);

            // Find the best flight THAT FITS THE WINDOW for the display
            const bestInWindow = matchingFlights.length > 0 ? matchingFlights[0] : null;
            const bestOverall = allFlights.sort((a, b) => a.price - b.price)[0];

            await prisma.watcher.update({
                where: { id: watcher.id },
                data: {
                    lastPrice: Math.round(bestInWindow ? bestInWindow.price : bestOverall.price),
                    lastCheckedAt: new Date()
                }
            });

            if (matchingFlights.length > 0) {
                await prisma.flightResult.deleteMany({ where: { watcherId: watcher.id } });
                
                for (const f of matchingFlights.slice(0, 50)) { // Save top 50
                    await prisma.flightResult.create({
                        data: {
                            watcherId: watcher.id,
                            price: Math.round(f.price),
                            origin: f.cityFrom,
                            destination: f.cityTo,
                            date: f.departureAt.replace('T', ' ').substring(0, 16),
                            airline: f.airline,
                            deepLink: f.deep_link
                        }
                    });
                }

                console.log(`[ALERT] Found ${matchingFlights.length} matching flight(s) in Window!`);
                await sendEmailNotification(watcher.emailUser, matchingFlights, false);
                
                const best = matchingFlights[0];
                const lineMsg = `Price Alert! Found ${matchingFlights.length} options for ${best.cityFrom}->${best.cityTo}.\nCheapest: ${best.price} TWD - ${best.airline}.\nLink: ${best.deep_link}`;
                await sendLineNotify(lineMsg);
            } else {
                console.log(`[INFO] No flights found in Time Window and Budget. (Cheapest overall was ${bestOverall.price})`);
            }
            return matchingFlights[0] || null;
        }
    } catch (err) {
        console.error(`Error processing watcher ${watcher.id}:`, err);
    }
    return null;
}

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

// API: Create new watcher
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
        
        // Use setImmediate to process in background so UI doesn't wait for multi-day search
        setImmediate(() => processWatcher(newWatcher));
        
        res.status(201).json([newWatcher]);
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
            take: 100
        });
        res.json(results);
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

// API: Delete a watcher and its results
app.delete('/api/watchers/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        await prisma.flightResult.deleteMany({ where: { watcherId: id } });
        await prisma.watcher.delete({ where: { id } });
        res.json({ message: 'Watcher and associated results deleted successfully' });
    } catch (error) {
        console.error('Error deleting watcher:', error);
        res.status(500).json({ error: 'Failed to delete watcher' });
    }
});

// Check flight prices every 1 hour
cron.schedule('0 * * * *', async () => {
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
