import nodemailer from 'nodemailer';
import axios from 'axios';

export async function sendEmailNotification(to: string, flightDetails: any) {
    console.log(`[Notification] Preparing email to ${to} for flight ${flightDetails.id} (${flightDetails.price} ${flightDetails.currency})`);
    
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) {
        console.warn('SMTP_HOST configuration is missing. Skipping actual email send.');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    const mailOptions = {
        from: '"Flight Tracker Alerts" <noreply@flighttracker.local>',
        to,
        subject: `[Low Price Alert] Flight to ${flightDetails.cityTo} is at ${flightDetails.price} ${flightDetails.currency}!`,
        text: `Great news! We found a flight matching your criteria.\nPrice: ${flightDetails.price} ${flightDetails.currency}\nDetails: ${flightDetails.deep_link}`
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
