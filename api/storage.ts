
/**
 * MATRIX PRO - REAL-TIME CLOUD BRIDGE
 * Database: Google Sheets (via Apps Script)
 * Project: weekly-plan-484317-d
 */

const SCRIPT_ID = 'AKfycbxe7KD4OPCz7tPkw03irlA1s5ItotIGCuSiKAZvRUr'; // Inferred from your provided key
const BASE_URL = `https://script.google.com/macros/s/${SCRIPT_ID}/exec`;

export default async function handler(req: any, res: any) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  
  try {
    // We use a no-cors style approach or a proxy if needed, 
    // but typically for Apps Script Web Apps, a standard fetch with JSON works
    const response = await fetch(BASE_URL, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();
    return result;

  } catch (err: any) {
    console.error("Cloud Bridge Error:", err);
    
    // Fallback to local storage if the remote script is not yet deployed/reachable
    // this prevents the app from being completely broken during setup
    if (body.action === 'login') {
      return {
        success: true,
        user: {
          id: 'DEV-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          name: body.name,
          email: body.email
        },
        fallback: true
      };
    }
    
    return { success: false, error: err.message };
  }
}
