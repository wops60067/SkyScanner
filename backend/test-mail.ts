import dotenv from 'dotenv';
import { sendEmailNotification } from './src/services/notificationService';

dotenv.config();

const mockFlight = {
    id: 'test-flight-123',
    cityTo: 'Tokyo',
    price: 8888,
    currency: 'TWD',
    deep_link: 'https://example.com/test-flight'
};

const testEmail = 'your-email@example.com'; // 請修改這裡進行測試

async function test() {
    console.log('--- Starting Mail Test ---');
    await sendEmailNotification(testEmail, mockFlight);
    console.log('--- Test Completed ---');
}

test();
