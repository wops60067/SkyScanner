import nodemailer from 'nodemailer';
import axios from 'axios';

export async function sendEmailNotification(to: string, flights: any[], isRoundTrip: boolean) {
    const bestFlight = flights[0];
    console.log(`[Notification] Preparing email to ${to} for ${flights.length} flights.`);
    
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) {
        console.warn('SMTP_HOST configuration is missing. Skipping actual email send.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    const flightRows = flights.map(f => `
        <div style="border-bottom: 1px solid #ddd; padding: 10px 0;">
            <p><strong>Price: ${f.price} ${f.currency}</strong></p>
            <p>Route: ${f.cityFrom} -> ${f.cityTo}</p>
            <p><a href="${f.deep_link}" style="background: #6366f1; color: white; padding: 5px 10px; text-decoration: none; border-radius: 4px;">View on Google Flights</a></p>
        </div>
    `).join('');

    const tripType = isRoundTrip ? 'Round Trip' : 'One Way';

    const mailOptions = {
        from: '"Flight Tracker Alerts" <noreply@flighttracker.local>',
        to,
        subject: `[Price Alert] ${flights.length} Flights Found for ${bestFlight.cityFrom} to ${bestFlight.cityTo}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>✈️ Flight Price Update</h2>
                <p>We found <strong>${flights.length}</strong> flight options matching your target criteria for a <strong>${tripType}</strong>.</p>
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px;">
                    ${flightRows}
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">This is an automated message from your SkyScanner Tracking System.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

export async function sendLineNotify(message: string) {
    const lineToken = process.env.LINE_NOTIFY_TOKEN;
    if (!lineToken) {
        console.warn('LINE_NOTIFY_TOKEN missing. Skipping LINE notification.');
        console.log(`[LINE Mock] Message: ${message}`);
        return;
    }
    
    try {
        await axios.post('https://notify-api.line.me/api/notify', 
          new URLSearchParams({ message }).toString(), 
          {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${lineToken}`
            }
          }
        );
        console.log('LINE notification sent successfully.');
    } catch (error) {
        console.error('Error sending LINE notification:', error);
    }
}
