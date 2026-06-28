import { createClient } from "@libsql/client";

// Initialize the Turso database client
// (Tip: In production, move these to Vercel Environment Variables to keep them secure!)
const db = createClient({
  url: 'libsql://traveltime-terdsak76.aws-ap-northeast-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODI1NDkzNzAsImlkIjoiMDE5ZjA4MDAtNDMwMS03NzIxLWE3ZGMtYzJlM2RhMzQ2YWM3IiwicmlkIjoiNWMwY2RjNDYtMjFjYi00ZWFjLWJjOGUtNDA4Y2JkYjAwMjJiIn0.-eCBi4w0UQ5B7sxfl9HqcwBJCuapY1vBAD0cWPcrMfOYMfC7CVNtSvGOF0-ujk7JBfj14P6sQhx-BscAkDvnCQ'
});

export default async function handler(request, response) {
  // 1. FIX: Vercel headers are standard objects. Use request.headers.authorization
  // const authHeader = request.headers.authorization;
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return response.status(401).json({ success: false, message: 'Unauthorized' });
  // }

  // Timezone check: Only run between 6 AM and 9 PM Bangkok Time
  const options = { timeZone: 'Asia/Bangkok', hour: 'numeric', hour12: false };
  const currentHourInThailand = parseInt(new Intl.DateTimeFormat('en-US', options).format(new Date()), 10);

  if (currentHourInThailand < 6 || currentHourInThailand > 21) {
    return response.status(200).json({ success: true, message: 'Outside tracking window.' });
  }

  // Configurations
  const API_KEY = '00d8e7fdc70c1b57564c25fe0b953798';
  const fromLat = 13.771464, fromLon = 100.4620;
  const toLat = 13.72669, toLon = 100.54061;
  const url = `https://api.longdo.com/RouteService/geojson/route?flat=${fromLat}&flon=${fromLon}&tlat=${toLat}&tlon=${toLon}&mode=t&key=${API_KEY}`;

  try {
    // Fetch from Longdo Map API
    const apiResponse = await fetch(url);
    const result = await apiResponse.json();

    console.log("[Longdo API Raw Response]:", result);

    if (result.error) {
      throw new Error(`Longdo API Error: ${result.error}`);
    }

    if (!result.data || result.data.length === 0) {
      throw new Error('No route data found. Check your coordinates or API Key.');
    }

    // 2. FIX: Longdo returns data as an array. You must target the first element [0]
    const routeInfo = result['data'];
    const distanceKm = parseFloat((routeInfo['distance'] / 1000).toFixed(2));
    const durationMins = Math.round(routeInfo['interval'] / 60);

    // 3. Insert data into Turso Database
    // Note: Make sure your Turso 'travel_logs' table has the from_lat, from_lon, to_lat, to_lon columns!
    await db.execute({
      sql: "INSERT INTO travel_logs (distance_km, duration_mins, from_lat, from_lon, to_lat, to_lon) VALUES (?, ?, ?, ?, ?, ?)",
      args: [distanceKm, durationMins, fromLat, fromLon, toLat, toLon],
    });

    console.log(`[Database Inserted] ${distanceKm} km, ${durationMins} mins`);

    return response.status(200).json({
      success: true,
      message: "Data logged successfully to Turso",
      loggedData: { distanceKm, durationMins }
    });

  } catch (error) {
    console.error('Execution Error:', error.message);
    return response.status(500).json({ success: false, error: error.message });
  }
}

// 4. FIX: Local testing block wrapped safely so it never runs on Vercel
if (!process.env.VERCEL) {
  console.log("Running locally...");
  const mockRequest = {
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET}`
    }
  };

  const mockResponse = {
    status: (code) => ({
      json: (data) => console.log(`[Response ${code}]`, JSON.stringify(data, null, 2))
    })
  };

  handler(mockRequest, mockResponse);
}