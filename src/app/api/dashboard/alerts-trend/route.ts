import { NextResponse } from 'next/server';

export async function GET() {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 250));

    // Generate 7 days of alert trend data with realistic patterns
    const alertsTrendData = [];
    const today = new Date();

    // Predefined realistic data for consistent demo experience
    const alertCounts = [8, 12, 15, 22, 18, 25, 19]; // Monday to Sunday pattern

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        alertsTrendData.push({
            date: date.toISOString().split('T')[0],
            alertCount: alertCounts[6 - i]
        });
    }

    return NextResponse.json({
        data: alertsTrendData,
        period: '7-day',
        timestamp: new Date().toISOString()
    });
}