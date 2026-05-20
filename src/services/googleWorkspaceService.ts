import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { ItineraryResponse, ItineraryItem } from '../types';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Calendar, Sheets scopes, and email profiles
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedUser = user;
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token is not in memory but user is signed in, we need the user to trigger signInWithPopup to refresh token,
        // or if credentials are saved.
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedUser = null;
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    cachedUser = result.user;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getAuthUser = (): User | null => {
  return cachedUser;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  cachedUser = null;
};

// URL Sharing Encoder/Decoder
export function encodeItinerary(itinerary: ItineraryResponse, destination: string, startDate: string): string {
  const data = { itinerary, destination, startDate };
  const str = JSON.stringify(data);
  const bytes = new TextEncoder().encode(str);
  const binary = Array.from(bytes).map(byte => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

export function decodeItinerary(hash: string): { itinerary: ItineraryResponse; destination: string; startDate: string } | null {
  try {
    const binary = atob(hash);
    const bytes = new Uint8Array(Array.from(binary).map(char => char.charCodeAt(0)));
    const str = new TextDecoder().decode(bytes);
    return JSON.parse(str);
  } catch (e) {
    console.error("Failed to decode itinerary:", e);
    return null;
  }
}

// 1. Google Calendar Integration
export async function addItineraryToCalendar(
  items: ItineraryItem[],
  destination: string,
  startDateStr: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("Authentication required. Please sign in with Google.");
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    let count = 0;

    for (const item of items) {
      const dates = getEventDateTime(startDateStr, item.day, item.time);
      const eventBody = {
        summary: `Trip to ${destination}: ${item.activity}`,
        location: item.location || destination,
        description: `Activity: ${item.activity}\nEstimated Cost: ${item.estimatedCost}\nTips: ${item.hiddenGemNote || 'No special tips'}`,
        start: {
          dateTime: dates.start,
          timeZone: timeZone
        },
        end: {
          dateTime: dates.end,
          timeZone: timeZone
        }
      };

      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(eventBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Calendar API Error:", errText);
        throw new Error(`Failed to create event for Day ${item.day}: ${response.statusText}`);
      }
      count++;
    }

    return { success: true, count };
  } catch (err: any) {
    console.error("Error adding to calendar:", err);
    return { success: false, count: 0, error: err.message || String(err) };
  }
}

// Helper to calculate start/end time based on date & visual time text
function getEventDateTime(startDateStr: string, dayNum: number, timeStr: string): { start: string; end: string } {
  const baseDate = new Date(startDateStr);
  baseDate.setDate(baseDate.getDate() + (dayNum - 1));
  const datePart = baseDate.toISOString().split('T')[0];

  let hours = 9;
  let minutes = 0;
  const cleanTime = timeStr.trim().toLowerCase();
  const timeMatch = cleanTime.match(/(\d+):(\d+)\s*(am|pm)?/);

  if (timeMatch) {
    hours = parseInt(timeMatch[1]);
    minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3];
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  } else {
    if (cleanTime.includes('morning') || cleanTime.includes('breakfast')) {
      hours = 9;
    } else if (cleanTime.includes('lunch') || cleanTime.includes('midday') || cleanTime.includes('noon')) {
      hours = 12;
    } else if (cleanTime.includes('afternoon')) {
      hours = 14;
    } else if (cleanTime.includes('dinner') || cleanTime.includes('evening') || cleanTime.includes('night')) {
      hours = 18;
    }
  }

  const paddedHours = String(hours).padStart(2, '0');
  const paddedMinutes = String(minutes).padStart(2, '0');
  const startISO = `${datePart}T${paddedHours}:${paddedMinutes}:00`;

  const finishedDate = new Date(`${datePart}T${paddedHours}:${paddedMinutes}:00`);
  finishedDate.setMinutes(finishedDate.getMinutes() + 120); // 2 hours each activity
  const endHours = String(finishedDate.getHours()).padStart(2, '0');
  const endMinutes = String(finishedDate.getMinutes()).padStart(2, '0');
  const endISO = `${datePart}T${endHours}:${endMinutes}:00`;

  return { start: startISO, end: endISO };
}

// 2. Google Sheets Integration
export async function addItineraryToSheets(
  items: ItineraryItem[],
  destination: string,
  startDateStr: string
): Promise<{ success: boolean; spreadsheetUrl?: string; error?: string }> {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("Authentication required. Please sign in with Google.");
    }

    // 1. Create a Spreadsheet
    const createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: {
          title: `My VoyageAI Trip to ${destination}`
        }
      })
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create spreadsheet: ${createResponse.statusText}`);
    }

    const spreadsheet = await createResponse.json();
    const spreadsheetId = spreadsheet.spreadsheetId;
    const spreadsheetUrl = spreadsheet.spreadsheetUrl;

    // 2. Append values
    const rows = [
      [`VoyageAI Trip Itinerary - ${destination}`],
      [`Start Date: ${startDateStr}`],
      [],
      ["Day", "Time", "Activity", "Location", "Estimated Cost", "Tips & Details"]
    ];

    items.forEach(item => {
      rows.push([
        `Day ${item.day}`,
        item.time,
        item.activity,
        item.location,
        item.estimatedCost,
        item.hiddenGemNote || ""
      ]);
    });

    const appendResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          values: rows
        })
      }
    );

    if (!appendResponse.ok) {
      throw new Error(`Failed to populate spreadsheet: ${appendResponse.statusText}`);
    }

    return { success: true, spreadsheetUrl };
  } catch (err: any) {
    console.error("Error adding to sheets:", err);
    return { success: false, error: err.message || String(err) };
  }
}
