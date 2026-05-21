import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plane, 
  Calendar, 
  Users, 
  Wallet, 
  Clock, 
  Sparkles, 
  MapPin, 
  Info, 
  Loader2,
  ChevronRight,
  Gem,
  Bus,
  Home,
  Utensils,
  Palmtree,
  Theater,
  Search,
  Cloud,
  Hotel as HotelIcon,
  Tickets,
  ArrowRight,
  Star,
  ExternalLink,
  Share2,
  Mail,
  FileSpreadsheet,
  CalendarDays,
  FileDown,
  Copy,
  Check,
  LogOut,
  LogIn,
  Compass,
  Navigation,
  Locate,
  Repeat
} from 'lucide-react';
import { generateItinerary, getLocalSpots, generateDestinationImage, searchTravelDeals } from './services/geminiService';
import { ItineraryResponse, TravelInputs, LocalSpot, LocalSpotsInputs, TravelSearchResponse, TravelSearchInputs, Expense } from './types';
import BudgetTracker from './components/BudgetTracker';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  addItineraryToCalendar, 
  addItineraryToSheets, 
  encodeItinerary, 
  decodeItinerary
} from './services/googleWorkspaceService';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';

const GOOGLE_MAPS_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_KEY) && GOOGLE_MAPS_KEY !== 'YOUR_API_KEY';

type Tab = 'itinerary' | 'secrets' | 'deals' | 'budget';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('itinerary');
  
  // Itinerary State
  const [inputs, setInputs] = useState<TravelInputs>({
    destination: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    days: 3,
    nights: 2,
    people: 2,
    adults: 2,
    children: 0,
    childrenAges: [],
    profile: 'Adventure seeker',
    budgetAmount: 2000,
    currency: 'USD',
    budget: 'Mid-range',
    tempo: 'Packed',
    preferences: '',
    experienceType: 'popular',
    surpriseMe: false,
    locationMode: 'general',
    specificCoordinates: undefined,
    specificAddress: '',
    maxTravelMinutes: 30,
    dailyStartTime: '09:00',
    dailyEndTime: '21:00'
  });
  const [itineraryResult, setItineraryResult] = useState<ItineraryResponse | null>(null);
  const [destinationImage, setDestinationImage] = useState<string | null>(null);

  // Local Spots State
  const [localInputs, setLocalInputs] = useState<LocalSpotsInputs>({
    destination: '',
    focus: 'food',
    budgetAmount: 500,
    currency: 'USD',
    locationMode: 'general',
    specificCoordinates: undefined,
    specificAddress: '',
    maxTravelMinutes: 30
  });
  const [localSpotsResult, setLocalSpotsResult] = useState<LocalSpot[] | null>(null);

  // Deals State
  const [dealsInputs, setDealsInputs] = useState<TravelSearchInputs>({
    origin: '',
    destinations: [''],
    budget: 'Mid-range',
    budgetAmount: 3000,
    currency: 'USD',
    minRating: 4,
    maxDistance: '5km',
    amenities: [],
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    days: 4,
    nights: 3,
    people: 1,
    adults: 1,
    children: 0,
    childrenAges: [],
    flightType: 'round'
  });
  const [dealsResult, setDealsResult] = useState<TravelSearchResponse | null>(null);

  // Budget State
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Authentication & Sharing state
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharedLink, setSharedLink] = useState('');
  const [shareEmailText, setShareEmailText] = useState('');
  const [calendarStatus, setCalendarStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sheetsStatus, setSheetsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [authError, setAuthError] = useState('');

  // 1. Initialise auth & check for shared link
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );

    const params = new URLSearchParams(window.location.search);
    const shared = params.get('sharedItinerary');
    if (shared) {
      const decoded = decodeItinerary(shared);
      if (decoded) {
        setItineraryResult(decoded.itinerary);
        setInputs(prev => ({
          ...prev,
          destination: decoded.destination,
          startDate: decoded.startDate,
        }));
        setActiveTab('itinerary');
      }
    }

    return () => unsubscribe();
  }, []);

  // 2. Automatically update sharedLink and shareEmailText when itinerary changes
  useEffect(() => {
    if (itineraryResult) {
      const hash = encodeItinerary(itineraryResult, inputs.destination, inputs.startDate);
      const link = `${window.location.origin}${window.location.pathname}?sharedItinerary=${hash}`;
      setSharedLink(link);
      setShareEmailText(`mailto:?subject=My VoyageAI Trip Itinerary to ${inputs.destination}&body=Check out my custom itinerary for a trip to ${inputs.destination} generated on VoyageAI! %0D%0A%0D%0AView Itinerary: ${encodeURIComponent(link)}`);
    } else {
      setSharedLink('');
      setShareEmailText('');
    }
    setCalendarStatus('idle');
    setSheetsStatus('idle');
    setSheetsUrl('');
  }, [itineraryResult, inputs.destination, inputs.startDate]);

  const handleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError('');
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to sign in with Google');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
  };

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleLocateMe = (tab: 'itinerary' | 'secrets') => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coordsStr = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        let resolvedAddress = `GPS: ${coordsStr}`;
        
        if (tab === 'itinerary') {
          setInputs(prev => ({
            ...prev,
            destination: prev.destination || "My Location",
            specificCoordinates: { lat: latitude, lng: longitude },
            specificAddress: resolvedAddress
          }));
        } else {
          setLocalInputs(prev => ({
            ...prev,
            destination: prev.destination || "My Location",
            specificCoordinates: { lat: latitude, lng: longitude },
            specificAddress: resolvedAddress
          }));
        }
        
        // Try reverse geocoding if google.maps is loaded of maps library
        try {
          if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                const address = results[0].formatted_address;
                const cityComponent = results[0].address_components.find(c => c.types.includes('locality'));
                const cityName = cityComponent ? cityComponent.long_name : "";
                
                if (tab === 'itinerary') {
                  setInputs(prev => ({
                    ...prev,
                    destination: cityName || prev.destination || "My Location",
                    specificAddress: address
                  }));
                } else {
                  setLocalInputs(prev => ({
                    ...prev,
                    destination: cityName || prev.destination || "My Location",
                    specificAddress: address
                  }));
                }
              }
            });
          }
        } catch (err) {
          console.warn("Geocoder reverse geocoding not ready:", err);
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError("Permission denied or GPS signal lost. Please enter address manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(sharedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleAddToCalendar = async () => {
    if (!itineraryResult) return;
    setCalendarStatus('loading');
    const result = await addItineraryToCalendar(itineraryResult.itinerary, inputs.destination, inputs.startDate);
    if (result.success) {
      setCalendarStatus('success');
    } else {
      setCalendarStatus('error');
    }
  };

  const handleAddToSheets = async () => {
    if (!itineraryResult) return;
    setSheetsStatus('loading');
    const result = await addItineraryToSheets(itineraryResult.itinerary, inputs.destination, inputs.startDate);
    if (result.success && result.spreadsheetUrl) {
      setSheetsUrl(result.spreadsheetUrl);
      setSheetsStatus('success');
    } else {
      setSheetsStatus('error');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleItinerarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputs.destination.trim()) {
      setError('Please fill in your destination.');
      return;
    }
    setLoading(true);
    setLoadingStep('Analyzing destination...');
    setError(null);
    setDestinationImage(null);
    try {
      setLoadingStep('Fetching real-time weather & crafting activities...');
      const [itineraryData, imageData] = await Promise.all([
        generateItinerary(inputs),
        generateDestinationImage(inputs.destination)
      ]);
      setLoadingStep('Finalizing your dream trip...');
      setItineraryResult(itineraryData);
      setDestinationImage(imageData);
    } catch (err) {
      setError('Failed to generate your dream trip. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addDealsDestination = () => {
    setDealsInputs({ ...dealsInputs, destinations: [...dealsInputs.destinations, ''] });
  };

  const removeDealsDestination = (index: number) => {
    const newDestinations = dealsInputs.destinations.filter((_, i) => i !== index);
    setDealsInputs({ ...dealsInputs, destinations: newDestinations });
  };

  const updateDealsDestination = (index: number, value: string) => {
    const newDestinations = [...dealsInputs.destinations];
    newDestinations[index] = value;
    setDealsInputs({ ...dealsInputs, destinations: newDestinations });
  };

  const updateDealsAdults = (val: number) => {
    const adults = Math.max(1, val);
    setDealsInputs({ ...dealsInputs, adults, people: adults + (dealsInputs.children || 0) });
  };

  const updateDealsChildren = (val: number) => {
    const children = Math.max(0, val);
    let childrenAges = [...(dealsInputs.childrenAges || [])];
    const prevChildren = dealsInputs.children || 0;
    if (children > prevChildren) {
      childrenAges.push(10); // Default age
    } else if (children < prevChildren) {
      childrenAges = childrenAges.slice(0, children);
    }
    setDealsInputs({ ...dealsInputs, children, childrenAges, people: (dealsInputs.adults || 1) + children });
  };

  const updateDealsChildAge = (index: number, age: number) => {
    const childrenAges = [...(dealsInputs.childrenAges || [])];
    childrenAges[index] = age;
    setDealsInputs({ ...dealsInputs, childrenAges });
  };

  const handleDealsDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newInputs = { ...dealsInputs, [field]: value };
    const { days, nights } = calculateDuration(newInputs.startDate || '', newInputs.endDate || '');
    setDealsInputs({ ...newInputs, days, nights });
  };

  const updateAdults = (val: number) => {
    const adults = Math.max(1, val);
    setInputs({ ...inputs, adults, people: adults + inputs.children });
  };

  const updateChildren = (val: number) => {
    const children = Math.max(0, val);
    let childrenAges = [...inputs.childrenAges];
    if (children > inputs.children) {
      childrenAges.push(10); // Default age
    } else if (children < inputs.children) {
      childrenAges = childrenAges.slice(0, children);
    }
    setInputs({ ...inputs, children, childrenAges, people: inputs.adults + children });
  };

  const updateChildAge = (index: number, age: number) => {
    const childrenAges = [...inputs.childrenAges];
    childrenAges[index] = age;
    setInputs({ ...inputs, childrenAges });
  };

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const diffNights = diffDays - 1;
    return { days: diffDays, nights: diffNights };
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newInputs = { ...inputs, [field]: value };
    const { days, nights } = calculateDuration(newInputs.startDate, newInputs.endDate);
    setInputs({ ...newInputs, days, nights });
  };

  const handleLocalSpotsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoadingStep('Searching for hidden gems...');
    setError(null);
    try {
      const data = await getLocalSpots(localInputs);
      setLocalSpotsResult(data);
    } catch (err) {
      setError('Failed to find local secrets. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDealsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dealsInputs.destinations.some(d => !d.trim())) {
      setError('Please fill in all destinations.');
      return;
    }
    setLoading(true);
    setLoadingStep('Scanning travel APIs for the best deals...');
    setError(null);
    try {
      const data = await searchTravelDeals(dealsInputs);
      setDealsResult(data);
    } catch (err) {
      setError('Failed to find travel deals. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    const current = dealsInputs.amenities || [];
    if (current.includes(amenity)) {
      setDealsInputs({ ...dealsInputs, amenities: current.filter(a => a !== amenity) });
    } else {
      setDealsInputs({ ...dealsInputs, amenities: [...current, amenity] });
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f2ed] text-[#1a1a1a] font-sans selection:bg-emerald-100">
      {/* Hero Section */}
      <header className="relative h-[40vh] flex items-center justify-center overflow-hidden bg-stone-900 print:hidden">
        {/* Google Authentication Status Float */}
        <div className="absolute top-4 right-4 z-30 no-print">
          {user ? (
            <div className="flex items-center gap-3 bg-stone-900/80 backdrop-blur-md px-3.5 py-2 rounded-full border border-stone-800 text-white shadow-xl">
              {user.photoURL && (
                <img src={user.photoURL} alt={user.displayName || ""} className="w-5 h-5 rounded-full object-cover border border-white/20" referrerPolicy="no-referrer" />
              )}
              <span className="text-[11px] font-medium hidden sm:inline">{user.displayName}</span>
              <button 
                onClick={handleSignOut} 
                className="text-stone-400 hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleSignIn}
              disabled={isAuthLoading}
              className="flex items-center gap-2 bg-white hover:bg-stone-50 text-stone-900 font-semibold text-xs px-4 py-2.5 rounded-full shadow-lg border border-stone-200 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {isAuthLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5 text-red-500" />
              )}
              <span>Sync with Google</span>
            </button>
          )}
        </div>

        <img 
          src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=1920" 
          alt="Travel background" 
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          referrerPolicy="no-referrer"
        />
        <div className="relative z-10 text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-7xl font-serif text-white mb-4 tracking-tight">
              Voyage<span className="italic">AI</span>
            </h1>
            <p className="text-stone-200 text-lg md:text-xl max-w-2xl mx-auto font-light">
              Your personal AI travel concierge. Crafting bespoke journeys for the modern explorer.
            </p>
          </motion.div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12 -mt-20 relative z-20 print:py-0 print:mt-0 print:max-w-full">
        {/* Tab Switcher */}
        <div className="flex justify-center mb-8 no-print">
          <div className="bg-white/80 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-white/20 flex gap-1">
            <button 
              onClick={() => setActiveTab('itinerary')}
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'itinerary' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:text-stone-900'}`}
            >
              Itinerary Planner
            </button>
            <button 
              onClick={() => setActiveTab('secrets')}
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'secrets' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:text-stone-900'}`}
            >
              Local Secrets
            </button>
            <button 
              onClick={() => setActiveTab('deals')}
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'deals' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:text-stone-900'}`}
            >
              Hotels & Flights
            </button>
            <button 
              onClick={() => setActiveTab('budget')}
              className={`px-6 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'budget' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:text-stone-900'}`}
            >
              Budget Tracker
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Input Form Column */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4 no-print"
          >
            <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 p-8 border border-stone-100 sticky top-8">
              <AnimatePresence mode="wait">
                {activeTab === 'itinerary' ? (
                  <motion.div
                    key="itinerary-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <h2 className="text-2xl font-serif mb-6 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-600" />
                      Plan Your Trip
                    </h2>
                    
                    <form onSubmit={handleItinerarySubmit} className="space-y-5">
                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Destination</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input 
                            type="text"
                            required
                            placeholder="e.g. Kyoto, Japan (Where you are or visiting now)"
                            className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            value={inputs.destination}
                            onChange={e => setInputs({...inputs, destination: e.target.value})}
                          />
                        </div>
                      </div>

                      {/* Location Specificity Selector */}
                      <div className="space-y-3">
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 block">Location Focus Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setInputs({ ...inputs, locationMode: 'general' })}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs uppercase font-bold transition-all cursor-pointer ${
                              (inputs.locationMode || 'general') === 'general'
                                ? 'bg-stone-900 border-stone-900 text-white shadow-md'
                                : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                            }`}
                          >
                            <Compass className="w-4 h-4" />
                            General Area
                          </button>
                          <button
                            type="button"
                            onClick={() => setInputs({ ...inputs, locationMode: 'specific' })}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs uppercase font-bold transition-all cursor-pointer ${
                              inputs.locationMode === 'specific'
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                                : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                            }`}
                          >
                            <Navigation className="w-4 h-4" />
                            Specific Point
                          </button>
                        </div>

                        <AnimatePresence>
                          {inputs.locationMode === 'specific' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden space-y-4 pt-2 border-t border-stone-100"
                            >
                              <div>
                                <div className="flex justify-between items-center mb-1.5">
                                  <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 block">Starting Point / Address</label>
                                  <span className="text-[10px] text-stone-500 italic block">Maps link or area name is ok</span>
                                </div>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                    <input 
                                      type="text"
                                      required={inputs.locationMode === 'specific'}
                                      placeholder="e.g. Kyoto Station, Google Maps link, or map area name"
                                      className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                                      value={inputs.specificAddress || ''}
                                      onChange={e => setInputs({...inputs, specificAddress: e.target.value})}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleLocateMe('itinerary')}
                                    disabled={locating}
                                    className="px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl flex items-center justify-center gap-1 text-xs font-semibold border border-stone-200 transition-all cursor-pointer whitespace-nowrap"
                                    title="Detect my location with GPS"
                                  >
                                    <Locate className={`w-4 h-4 ${locating ? 'animate-spin text-emerald-600' : 'text-stone-500'}`} />
                                    {locating ? 'Locating...' : 'Locate Me'}
                                  </button>
                                </div>
                                {locationError && (
                                  <p className="text-[10px] text-red-500 mt-1">{locationError}</p>
                                )}
                              </div>

                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 block">Nearby Travel Limit (Minutes)</label>
                                  <span className="text-sm font-semibold text-emerald-600 font-mono">{inputs.maxTravelMinutes || 30} mins</span>
                                </div>
                                <div className="space-y-3">
                                  <input 
                                    type="range"
                                    min="5"
                                    max="90"
                                    step="5"
                                    className="w-full h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    value={inputs.maxTravelMinutes || 30}
                                    onChange={e => setInputs({...inputs, maxTravelMinutes: parseInt(e.target.value)})}
                                  />
                                  <div className="flex justify-between items-center bg-stone-50 p-2 rounded-xl border border-stone-100 text-stone-500 text-[10px]">
                                    <div className="flex gap-1 items-center">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                      <span>5-15m (Walking)</span>
                                    </div>
                                    <div className="flex gap-1 items-center">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                      <span>30-45m (Transit)</span>
                                    </div>
                                    <div className="flex gap-1 items-center">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                      <span>60-90m (Driving)</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Interactive Map element */}
                              {hasValidMapsKey && inputs.specificCoordinates && (
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400 block">Location Map Marker</span>
                                  <div className="h-44 w-full rounded-2xl overflow-hidden border border-stone-100 shadow-inner">
                                    <Map
                                      defaultCenter={inputs.specificCoordinates}
                                      center={inputs.specificCoordinates}
                                      defaultZoom={14}
                                      zoom={14}
                                      mapId="DEMO_MAP_ID"
                                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                                      style={{ width: '100%', height: '100%' }}
                                      gestureHandling="cooperative"
                                    >
                                      <AdvancedMarker position={inputs.specificCoordinates}>
                                        <Pin background="#10b981" glyphColor="#fff font-weight: bold" />
                                      </AdvancedMarker>
                                    </Map>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Start Date</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <input 
                              type="date"
                              required
                              className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                              value={inputs.startDate}
                              onChange={e => handleDateChange('startDate', e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">End Date</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <input 
                              type="date"
                              required
                              className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                              value={inputs.endDate}
                              onChange={e => handleDateChange('endDate', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Daily Start Time</label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <input 
                              type="time"
                              required
                              className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                              value={inputs.dailyStartTime || '09:00'}
                              onChange={e => setInputs({...inputs, dailyStartTime: e.target.value})}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Daily End Time</label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <input 
                              type="time"
                              required
                              className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm font-medium"
                              value={inputs.dailyEndTime || '21:00'}
                              onChange={e => setInputs({...inputs, dailyEndTime: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Days / Nights</label>
                          <div className="flex items-center gap-2 bg-stone-50 border border-stone-100 rounded-xl p-3 text-sm font-medium text-stone-600">
                            <Clock className="w-4 h-4 text-stone-400" />
                            <span>{inputs.days} Days / {inputs.nights} Nights</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Adults</label>
                          <div className="flex items-center gap-2 bg-stone-50 border border-stone-100 rounded-xl p-1">
                            <button 
                              type="button"
                              onClick={() => updateAdults(inputs.adults - 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors text-stone-600"
                            >
                              -
                            </button>
                            <span className="flex-1 text-center text-sm font-medium">{inputs.adults}</span>
                            <button 
                              type="button"
                              onClick={() => updateAdults(inputs.adults + 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors text-stone-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Children</label>
                          <div className="flex items-center gap-2 bg-stone-50 border border-stone-100 rounded-xl p-1">
                            <button 
                              type="button"
                              onClick={() => updateChildren(inputs.children - 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors text-stone-600"
                            >
                              -
                            </button>
                            <span className="flex-1 text-center text-sm font-medium">{inputs.children}</span>
                            <button 
                              type="button"
                              onClick={() => updateChildren(inputs.children + 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors text-stone-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Total</label>
                          <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <input 
                              type="number"
                              disabled
                              className="w-full pl-10 pr-4 py-3 bg-stone-100 border border-stone-100 rounded-xl text-stone-500 cursor-not-allowed"
                              value={inputs.people}
                            />
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {inputs.children > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 overflow-hidden"
                          >
                            <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 block">Children's Ages</label>
                            <div className="grid grid-cols-3 gap-2">
                              {inputs.childrenAges.map((age, idx) => (
                                <div key={idx} className="space-y-1">
                                  <span className="text-[10px] text-stone-400 block">Child {idx + 1}</span>
                                  <input 
                                    type="number"
                                    min="0"
                                    max="17"
                                    className="w-full px-2 py-2 bg-stone-50 border border-stone-100 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    value={age}
                                    onChange={e => updateChildAge(idx, parseInt(e.target.value))}
                                  />
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Traveler Profile</label>
                        <select 
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
                          value={inputs.profile}
                          onChange={e => setInputs({...inputs, profile: e.target.value})}
                        >
                          <option>Foodie</option>
                          <option>Adventure seeker</option>
                          <option>Family</option>
                          <option>Culture enthusiast</option>
                          <option>Relaxation</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Budget & Currency</label>
                        <div className="space-y-4">
                          <div className="flex gap-4">
                            <div className="relative flex-1">
                              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                              <select 
                                className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
                                value={inputs.currency}
                                onChange={e => setInputs({...inputs, currency: e.target.value})}
                              >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="JPY">JPY (¥)</option>
                                <option value="AUD">AUD (A$)</option>
                                <option value="CAD">CAD (C$)</option>
                                <option value="INR">INR (₹)</option>
                              </select>
                            </div>
                            <div className="relative flex-1">
                              <select 
                                className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
                                value={inputs.budget}
                                onChange={e => setInputs({...inputs, budget: e.target.value})}
                              >
                                <option>Budget</option>
                                <option>Mid-range</option>
                                <option>Luxury</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium text-stone-500">
                              <span>Amount: {inputs.budgetAmount.toLocaleString()} {inputs.currency}</span>
                            </div>
                            <input 
                              type="range"
                              min="100"
                              max="20000"
                              step="100"
                              className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              value={inputs.budgetAmount}
                              onChange={e => setInputs({...inputs, budgetAmount: parseInt(e.target.value)})}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Tempo</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <select 
                            className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
                            value={inputs.tempo}
                            onChange={e => setInputs({...inputs, tempo: e.target.value})}
                          >
                            <option>Slow</option>
                            <option>Relaxed</option>
                            <option>Packed</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 block">Experience Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setInputs({ ...inputs, experienceType: 'popular' })}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs uppercase font-bold transition-all cursor-pointer ${
                              (inputs.experienceType || 'popular') === 'popular'
                                ? 'bg-stone-900 border-stone-900 text-white shadow-md'
                                : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                            }`}
                          >
                            <Sparkles className="w-4 h-4" />
                            Popular
                          </button>
                          <button
                            type="button"
                            onClick={() => setInputs({ ...inputs, experienceType: 'off-the-beaten-path' })}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs uppercase font-bold transition-all cursor-pointer ${
                              inputs.experienceType === 'off-the-beaten-path'
                                ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                                : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                            }`}
                          >
                            <Compass className="w-4 h-4" />
                            Off-beaten-path
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Preferences</label>
                        <textarea 
                          placeholder="e.g. No museums, lots of hiking, vegetarian options..."
                          className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all min-h-[100px]"
                          value={inputs.preferences}
                          onChange={e => setInputs({...inputs, preferences: e.target.value})}
                        />
                      </div>

                      <div className="flex items-center gap-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                        <input 
                          type="checkbox"
                          id="surpriseMe"
                          className="w-5 h-5 rounded border-emerald-200 text-emerald-600 focus:ring-emerald-500/20"
                          checked={inputs.surpriseMe}
                          onChange={e => setInputs({...inputs, surpriseMe: e.target.checked})}
                        />
                        <label htmlFor="surpriseMe" className="text-sm font-medium text-emerald-900 cursor-pointer select-none">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            Surprise Me!
                          </span>
                          <span className="text-[10px] text-emerald-600/70 block font-normal">Add a unique, off-the-beaten-path experience</span>
                        </label>
                      </div>

                      <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {loadingStep || 'Crafting Itinerary...'}
                          </>
                        ) : (
                          <>
                            <Plane className="w-5 h-5" />
                            Generate Itinerary
                          </>
                        )}
                      </button>
                    </form>
                  </motion.div>
                ) : activeTab === 'secrets' ? (
                  <motion.div
                    key="secrets-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <h2 className="text-2xl font-serif mb-6 flex items-center gap-2">
                      <Gem className="w-5 h-5 text-amber-500" />
                      Local Secrets
                    </h2>
                    
                    <form onSubmit={handleLocalSpotsSubmit} className="space-y-5">
                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">City / Destination</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input 
                            type="text"
                            required
                            placeholder="e.g. Lisbon, Portugal"
                            className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            value={localInputs.destination}
                            onChange={e => setLocalInputs({...localInputs, destination: e.target.value})}
                          />
                        </div>
                      </div>

                      {/* Location Specificity Selector */}
                      <div className="space-y-3">
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 block">Location Focus Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setLocalInputs({ ...localInputs, locationMode: 'general' })}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs uppercase font-bold transition-all cursor-pointer ${
                              (localInputs.locationMode || 'general') === 'general'
                                ? 'bg-stone-900 border-stone-900 text-white shadow-md'
                                : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                            }`}
                          >
                            <Compass className="w-4 h-4" />
                            General Area
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocalInputs({ ...localInputs, locationMode: 'specific' })}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs uppercase font-bold transition-all cursor-pointer ${
                              localInputs.locationMode === 'specific'
                                ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                                : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                            }`}
                          >
                            <Navigation className="w-4 h-4" />
                            Specific Point
                          </button>
                        </div>

                        <AnimatePresence>
                          {localInputs.locationMode === 'specific' && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden space-y-4 pt-2 border-t border-stone-100"
                            >
                              <div>
                                <div className="flex justify-between items-center mb-1.5">
                                  <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 block">Starting Point / Address</label>
                                  <span className="text-[10px] text-stone-500 italic block">Maps link or area name is ok</span>
                                </div>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                                    <input 
                                      type="text"
                                      required={localInputs.locationMode === 'specific'}
                                      placeholder="e.g. Lisbon Hotel, Google Maps link, or map area name"
                                      className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                                      value={localInputs.specificAddress || ''}
                                      onChange={e => setLocalInputs({...localInputs, specificAddress: e.target.value})}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleLocateMe('secrets')}
                                    disabled={locating}
                                    className="px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl flex items-center justify-center gap-1 text-xs font-semibold border border-stone-200 transition-all cursor-pointer whitespace-nowrap"
                                    title="Detect my location with GPS"
                                  >
                                    <Locate className={`w-4 h-4 ${locating ? 'animate-spin text-emerald-600' : 'text-stone-500'}`} />
                                    {locating ? 'Locating...' : 'Locate Me'}
                                  </button>
                                </div>
                                {locationError && (
                                  <p className="text-[10px] text-red-500 mt-1">{locationError}</p>
                                )}
                              </div>

                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 block">Nearby Travel Limit (Minutes)</label>
                                  <span className="text-sm font-semibold text-emerald-600 font-mono">{localInputs.maxTravelMinutes || 30} mins</span>
                                </div>
                                <div className="space-y-3">
                                  <input 
                                    type="range"
                                    min="5"
                                    max="90"
                                    step="5"
                                    className="w-full h-1.5 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    value={localInputs.maxTravelMinutes || 30}
                                    onChange={e => setLocalInputs({...localInputs, maxTravelMinutes: parseInt(e.target.value)})}
                                  />
                                  <div className="flex justify-between items-center bg-stone-50 p-2 rounded-xl border border-stone-100 text-stone-500 text-[10px]">
                                    <div className="flex gap-1 items-center">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                      <span>5-15m (Walking)</span>
                                    </div>
                                    <div className="flex gap-1 items-center">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                      <span>30-45m (Transit)</span>
                                    </div>
                                    <div className="flex gap-1 items-center">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                      <span>60-90m (Driving)</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Interactive Map element */}
                              {hasValidMapsKey && localInputs.specificCoordinates && (
                                <div className="space-y-1">
                                  <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400 block">Location Map Marker</span>
                                  <div className="h-44 w-full rounded-2xl overflow-hidden border border-stone-100 shadow-inner">
                                    <Map
                                      defaultCenter={localInputs.specificCoordinates}
                                      center={localInputs.specificCoordinates}
                                      defaultZoom={14}
                                      zoom={14}
                                      mapId="DEMO_MAP_ID"
                                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                                      style={{ width: '100%', height: '100%' }}
                                      gestureHandling="cooperative"
                                    >
                                      <AdvancedMarker position={localInputs.specificCoordinates}>
                                        <Pin background="#10b981" glyphColor="#fff font-weight: bold" />
                                      </AdvancedMarker>
                                    </Map>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Focus Area</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setLocalInputs({...localInputs, focus: 'food'})}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${localInputs.focus === 'food' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'}`}
                          >
                            <Utensils className="w-5 h-5" />
                            <span className="text-[10px] uppercase font-bold">Food</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocalInputs({...localInputs, focus: 'culture'})}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${localInputs.focus === 'culture' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'}`}
                          >
                            <Theater className="w-5 h-5" />
                            <span className="text-[10px] uppercase font-bold">Culture</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setLocalInputs({...localInputs, focus: 'nature'})}
                            className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${localInputs.focus === 'nature' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'}`}
                          >
                            <Palmtree className="w-5 h-5" />
                            <span className="text-[10px] uppercase font-bold">Nature</span>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Budget & Currency</label>
                        <div className="space-y-4">
                          <div className="flex gap-4">
                            <div className="relative flex-1">
                              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                              <select 
                                className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
                                value={localInputs.currency}
                                onChange={e => setLocalInputs({...localInputs, currency: e.target.value})}
                              >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="JPY">JPY (¥)</option>
                                <option value="AUD">AUD (A$)</option>
                                <option value="CAD">CAD (C$)</option>
                                <option value="INR">INR (₹)</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium text-stone-500">
                              <span>Amount: {localInputs.budgetAmount.toLocaleString()} {localInputs.currency}</span>
                            </div>
                            <input 
                              type="range"
                              min="50"
                              max="5000"
                              step="50"
                              className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              value={localInputs.budgetAmount}
                              onChange={e => setLocalInputs({...localInputs, budgetAmount: parseInt(e.target.value)})}
                            />
                          </div>
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {loadingStep || 'Uncovering Secrets...'}
                          </>
                        ) : (
                          <>
                            <Search className="w-5 h-5" />
                            Find Local Spots
                          </>
                        )}
                      </button>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="deals-form"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <h2 className="text-2xl font-serif mb-6 flex items-center gap-2">
                      <Tickets className="w-5 h-5 text-blue-500" />
                      Hotels & Flights
                    </h2>
                    
                    <form onSubmit={handleDealsSubmit} className="space-y-5">
                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Origin (Optional for flights)</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input 
                            type="text"
                            placeholder="Departure city"
                            className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            value={dealsInputs.origin}
                            onChange={e => setDealsInputs({...dealsInputs, origin: e.target.value})}
                          />
                        </div>
                      </div>

                      {/* Flight Type (Round-trip vs One-way) Selector */}
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 block">Flight Option</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setDealsInputs({ ...dealsInputs, flightType: 'round' })}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs uppercase font-bold transition-all cursor-pointer ${
                              (dealsInputs.flightType || 'round') === 'round'
                                ? 'bg-stone-900 border-stone-900 text-white shadow-md'
                                : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                            }`}
                          >
                            <Repeat className="w-3.5 h-3.5" />
                            Round-trip
                          </button>
                          <button
                            type="button"
                            onClick={() => setDealsInputs({ ...dealsInputs, flightType: 'oneway' })}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs uppercase font-bold transition-all cursor-pointer ${
                              dealsInputs.flightType === 'oneway'
                                ? 'bg-stone-900 border-stone-900 text-white shadow-md'
                                : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                            }`}
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            One-way
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Destinations</label>
                        <div className="space-y-3">
                          {dealsInputs.destinations.map((dest, index) => (
                            <div key={index} className="relative flex gap-2">
                              <div className="relative flex-1">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <input 
                                  type="text"
                                  required
                                  placeholder={index === 0 ? "e.g. Paris, France" : "Next stop..."}
                                  className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                  value={dest}
                                  onChange={e => updateDealsDestination(index, e.target.value)}
                                />
                              </div>
                              {dealsInputs.destinations.length > 1 && (
                                <button 
                                  type="button"
                                  onClick={() => removeDealsDestination(index)}
                                  className="p-3 text-stone-400 hover:text-red-500 transition-colors"
                                >
                                  <ChevronRight className="w-5 h-5 rotate-90" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button 
                            type="button"
                            onClick={addDealsDestination}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                          >
                            <Sparkles className="w-3 h-3" />
                            Add another destination
                          </button>
                        </div>
                      </div>

                      {/* Dates and Travelers Selection */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Start Date</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <input 
                              type="date"
                              required
                              className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                              value={dealsInputs.startDate}
                              onChange={e => handleDealsDateChange('startDate', e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">End Date</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <input 
                              type="date"
                              required
                              className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all text-sm"
                              value={dealsInputs.endDate}
                              onChange={e => handleDealsDateChange('endDate', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Days / Nights</label>
                          <div className="flex items-center gap-2 bg-stone-50 border border-stone-100 rounded-xl p-3 text-sm font-medium text-stone-600">
                            <Clock className="w-4 h-4 text-stone-400" />
                            <span>{dealsInputs.days} Days / {dealsInputs.nights} Nights</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Adults</label>
                          <div className="flex items-center gap-2 bg-stone-50 border border-stone-100 rounded-xl p-1">
                            <button 
                              type="button"
                              onClick={() => updateDealsAdults((dealsInputs.adults || 1) - 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors text-stone-600"
                            >
                              -
                            </button>
                            <span className="flex-1 text-center text-sm font-medium">{dealsInputs.adults || 1}</span>
                            <button 
                              type="button"
                              onClick={() => updateDealsAdults((dealsInputs.adults || 1) + 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors text-stone-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Children</label>
                          <div className="flex items-center gap-2 bg-stone-50 border border-stone-100 rounded-xl p-1">
                            <button 
                              type="button"
                              onClick={() => updateDealsChildren((dealsInputs.children || 0) - 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors text-stone-600"
                            >
                              -
                            </button>
                            <span className="flex-1 text-center text-sm font-medium">{dealsInputs.children || 0}</span>
                            <button 
                              type="button"
                              onClick={() => updateDealsChildren((dealsInputs.children || 0) + 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-200 transition-colors text-stone-600"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Total</label>
                          <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <input 
                              type="number"
                              disabled
                              className="w-full pl-10 pr-4 py-3 bg-stone-100 border border-stone-100 rounded-xl text-stone-500 cursor-not-allowed"
                              value={dealsInputs.people || 1}
                            />
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {(dealsInputs.children || 0) > 0 && dealsInputs.childrenAges && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3 overflow-hidden"
                          >
                            <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 block">Children's Ages</label>
                            <div className="grid grid-cols-3 gap-2">
                              {dealsInputs.childrenAges.map((age, idx) => (
                                <div key={idx} className="space-y-1">
                                  <span className="text-[10px] text-stone-400 block">Child {idx + 1}</span>
                                  <input 
                                    type="number"
                                    min="0"
                                    max="17"
                                    className="w-full px-2 py-2 bg-stone-50 border border-stone-100 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                                    value={age}
                                    onChange={e => updateDealsChildAge(idx, parseInt(e.target.value) || 0)}
                                  />
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Budget & Currency</label>
                        <div className="space-y-4">
                          <div className="flex gap-4">
                            <div className="relative flex-1">
                              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                              <select 
                                className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
                                value={dealsInputs.currency}
                                onChange={e => setDealsInputs({...dealsInputs, currency: e.target.value})}
                              >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="JPY">JPY (¥)</option>
                                <option value="AUD">AUD (A$)</option>
                                <option value="CAD">CAD (C$)</option>
                                <option value="INR">INR (₹)</option>
                              </select>
                            </div>
                            <div className="relative flex-1">
                              <select 
                                className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
                                value={dealsInputs.budget}
                                onChange={e => setDealsInputs({...dealsInputs, budget: e.target.value})}
                              >
                                <option>Budget</option>
                                <option>Mid-range</option>
                                <option>Luxury</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-medium text-stone-500">
                              <span>Amount: {dealsInputs.budgetAmount.toLocaleString()} {dealsInputs.currency}</span>
                            </div>
                            <input 
                              type="range"
                              min="100"
                              max="30000"
                              step="100"
                              className="w-full h-2 bg-stone-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              value={dealsInputs.budgetAmount}
                              onChange={e => setDealsInputs({...dealsInputs, budgetAmount: parseInt(e.target.value)})}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Min Rating</label>
                          <div className="relative">
                            <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <select 
                              className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none appearance-none"
                              value={dealsInputs.minRating}
                              onChange={e => setDealsInputs({...dealsInputs, minRating: parseInt(e.target.value)})}
                            >
                              <option value={3}>3+ Stars</option>
                              <option value={4}>4+ Stars</option>
                              <option value={4.5}>4.5+ Stars</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Max Distance</label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <select 
                              className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none appearance-none"
                              value={dealsInputs.maxDistance}
                              onChange={e => setDealsInputs({...dealsInputs, maxDistance: e.target.value})}
                            >
                              <option value="2km">Within 2km</option>
                              <option value="5km">Within 5km</option>
                              <option value="10km">Within 10km</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Amenities</label>
                        <div className="flex flex-wrap gap-2">
                          {['WiFi', 'Pool', 'Gym', 'Breakfast', 'Parking'].map(amenity => (
                            <button
                              key={amenity}
                              type="button"
                              onClick={() => toggleAmenity(amenity)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                (dealsInputs.amenities || []).includes(amenity)
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-stone-50 border-stone-100 text-stone-500 hover:border-stone-200'
                              }`}
                            >
                              {amenity}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {loadingStep || 'Searching Deals...'}
                          </>
                        ) : (
                          <>
                            <Search className="w-5 h-5" />
                            Find Best Deals
                          </>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Result Display Column */}
          <div className="lg:col-span-8 print-full-width">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div 
                  key="loading-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 space-y-6"
                >
                  <div className="relative">
                    <Loader2 className="w-16 h-16 text-emerald-600 animate-spin" />
                    <Sparkles className="w-6 h-6 text-amber-400 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif mb-2">{loadingStep || 'Consulting our travel experts...'}</h3>
                    <p className="text-stone-500">
                      {activeTab === 'itinerary' 
                        ? `We're finding the best spots in ${inputs.destination || 'your destination'}.`
                        : activeTab === 'secrets'
                        ? `Uncovering hidden ${localInputs.focus} gems in ${localInputs.destination || 'your destination'}.`
                        : `Finding the best deals for ${dealsInputs.destinations.join(" → ") || 'your trip'}.`}
                    </p>
                  </div>
                  {/* Progress bar simulation */}
                  <div className="w-64 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 15, ease: "linear" }}
                    />
                  </div>
                </motion.div>
              ) : error ? (
                <motion.div 
                  key="error-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center gap-3"
                >
                  <Info className="w-5 h-5" />
                  {error}
                </motion.div>
              ) : ((activeTab === 'itinerary' && !itineraryResult) || (activeTab === 'secrets' && !localSpotsResult) || (activeTab === 'deals' && !dealsResult)) ? (
                <motion.div 
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 bg-white/50 rounded-3xl border-2 border-dashed border-stone-200"
                >
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                    {activeTab === 'itinerary' ? <Plane className="w-10 h-10 text-emerald-600" /> : activeTab === 'secrets' ? <Gem className="w-10 h-10 text-amber-500" /> : <Tickets className="w-10 h-10 text-blue-500" />}
                  </div>
                  <h3 className="text-2xl font-serif mb-2">
                    {activeTab === 'itinerary' ? 'Ready for your next adventure?' : activeTab === 'secrets' ? 'Discover the soul of the city' : 'Find your perfect stay & flight'}
                  </h3>
                  <p className="text-stone-500 max-w-md">
                    {activeTab === 'itinerary' 
                      ? 'Fill out the form to generate a personalized itinerary tailored to your travel style.' 
                      : activeTab === 'secrets'
                      ? 'Find the places locals love. Authentic, non-touristy spots for a deeper experience.'
                      : 'We scan the web for the best flight and hotel deals matching your budget and destination.'}
                  </p>
                </motion.div>
              ) : activeTab === 'itinerary' && itineraryResult ? (
                <motion.div 
                  key="itinerary-result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8 pb-12"
                >
                  {/* Destination Image */}
                  {destinationImage && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="w-full aspect-[16/9] rounded-3xl overflow-hidden shadow-2xl border border-stone-100"
                    >
                      <img 
                        src={destinationImage} 
                        alt={inputs.destination} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  )}

                  {/* Trip Overview */}
                  <div className="bg-stone-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Plane className="w-32 h-32 rotate-45" />
                    </div>
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-8">
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 block mb-2">Destination</span>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-emerald-500" />
                          <div className="text-xl font-serif">{inputs.destination}</div>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 block mb-2">Dates & Duration</span>
                        <div className="text-xl font-serif">
                          {new Date(inputs.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(inputs.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          <span className="text-sm text-stone-400 block mt-1 font-sans font-normal uppercase tracking-widest">{inputs.days} Days / {inputs.nights} Nights</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 block mb-2">Daily Schedule Hours</span>
                        <div className="text-xl font-serif">
                          {inputs.dailyStartTime || '09:00'} - {inputs.dailyEndTime || '21:00'}
                          <span className="text-sm text-stone-400 block mt-1 font-sans font-normal uppercase tracking-widest">Active Time Limits</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 block mb-2">Budget & Group</span>
                        <div className="text-xl font-serif">
                          {inputs.budgetAmount.toLocaleString()} {inputs.currency}
                          <span className="text-sm text-stone-400 block mt-1 font-sans font-normal uppercase tracking-widest">{inputs.adults} Adults {inputs.children > 0 ? `, ${inputs.children} Children` : ''}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Logistics Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm shadow-stone-200/50 border border-stone-100">
                      <div className="flex items-center gap-3 mb-3 text-emerald-600">
                        <Bus className="w-5 h-5" />
                        <span className="text-xs uppercase tracking-widest font-bold">Transport</span>
                      </div>
                      <p className="text-sm text-stone-600 leading-relaxed">{itineraryResult.logistics.transportMethods}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm shadow-stone-200/50 border border-stone-100">
                      <div className="flex items-center gap-3 mb-3 text-emerald-600">
                        <Home className="w-5 h-5" />
                        <span className="text-xs uppercase tracking-widest font-bold">Stay</span>
                      </div>
                      <p className="text-sm text-stone-600 leading-relaxed">{itineraryResult.logistics.accommodationAreas}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm shadow-stone-200/50 border border-stone-100 col-span-2">
                      <div className="flex items-center gap-3 mb-3 text-emerald-600">
                        <Cloud className="w-5 h-5" />
                        <span className="text-xs uppercase tracking-widest font-bold">Weather Summary</span>
                      </div>
                      <p className="text-sm text-stone-600 leading-relaxed mb-4">{itineraryResult.logistics.weatherSummary}</p>
                      
                      <div className="grid grid-cols-5 gap-2">
                        {itineraryResult.forecast.map((day, idx) => (
                          <div key={idx} className="bg-stone-50 rounded-xl p-2 text-center border border-stone-100">
                            <div className="text-[10px] font-bold text-stone-500 uppercase">{day.day}</div>
                            <div className="text-sm font-bold text-stone-900">{day.temperature}</div>
                            <div className="text-[9px] text-stone-400">{day.precipitationProbability} Rain</div>
                            <div className="text-[9px] text-stone-400">{day.windConditions} Wind</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm shadow-stone-200/50 border border-stone-100">
                      <div className="flex items-center gap-3 mb-3 text-emerald-600">
                        <Info className="w-5 h-5" />
                        <span className="text-xs uppercase tracking-widest font-bold">Tips</span>
                      </div>
                      <p className="text-sm text-stone-600 leading-relaxed">{itineraryResult.logistics.generalTips}</p>
                    </div>
                  </div>

                  {/* Itinerary Table */}
                  <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-stone-50 border-b border-stone-100">
                            <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-stone-400">Day</th>
                            <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-stone-400">Time</th>
                            <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-stone-400">Activity</th>
                            <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-stone-400">Location</th>
                            <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-stone-400">Hidden Gem Tip</th>
                            <th className="px-6 py-4 text-xs uppercase tracking-widest font-bold text-stone-400">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {itineraryResult.itinerary.map((item, idx) => (
                            <tr key={idx} className="hover:bg-stone-50/50 transition-colors group">
                              <td className="px-6 py-4 align-top">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-stone-900 text-white text-xs font-bold">
                                  {item.day}
                                </span>
                              </td>
                              <td className="px-6 py-4 align-top text-sm font-mono text-stone-500">{item.time}</td>
                              <td className="px-6 py-4 align-top">
                                <div className="font-medium text-stone-900">{item.activity}</div>
                                <div className="mt-2 space-y-2">
                                  {item.weatherNote && (
                                    <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded-lg border border-blue-100">
                                      <Cloud className="w-3 h-3 mt-0.5 shrink-0" />
                                      <span>{item.weatherNote}</span>
                                    </div>
                                  )}
                                  {item.travelTimeEstimate && (
                                    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-100">
                                      <Clock className="w-3 h-3 mt-0.5 shrink-0" />
                                      <span><span className="font-bold">Proximity:</span> {item.travelTimeEstimate} from starting point</span>
                                    </div>
                                  )}
                                  {item.indoorAlternative && (
                                    <div className="flex items-start gap-2 text-xs text-stone-500 bg-stone-50 p-2 rounded-lg border border-stone-200 border-dashed">
                                      <Home className="w-3 h-3 mt-0.5 shrink-0" />
                                      <span><span className="font-bold">Indoor Alt:</span> {item.indoorAlternative}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 align-top">
                                <div className="flex items-center gap-1 text-sm text-stone-600">
                                  <MapPin className="w-3 h-3" />
                                  {item.location}
                                </div>
                              </td>
                              <td className="px-6 py-4 align-top">
                                <div className={`flex items-start gap-2 text-xs p-2 rounded-lg border ${
                                  (inputs.experienceType || 'popular') === 'popular'
                                    ? 'text-amber-800 bg-amber-50/70 border-amber-100/80'
                                    : 'text-emerald-800 bg-emerald-50/70 border-emerald-100/80'
                                }`}>
                                  {(inputs.experienceType || 'popular') === 'popular' ? (
                                    <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                                  ) : (
                                    <Gem className="w-3 h-3 mt-0.5 shrink-0" />
                                  )}
                                  <span>
                                    <strong className="font-semibold block mb-0.5 font-sans uppercase tracking-wider text-[10px]">
                                      {(inputs.experienceType || 'popular') === 'popular' ? 'Insider & Historical Context' : 'Hidden Gem Aspect'}
                                    </strong>
                                    {item.hiddenGemNote}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 align-top text-sm font-medium text-stone-900 whitespace-nowrap">{item.estimatedCost}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Share & Integration Center */}
                  <div className="bg-white rounded-3xl p-8 shadow-xl shadow-stone-200/50 border border-stone-100 space-y-6 no-print">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-6">
                      <div>
                        <h4 className="text-lg font-serif font-medium text-stone-900">Share & Export Trip</h4>
                        <p className="text-sm text-stone-500">Keep your itinerary handy by sharing or syncing it with Google Workspace APIs.</p>
                      </div>
                      
                      {/* Sharing Link with Email button */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleCopyToClipboard}
                          className="flex items-center gap-2 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold px-4 py-2.5 rounded-xl border border-stone-200 transition-all active:scale-95 cursor-pointer"
                        >
                          {copied ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-500 animate-pulse" />
                              <span>Copied Link!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 text-stone-500" />
                              <span>Copy Share Link</span>
                            </>
                          )}
                        </button>
                        
                        <a
                          href={shareEmailText}
                          className="flex items-center gap-2 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold px-4 py-2.5 rounded-xl border border-stone-200 transition-all active:scale-95 cursor-pointer"
                        >
                          <Mail className="w-4 h-4 text-stone-500" />
                          <span>Share via Email</span>
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Google Calendar export card */}
                      <div className="bg-stone-50/50 hover:bg-stone-50 rounded-2xl p-5 border border-stone-100 transition-all flex flex-col justify-between">
                        <div>
                          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                            <CalendarDays className="w-5 h-5" />
                          </div>
                          <h5 className="font-semibold text-stone-900 text-sm mb-1">Add to Google Calendar</h5>
                          <p className="text-xs text-stone-500 leading-relaxed mb-4">Add every item on your itinerary directly into your Google Calendar as structured events.</p>
                        </div>
                        <div>
                          {user ? (
                            <button
                              onClick={handleAddToCalendar}
                              disabled={calendarStatus === 'loading'}
                              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                              {calendarStatus === 'loading' ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Syncing...</span>
                                </>
                              ) : calendarStatus === 'success' ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Added to Calendar!</span>
                                </>
                              ) : calendarStatus === 'error' ? (
                                <span>Failed. Try again</span>
                              ) : (
                                <span>Add events</span>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={handleSignIn}
                              className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                            >
                              Sign in to Sync
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Google Sheets export card */}
                      <div className="bg-stone-50/50 hover:bg-stone-50 rounded-2xl p-5 border border-stone-100 transition-all flex flex-col justify-between">
                        <div>
                          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <h5 className="font-semibold text-stone-900 text-sm mb-1">Export to Google Sheets</h5>
                          <p className="text-xs text-stone-500 leading-relaxed mb-4">Create a clean, well-formatted spreadsheet containing dates, times, costs, and details.</p>
                        </div>
                        <div>
                          {user ? (
                            <>
                              {sheetsStatus === 'success' && sheetsUrl ? (
                                <a
                                  href={sheetsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Open Spreadsheet</span>
                                </a>
                              ) : (
                                <button
                                  onClick={handleAddToSheets}
                                  disabled={sheetsStatus === 'loading'}
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-2.5 px-4 rounded-xl shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  {sheetsStatus === 'loading' ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Creating...</span>
                                    </>
                                  ) : sheetsStatus === 'error' ? (
                                    <span>Failed. Try again</span>
                                  ) : (
                                    <span>Export to Sheet</span>
                                  )}
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={handleSignIn}
                              className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                            >
                              Sign in to Export
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Export to PDF / Print card */}
                      <div className="bg-stone-50/50 hover:bg-stone-50 rounded-2xl p-5 border border-stone-100 transition-all flex flex-col justify-between">
                        <div>
                          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
                            <FileDown className="w-5 h-5" />
                          </div>
                          <h5 className="font-semibold text-stone-900 text-sm mb-1">Export as PDF</h5>
                          <p className="text-xs text-stone-500 leading-relaxed mb-4">Download a beautifully formatted, printer-ready PDF version of your itinerary.</p>
                        </div>
                        <div>
                          <button
                            onClick={handleExportPDF}
                            className="w-full bg-stone-900 hover:bg-stone-850 text-white font-medium text-xs py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>Download PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : activeTab === 'secrets' && localSpotsResult ? (
                <motion.div 
                  key="secrets-result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 gap-6 pb-12"
                >
                  {localSpotsResult.map((spot, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 p-8 border border-stone-100 group hover:border-emerald-200 transition-all"
                    >
                      <div className="flex flex-col md:flex-row gap-6">
                        {spot.imageUrl && (
                          <div className="w-full md:w-48 h-48 rounded-2xl overflow-hidden shrink-0 shadow-md border border-stone-100">
                            <img 
                              src={spot.imageUrl} 
                              alt={spot.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-widest ${
                              spot.category === 'food' ? 'bg-emerald-50 text-emerald-700' :
                              spot.category === 'culture' ? 'bg-amber-50 text-amber-700' :
                              'bg-blue-50 text-blue-700'
                            }`}>
                              {spot.category}
                            </span>
                            <div className="flex items-center gap-1 text-xs text-stone-400">
                              <MapPin className="w-3 h-3" />
                              {spot.location}
                            </div>
                            {spot.travelTimeEstimate && (
                              <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 font-medium">
                                <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
                                <span>{spot.travelTimeEstimate} away</span>
                              </div>
                            )}
                          </div>
                          <h3 className="text-2xl font-serif mb-4 group-hover:text-emerald-700 transition-colors">{spot.name}</h3>
                          <p className="text-stone-600 leading-relaxed mb-6 italic">"{spot.whySpecial}"</p>
                          
                          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                              <Sparkles className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                              <span className="text-xs uppercase tracking-widest font-bold text-stone-400 block mb-1">Insider Tip</span>
                              <p className="text-sm text-stone-700">{spot.tip}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : activeTab === 'deals' && dealsResult ? (
                <motion.div 
                  key="deals-result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-12 pb-12"
                >
                  {/* Trip Summary Card */}
                  <div className="bg-stone-900 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Tickets className="w-32 h-32 rotate-12 animate-pulse" />
                    </div>
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 block mb-2">Destination{dealsInputs.destinations.length > 1 ? 's' : ''}</span>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-emerald-500" />
                          <div className="text-xl font-serif">{dealsInputs.destinations.join(" → ")}</div>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 block mb-2">Dates & Duration</span>
                        <div className="text-xl font-serif">
                          {dealsInputs.startDate ? new Date(dealsInputs.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} - {dealsInputs.endDate ? new Date(dealsInputs.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          <span className="text-sm text-stone-400 block mt-1 font-sans font-normal uppercase tracking-widest">{dealsInputs.days} Days / {dealsInputs.nights} Nights</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 block mb-2">Budget & Group</span>
                        <div className="text-xl font-serif">
                          {dealsInputs.budgetAmount.toLocaleString()} {dealsInputs.currency}
                          <span className="text-sm text-stone-400 block mt-1 font-sans font-normal uppercase tracking-widest">
                            {dealsInputs.adults || 1} Adult{(dealsInputs.adults || 1) > 1 ? 's' : ''}
                            {(dealsInputs.children || 0) > 0 ? `, ${dealsInputs.children} Child${(dealsInputs.children || 0) > 1 ? 'ren' : ''}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Flights Section */}
                  <section>
                    <h3 className="text-2xl font-serif mb-6 flex items-center gap-3">
                      <Plane className="w-6 h-6 text-emerald-600" />
                      Recommended Flights
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {dealsResult.flights.map((flight, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => window.open(flight.bookingUrl, '_blank')}
                          className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-lg hover:border-emerald-400 hover:scale-[1.01] transition-all cursor-pointer group relative"
                          title="Click to instantly go to booking page"
                        >
                          <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="w-12 h-12 bg-stone-50 rounded-full flex items-center justify-center shrink-0 group-hover:bg-emerald-50 transition-colors">
                              <Tickets className="w-6 h-6 text-stone-400 group-hover:text-emerald-600 transition-colors" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="font-bold text-stone-900 group-hover:text-emerald-700 transition-colors">{flight.airline}</div>
                                <span className="px-2 py-0.5 rounded bg-stone-100 text-[9px] uppercase font-bold text-stone-500 border border-stone-200">
                                  {dealsInputs.flightType === 'oneway' ? 'One-way' : 'Round-trip'}
                                </span>
                              </div>
                              <div className="text-xs text-stone-500 uppercase tracking-widest font-semibold">{flight.duration}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-8 flex-1 justify-center">
                            <div className="text-center">
                              <div className="text-lg font-mono font-bold">{flight.departureTime}</div>
                              <div className="text-[10px] text-stone-400 uppercase font-bold">Departure</div>
                            </div>
                            <div className="flex-1 max-w-[100px] relative flex items-center justify-center">
                              <div className="w-full h-[1px] bg-stone-200 border-t border-dashed border-stone-300"></div>
                              <ArrowRight className="w-4 h-4 text-stone-300 absolute group-hover:translate-x-1 transition-transform" />
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-mono font-bold">{flight.arrivalTime}</div>
                              <div className="text-[10px] text-stone-400 uppercase font-bold">Arrival</div>
                            </div>
                          </div>

                          <div className="text-right w-full md:w-auto flex md:flex-col items-center md:items-end justify-between md:justify-center gap-4">
                            <div className="text-2xl font-serif text-emerald-700">{flight.price}</div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(flight.bookingUrl, '_blank');
                              }}
                              className="px-6 py-2 bg-stone-900 text-white text-sm rounded-xl group-hover:bg-emerald-600 transition-colors flex items-center gap-2 cursor-pointer border-none outline-none font-medium"
                            >
                              Book <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Hotels Section */}
                  <section>
                    <h3 className="text-2xl font-serif mb-6 flex items-center gap-3">
                      <HotelIcon className="w-6 h-6 text-emerald-600" />
                      Top Rated Stays
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {dealsResult.hotels.map((hotel, idx) => (
                        <div key={idx} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100 group hover:shadow-xl transition-all flex flex-col">
                          <div className="h-48 relative overflow-hidden">
                            <img 
                              src={hotel.imageUrl || `https://picsum.photos/seed/${hotel.name}/800/600`} 
                              alt={hotel.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                              <span className="text-xs font-bold">{hotel.rating}</span>
                            </div>
                          </div>
                          <div className="p-6 flex-1 flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-xl font-serif">{hotel.name}</h4>
                              <div className="text-emerald-700 font-serif text-lg">{hotel.pricePerNight}<span className="text-xs text-stone-400 font-sans">/night</span></div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-stone-400 mb-4">
                              <MapPin className="w-3 h-3" />
                              {hotel.distanceFromCenter} from center
                            </div>
                            <div className="flex flex-wrap gap-2 mb-4">
                              {hotel.amenities.map((amenity, i) => (
                                <span key={i} className="px-2 py-1 bg-stone-50 text-[10px] text-stone-500 rounded-md border border-stone-100">{amenity}</span>
                              ))}
                            </div>

                            {/* Nearby Points of Interest */}
                            <div className="mb-6 space-y-3">
                              <h5 className="text-[10px] uppercase tracking-widest font-bold text-stone-400">Nearby Points of Interest</h5>
                              <div className="space-y-2">
                                {hotel.nearbyPointsOfInterest.map((poi, pIdx) => (
                                  <div key={pIdx} className="p-3 bg-stone-50 rounded-xl border border-stone-100 flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                                      {poi.type.toLowerCase().includes('food') || poi.type.toLowerCase().includes('restaurant') ? <Utensils className="w-3 h-3 text-emerald-600" /> :
                                       poi.type.toLowerCase().includes('transport') ? <Bus className="w-3 h-3 text-blue-600" /> :
                                       <Sparkles className="w-3 h-3 text-amber-500" />}
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-stone-900">{poi.name}</div>
                                      <div className="text-[9px] text-stone-400 uppercase font-bold">{poi.type}</div>
                                      <p className="text-[10px] text-stone-600 leading-tight mt-0.5">{poi.description}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="mt-auto">
                              <a 
                                href={hotel.bookingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 bg-stone-50 text-stone-900 border border-stone-200 rounded-xl text-sm font-medium hover:bg-stone-900 hover:text-white transition-all flex items-center justify-center gap-2"
                              >
                                View Details <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </motion.div>
              ) : activeTab === 'budget' ? (
                <motion.div 
                  key="budget-tracker"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 p-8 border border-stone-100"
                >
                  <BudgetTracker 
                    totalBudget={inputs.budgetAmount} 
                    expenses={expenses} 
                    setExpenses={setExpenses} 
                    currency={inputs.currency}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-stone-900 text-stone-400 py-12 border-t border-stone-800">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-white mb-4">
            <Plane className="w-5 h-5" />
            <span className="font-serif text-xl">VoyageAI</span>
          </div>
          <p className="text-sm max-w-md mx-auto mb-8">
            Empowering travelers with AI-driven insights. Every journey is unique, and we're here to make yours unforgettable.
          </p>
          <div className="flex justify-center gap-8 text-xs uppercase tracking-widest font-semibold">
            <a href="#" className="hover:text-white transition-colors">About</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
