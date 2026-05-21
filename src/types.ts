
export interface Expense {
  id: string;
  category: 'flights' | 'accommodation' | 'activities' | 'food' | 'other';
  amount: number;
  description: string;
  date: string;
}

export interface ForecastDay {
  day: string;
  temperature: string;
  precipitationProbability: string;
  windConditions: string;
}

export interface ItineraryItem {
  day: number;
  time: string;
  activity: string;
  location: string;
  estimatedCost: string;
  hiddenGemNote: string;
  weatherNote?: string;
  indoorAlternative?: string;
  travelTimeEstimate?: string; // e.g. "12 min walk" or "8 min drive"
}

export interface LogisticsSummary {
  transportMethods: string;
  accommodationAreas: string;
  generalTips: string;
  weatherSummary: string;
}

export interface ItineraryResponse {
  itinerary: ItineraryItem[];
  logistics: LogisticsSummary;
  forecast: ForecastDay[];
}

export interface LocalSpot {
  name: string;
  category: 'food' | 'culture' | 'nature';
  whySpecial: string;
  tip: string;
  location: string;
  imageUrl?: string;
  travelTimeEstimate?: string; // e.g. "15 min drive" or "10 min walk"
}

export interface LocalSpotsInputs {
  destination: string;
  focus: 'food' | 'culture' | 'nature';
  budgetAmount: number;
  currency: string;
  locationMode?: 'general' | 'specific';
  specificCoordinates?: { lat: number; lng: number };
  specificAddress?: string;
  maxTravelMinutes?: number;
}

export interface Hotel {
  name: string;
  rating: number;
  pricePerNight: string;
  distanceFromCenter: string;
  amenities: string[];
  nearbyPointsOfInterest: {
    name: string;
    type: string;
    description: string;
  }[];
  bookingUrl: string;
  imageUrl?: string;
}

export interface Flight {
  airline: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
  duration: string;
  bookingUrl: string;
}

export interface TravelSearchResponse {
  hotels: Hotel[];
  flights: Flight[];
}

export interface TravelSearchInputs {
  origin?: string;
  destinations: string[];
  budget: string;
  budgetAmount: number;
  currency: string;
  minRating?: number;
  maxDistance?: string;
  amenities?: string[];
  startDate?: string;
  endDate?: string;
  days?: number;
  nights?: number;
  people?: number;
  adults?: number;
  children?: number;
  childrenAges?: number[];
  flightType?: 'round' | 'oneway';
}

export interface TravelInputs {
  destination: string;
  startDate: string;
  endDate: string;
  days: number;
  nights: number;
  people: number;
  adults: number;
  children: number;
  childrenAges: number[];
  profile: string;
  budgetAmount: number;
  currency: string;
  budget: string; // Keep for backward compatibility or general category
  tempo: string;
  preferences: string;
  experienceType?: 'popular' | 'off-the-beaten-path';
  surpriseMe: boolean;
  locationMode?: 'general' | 'specific';
  specificCoordinates?: { lat: number; lng: number };
  specificAddress?: string;
  maxTravelMinutes?: number;
  dailyStartTime?: string;
  dailyEndTime?: string;
}
