import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ItineraryResponse, TravelInputs, LocalSpot, LocalSpotsInputs, TravelSearchResponse, TravelSearchInputs } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getLocalSpots(inputs: LocalSpotsInputs): Promise<LocalSpot[]> {
  let locationGuidance = "";
  if (inputs.locationMode === 'specific') {
    const startPoint = inputs.specificAddress || (inputs.specificCoordinates ? `${inputs.specificCoordinates.lat}, ${inputs.specificCoordinates.lng}` : '');
    const minutes = inputs.maxTravelMinutes || 15;
    if (startPoint) {
      locationGuidance = `
      CRITICAL LOCATION CONSTRAINT (GOOGLE MAPS PRECISION):
      The user is specifically starting from: "${startPoint}".
      You MUST only identify spots located extremely near this address, reachable within a maximum of ${minutes} minutes of travel (walking, driving, or public transit).
      Under no circumstances suggest spots that take longer than ${minutes} minutes of journey.
      Include a short travel description and estimate (e.g. "9 min walk" or "14 min drive") as the 'travelTimeEstimate' field.
      `;
    }
  }

  const prompt = `
    Identify 5 non-touristy, locally beloved spots in ${inputs.destination} that offer authentic experiences. 
    Focus on ${inputs.focus}. 
    The traveler has a budget of ${inputs.budgetAmount} ${inputs.currency} for these activities.
    For each spot, explain why it is special and provide a tip for visiting (e.g., best time to go, what to order).
    ${locationGuidance}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING, enum: ['food', 'culture', 'nature'] },
            whySpecial: { type: Type.STRING },
            tip: { type: Type.STRING },
            location: { type: Type.STRING },
            travelTimeEstimate: { type: Type.STRING, description: "Estimated travel time from the starting location, e.g. '8 min walk' or '12 min drive'" },
          },
          required: ["name", "category", "whySpecial", "tip", "location"],
        },
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to fetch local spots");
  }

  const spots = JSON.parse(response.text) as LocalSpot[];

  // Optimization: Only generate images for the first 3 spots to reduce latency
  const spotsWithImages = await Promise.all(spots.map(async (spot, idx) => {
    if (idx >= 3) return spot;
    try {
      const imageUrl = await generateDestinationImage(`${spot.name} in ${inputs.destination}`);
      return { ...spot, imageUrl };
    } catch (error) {
      console.error(`Failed to generate image for ${spot.name}:`, error);
      return spot;
    }
  }));

  return spotsWithImages;
}

export async function searchTravelDeals(inputs: TravelSearchInputs): Promise<TravelSearchResponse> {
  const destinationsStr = inputs.destinations.join(", ");
  const amenitiesStr = inputs.amenities && inputs.amenities.length > 0 
    ? `Prefer hotels with these amenities: ${inputs.amenities.join(", ")}.` 
    : "";
  const ratingStr = inputs.minRating ? `Only include hotels with a minimum rating of ${inputs.minRating} stars.` : "";
  const distanceStr = inputs.maxDistance ? `Prefer hotels within ${inputs.maxDistance} of the city center.` : "";
  const originStr = inputs.origin ? `Departure city: ${inputs.origin}.` : "Departure city: Not specified (search from all available departure points).";
  const dateStr = inputs.startDate && inputs.endDate 
    ? `Travel dates: From ${inputs.startDate} to ${inputs.endDate}.` 
    : "";
  const travelersStr = `Travelers count: ${inputs.adults || 1} adults${inputs.children ? `, ${inputs.children} children (Ages: ${inputs.childrenAges?.join(", ") || "Not specified"})` : ""}.`;

  const prompt = `
    Search for affordable flight options and highly-rated hotels for a trip to ${destinationsStr} for a budget of ${inputs.budgetAmount} ${inputs.currency}.
    ${originStr}
    ${dateStr}
    ${travelersStr}
    Provide real-time data or highly accurate estimates based on current trends.
    
    Hotel Preferences:
    - Budget: ${inputs.budgetAmount} ${inputs.currency} (${inputs.budget} category)
    - ${ratingStr}
    - ${distanceStr}
    - ${amenitiesStr}
    
    Flight Preferences:
    - Flight Type: ${inputs.flightType === 'oneway' ? 'One-way' : 'Round-trip'}.
    - Departure/Arrival or stay details align with the travel dates: ${dateStr || "flexible"}.
    - Number of passengers: ${travelersStr}.
    
    For flights, include airline, departure/arrival times, price, and duration.
    For hotels, include name, rating, price per night, distance from center, and key amenities.
    CRITICAL: For each hotel, provide a list of nearby points of interest including restaurants, tourist attractions, and public transportation options.
    Provide a direct booking URL for each (use common travel sites like Expedia, Booking.com, or Skyscanner).
    All costs MUST be in ${inputs.currency}.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hotels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                rating: { type: Type.NUMBER },
                pricePerNight: { type: Type.STRING },
                distanceFromCenter: { type: Type.STRING },
                amenities: { type: Type.ARRAY, items: { type: Type.STRING } },
                nearbyPointsOfInterest: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      type: { type: Type.STRING, description: "e.g., Restaurant, Attraction, Transport" },
                      description: { type: Type.STRING }
                    },
                    required: ["name", "type", "description"]
                  }
                },
                bookingUrl: { type: Type.STRING },
              },
              required: ["name", "rating", "pricePerNight", "distanceFromCenter", "amenities", "nearbyPointsOfInterest", "bookingUrl"],
            },
          },
          flights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                airline: { type: Type.STRING },
                departureTime: { type: Type.STRING },
                arrivalTime: { type: Type.STRING },
                price: { type: Type.STRING },
                duration: { type: Type.STRING },
                bookingUrl: { type: Type.STRING },
              },
              required: ["airline", "departureTime", "arrivalTime", "price", "duration", "bookingUrl"],
            },
          },
        },
        required: ["hotels", "flights"],
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to search travel deals");
  }

  const data = JSON.parse(response.text) as TravelSearchResponse;

  // Generate images for the top 2 hotels
  const hotelsWithImages = await Promise.all(data.hotels.map(async (hotel, idx) => {
    if (idx >= 2) return hotel;
    try {
      const imageUrl = await generateDestinationImage(`${hotel.name} hotel in ${inputs.destinations[0] || 'destination'}`);
      return { ...hotel, imageUrl };
    } catch (error) {
      return hotel;
    }
  }));

  return { ...data, hotels: hotelsWithImages };
}

export async function generateItinerary(inputs: TravelInputs): Promise<ItineraryResponse> {
  const destinationsStr = inputs.destination;
  const surpriseMePrompt = inputs.surpriseMe 
    ? "Include at least one 'Surprise' activity that is unique, off-the-beaten-path, and aligns with the traveler's profile but wasn't explicitly requested. Mark it clearly in the activity description." 
    : "";

  let locationGuidance = "";
  if (inputs.locationMode === 'specific') {
    const startPoint = inputs.specificAddress || (inputs.specificCoordinates ? `${inputs.specificCoordinates.lat}, ${inputs.specificCoordinates.lng}` : '');
    const minutes = inputs.maxTravelMinutes || 15;
    if (startPoint) {
      locationGuidance = `
      CRITICAL LOCALITY RESTRAINT:
      The traveler wants an itinerary centered tightly around a specific starting location: "${startPoint}".
      All recommended spots, restaurants, and attractions in the daily itinerary MUST be close to this start address and reachable within a maximum of ${minutes} minutes of travel (walking, public transit, or cycling/driving) from "${startPoint}".
      For each itinerary activity, provide estimated travel distance or time (e.g., "10 min walk" or "14 min taxi") in the 'travelTimeEstimate' field.
      Do not include activities that are further than ${minutes} minutes of travel away.
      `;
    }
  }

  let dailyTimingGuidance = "";
  if (inputs.dailyStartTime || inputs.dailyEndTime) {
    const startTimeStr = inputs.dailyStartTime || "morning";
    const endTimeStr = inputs.dailyEndTime || "night";
    dailyTimingGuidance = `
    DAILY TIMING CONSTRAINT:
    The traveler wants their daily itinerary schedule to start NO EARLIER than ${startTimeStr} and wrap up/conclude NO LATER than ${endTimeStr}.
    Please ensure all recommended daily activities (e.g. morning, afternoon, evening slots) operate strictly within this window. 
    Do not schedule any activities (such as early breakfasts or late-night events) outside of this timeframe.
    `;
  }

  const travelerDetails = `
    Destination: ${inputs.destination}
    Total Travelers: ${inputs.people}
    Adults: ${inputs.adults}
    Children: ${inputs.children}
    ${inputs.children > 0 ? `Children Ages: ${inputs.childrenAges.join(", ")}` : ""}
  `;

  const tripDuration = `
    Start Date: ${inputs.startDate}
    End Date: ${inputs.endDate}
    Duration: ${inputs.days} Days, ${inputs.nights} Nights
  `;

  const budgetInfo = `
    Budget: ${inputs.budgetAmount} ${inputs.currency} (${inputs.budget} category)
  `;

  const currentDate = "2026-03-11"; // Based on provided runtime context

  const prompt = `
    Act as an expert travel agent. Create a ${inputs.days}-day, ${inputs.nights}-night itinerary for ${destinationsStr} for a traveler/group already at or visiting this destination.
    ${travelerDetails}
    
    Trip Duration:
    ${tripDuration}
    
    Budget & Currency:
    ${budgetInfo}
    
    Traveler Profile: ${inputs.profile}
    Tempo: ${inputs.tempo}
    Preferences: ${inputs.preferences}
    Experience Type Preference: ${inputs.experienceType || "popular"} (either 'popular' for iconic attractions, or 'off-the-beaten-path' for lesser-known spots).
    
    CRITICAL EXPERIENCE TYPE INSTRUCTIONS:
    - If Experience Type is 'off-the-beaten-path': ensure the activities suggested are lesser-known, non-touristy, hidden spots. The 'hiddenGemNote' field for each activity must describe why this spot is a special hidden secret or how to see it like a local.
    - If Experience Type is 'popular': ensure the activities suggested are the famous, iconic landmarks and attractions. The 'hiddenGemNote' field must instead provide interesting tips, historical facts, or fascinating context for enjoying these well-known sites.
    ${surpriseMePrompt}
    ${locationGuidance}
    ${dailyTimingGuidance}

    Current Date: ${currentDate}
    
    CRITICAL: 
    1. Use the googleSearch tool to fetch the real-time weather forecast for ${destinationsStr} for the travel period (${inputs.startDate} to ${inputs.endDate}).
    2. Suggest specific transportation options or getting-around methods (public transit, taxi, walking) within ${destinationsStr}.
    3. All estimated costs MUST be displayed in ${inputs.currency}.
    4. Provide a 5-day weather forecast in an array named 'forecast', with each entry containing 'day', 'temperature', 'precipitationProbability', and 'windConditions'.
    
    Based on the weather forecast:
    1. Subtly adjust activity suggestions (e.g., if rain is expected, suggest indoor activities).
    2. Add a 'weatherNote' for activities with advice on attire or specific weather-related tips.
    3. Provide an 'indoorAlternative' for any outdoor plans in case of bad weather.
    4. Include a brief 'weatherSummary' in the logistics section.

    Provide a detailed daily schedule, a 5-day weather forecast, and a summary of logistics. 
    The estimated costs should be in ${inputs.currency}.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          itinerary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.INTEGER },
                time: { type: Type.STRING },
                activity: { type: Type.STRING },
                location: { type: Type.STRING },
                estimatedCost: { type: Type.STRING },
                hiddenGemNote: { type: Type.STRING, description: "A note tailored to Experience Type: if 'off-the-beaten-path', highlight the lesser-known/local secrete aspect. If 'popular', provide historical context or unique tips for the tourist attraction." },
                weatherNote: { type: Type.STRING, description: "Attire advice or weather-specific tip" },
                indoorAlternative: { type: Type.STRING, description: "Alternative activity if weather is bad" },
                travelTimeEstimate: { type: Type.STRING, description: "Estimated walking or transit time from user starting position, e.g. '10 min walk' or '15 min drive'" },
              },
              required: ["day", "time", "activity", "location", "estimatedCost", "hiddenGemNote"],
            },
          },
          logistics: {
            type: Type.OBJECT,
            properties: {
              transportMethods: { type: Type.STRING },
              accommodationAreas: { type: Type.STRING },
              generalTips: { type: Type.STRING },
              weatherSummary: { type: Type.STRING, description: "Brief weather forecast summary for the destinations" },
            },
            required: ["transportMethods", "accommodationAreas", "generalTips", "weatherSummary"],
          },
          forecast: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                temperature: { type: Type.STRING },
                precipitationProbability: { type: Type.STRING },
                windConditions: { type: Type.STRING },
              },
              required: ["day", "temperature", "precipitationProbability", "windConditions"],
            },
          },
        },
        required: ["itinerary", "logistics", "forecast"],
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to generate itinerary");
  }

  return JSON.parse(response.text) as ItineraryResponse;
}

export async function generateDestinationImage(destination: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A beautiful, high-quality travel photography style image of ${destination}. Cinematic lighting, vibrant colors, representative of the destination's atmosphere.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.warn(`Failed to generate AI image for ${destination}, using high-quality Unsplash travel fallback.`, error);
  }

  // Generate a beautiful, high-quality Unsplash image based on standard categories
  const travelFallbacks = [
    "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&q=80&w=800", // travel wanderlust
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=800", // passport / map
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=800", // beach sunset
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80&w=800", // scenic lake
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=800"  // scenic hills
  ];
  
  // Use a simple hash code of the destination name to pick a stable image link
  const hash = destination.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return travelFallbacks[hash % travelFallbacks.length];
}
