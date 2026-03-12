
export interface ItineraryItem {
  day: number;
  time: string;
  activity: string;
  location: string;
  estimatedCost: string;
  hiddenGemNote: string;
  weatherNote?: string;
  indoorAlternative?: string;
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
}

export interface LocalSpot {
  name: string;
  category: 'food' | 'culture' | 'nature';
  whySpecial: string;
  tip: string;
  location: string;
  imageUrl?: string;
}

export interface LocalSpotsInputs {
  city: string;
  focus: 'food' | 'culture' | 'nature';
}

export interface Hotel {
  name: string;
  rating: number;
  pricePerNight: string;
  distanceFromCenter: string;
  amenities: string[];
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
  destination: string;
  budget: string;
  minRating?: number;
  maxDistance?: string;
  amenities?: string[];
}

export interface TravelInputs {
  origin: string;
  destinations: string[];
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
  surpriseMe: boolean;
}
