// Test script to insert abnormal vitals for notification testing
// Run this with: node test-notifications.js

const testVitals = {
    patient_id: 1,
    hr: 45,           // LOW - should trigger alert (normal: 60-100)
    pulse: 45,        // LOW - should trigger alert
    spo2: 85,         // LOW - should trigger alert (normal: 90-100)
    abp: "85/60",     // LOW systolic - should trigger alert (normal: 90-120)
    pap: "15/13",     // HIGH diastolic - should trigger alert (normal: 4-12)
    etco2: 50,        // HIGH - should trigger alert (normal: 35-45)
    awrr: 25,         // HIGH - should trigger alert (normal: 12-20)
    source: "test"
};

async function insertTestVitals() {
    try {
        console.log('Inserting test vitals with abnormal values...');
        console.log(JSON.stringify(testVitals, null, 2));

        const response = await fetch('http://localhost:3000/api/vitals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testVitals)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Success:', result);
            console.log('\nExpected alerts (7 total):');
            console.log('- HR: 45 (LOW - Critical)');
            console.log('- Pulse: 45 (LOW - Critical)');
            console.log('- SpO2: 85 (LOW - Critical)');
            console.log('- ABP Sys: 85 (LOW - Warning)');
            console.log('- PAP Dia: 13 (HIGH - Warning)');
            console.log('- EtCO2: 50 (HIGH - Warning)');
            console.log('- awRR: 25 (HIGH - Critical)');
            console.log('\nCheck the dashboard for notifications!');
        } else {
            console.error('❌ Failed:', response.status, response.statusText);
            const error = await response.text();
            console.error(error);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

insertTestVitals();
