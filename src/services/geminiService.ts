import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ItineraryResponse, TravelInputs, LocalSpot, LocalSpotsInputs, TravelSearchResponse, TravelSearchInputs } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getLocalSpots(inputs: LocalSpotsInputs): Promise<LocalSpot[]> {
  const prompt = `
    Identify 5 non-touristy, locally beloved spots in ${inputs.city} that offer authentic experiences. 
    Focus on ${inputs.focus}. 
    For each spot, explain why it is special and provide a tip for visiting (e.g., best time to go, what to order).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
      const imageUrl = await generateDestinationImage(`${spot.name} in ${inputs.city}`);
      return { ...spot, imageUrl };
    } catch (error) {
      console.error(`Failed to generate image for ${spot.name}:`, error);
      return spot;
    }
  }));

  return spotsWithImages;
}

export async function searchTravelDeals(inputs: TravelSearchInputs): Promise<TravelSearchResponse> {
  const amenitiesStr = inputs.amenities && inputs.amenities.length > 0 
    ? `Prefer hotels with these amenities: ${inputs.amenities.join(", ")}.` 
    : "";
  const ratingStr = inputs.minRating ? `Only include hotels with a minimum rating of ${inputs.minRating} stars.` : "";
  const distanceStr = inputs.maxDistance ? `Prefer hotels within ${inputs.maxDistance} of the city center.` : "";

  const prompt = `
    Search for affordable flight options and highly-rated hotels in ${inputs.destination} for a ${inputs.budget} budget.
    Provide real-time data or highly accurate estimates based on current trends.
    
    Hotel Preferences:
    - Budget: ${inputs.budget}
    - ${ratingStr}
    - ${distanceStr}
    - ${amenitiesStr}

    For flights, include airline, departure/arrival times, price, and duration.
    For hotels, include name, rating, price per night, distance from center, and key amenities.
    Provide a direct booking URL for each (use common travel sites like Expedia, Booking.com, or Skyscanner).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
                bookingUrl: { type: Type.STRING },
              },
              required: ["name", "rating", "pricePerNight", "distanceFromCenter", "amenities", "bookingUrl"],
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
      const imageUrl = await generateDestinationImage(`${hotel.name} hotel in ${inputs.destination}`);
      return { ...hotel, imageUrl };
    } catch (error) {
      return hotel;
    }
  }));

  return { ...data, hotels: hotelsWithImages };
}

export async function generateItinerary(inputs: TravelInputs): Promise<ItineraryResponse> {
  const destinationsStr = inputs.destinations.join(", ");
  const surpriseMePrompt = inputs.surpriseMe 
    ? "Include at least one 'Surprise' activity that is unique, off-the-beaten-path, and aligns with the traveler's profile but wasn't explicitly requested. Mark it clearly in the activity description." 
    : "";

  const travelerDetails = `
    Origin: ${inputs.origin}
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
    Act as an expert travel agent. Create a ${inputs.days}-day, ${inputs.nights}-night multi-destination itinerary for ${destinationsStr} for the following group:
    ${travelerDetails}
    
    Trip Duration:
    ${tripDuration}
    
    Budget & Currency:
    ${budgetInfo}
    
    Traveler Profile: ${inputs.profile}
    Tempo: ${inputs.tempo}
    Preferences: ${inputs.preferences}
    ${surpriseMePrompt}

    Current Date: ${currentDate}
    
    CRITICAL: 
    1. Use the googleSearch tool to fetch the real-time weather forecast for the destinations (${destinationsStr}) for the travel period (${inputs.startDate} to ${inputs.endDate}).
    2. Suggest specific transportation options from the origin (${inputs.origin}) to the destinations and between them.
    3. All estimated costs MUST be displayed in ${inputs.currency}.
    
    Based on the weather forecast:
    1. Subtly adjust activity suggestions (e.g., if rain is expected, suggest indoor activities).
    2. Add a 'weatherNote' for activities with advice on attire or specific weather-related tips.
    3. Provide an 'indoorAlternative' for any outdoor plans in case of bad weather.
    4. Include a brief 'weatherSummary' in the logistics section.

    Provide a detailed daily schedule and a summary of logistics. 
    Crucially, include travel time and logistics between the destinations in the itinerary.
    The estimated costs should be in ${inputs.currency}.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
                hiddenGemNote: { type: Type.STRING },
                weatherNote: { type: Type.STRING, description: "Attire advice or weather-specific tip" },
                indoorAlternative: { type: Type.STRING, description: "Alternative activity if weather is bad" },
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
        },
        required: ["itinerary", "logistics"],
      },
    },
  });

  if (!response.text) {
    throw new Error("Failed to generate itinerary");
  }

  return JSON.parse(response.text) as ItineraryResponse;
}

export async function generateDestinationImage(destination: string): Promise<string> {
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

  throw new Error("Failed to generate image");
}
