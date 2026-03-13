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
  ExternalLink
} from 'lucide-react';
import { generateItinerary, getLocalSpots, generateDestinationImage, searchTravelDeals } from './services/geminiService';
import { ItineraryResponse, TravelInputs, LocalSpot, LocalSpotsInputs, TravelSearchResponse, TravelSearchInputs } from './types';

type Tab = 'itinerary' | 'secrets' | 'deals';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('itinerary');
  
  // Itinerary State
  const [inputs, setInputs] = useState<TravelInputs>({
    origin: '',
    destinations: [''],
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
    surpriseMe: false
  });
  const [itineraryResult, setItineraryResult] = useState<ItineraryResponse | null>(null);
  const [destinationImage, setDestinationImage] = useState<string | null>(null);

  // Local Spots State
  const [localInputs, setLocalInputs] = useState<LocalSpotsInputs>({
    destination: '',
    focus: 'food',
    budgetAmount: 500,
    currency: 'USD'
  });
  const [localSpotsResult, setLocalSpotsResult] = useState<LocalSpot[] | null>(null);

  // Deals State
  const [dealsInputs, setDealsInputs] = useState<TravelSearchInputs>({
    origin: '',
    destination: '',
    budget: 'Mid-range',
    budgetAmount: 3000,
    currency: 'USD',
    minRating: 4,
    maxDistance: '5km',
    amenities: []
  });
  const [dealsResult, setDealsResult] = useState<TravelSearchResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Progress bar logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          // Fast start, then slows down
          const increment = Math.max(0.5, (90 - prev) * 0.1);
          return Math.min(90, prev + increment);
        });
      }, 100);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleItinerarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputs.destinations.some(d => !d.trim())) {
      setError('Please fill in all destinations.');
      return;
    }
    setLoading(true);
    setLoadingStep('Analyzing destinations...');
    setError(null);
    setDestinationImage(null);
    try {
      // Start both in parallel, but we can update step if we want more granularity
      // For true optimization, we could split generateItinerary into sub-tasks if the API allowed
      setLoadingStep('Fetching real-time weather & crafting activities...');
      const [itineraryData, imageData] = await Promise.all([
        generateItinerary(inputs),
        generateDestinationImage(inputs.destinations[0])
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

  const addDestination = () => {
    setInputs({ ...inputs, destinations: [...inputs.destinations, ''] });
  };

  const removeDestination = (index: number) => {
    const newDestinations = inputs.destinations.filter((_, i) => i !== index);
    setInputs({ ...inputs, destinations: newDestinations });
  };

  const updateDestination = (index: number, value: string) => {
    const newDestinations = [...inputs.destinations];
    newDestinations[index] = value;
    setInputs({ ...inputs, destinations: newDestinations });
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
      <header className="relative h-[40vh] flex items-center justify-center overflow-hidden bg-stone-900">
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

      <main className="max-w-6xl mx-auto px-4 py-12 -mt-20 relative z-20">
        {/* Tab Switcher */}
        <div className="flex justify-center mb-8">
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
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Input Form Column */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4"
          >
            <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 p-8 border border-stone-100 sticky top-8">
              <AnimatePresence mode="wait">
                {activeTab === 'itinerary' ? (
                  <motion.div
                    key="itinerary-form"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h2 className="text-2xl font-serif mb-6 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-600" />
                      Plan Your Trip
                    </h2>
                    
                    <form onSubmit={handleItinerarySubmit} className="space-y-5">
                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Origin</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input 
                            type="text"
                            required
                            placeholder="Your city of origin"
                            className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            value={inputs.origin}
                            onChange={e => setInputs({...inputs, origin: e.target.value})}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Destinations</label>
                        <div className="space-y-3">
                          {inputs.destinations.map((dest, index) => (
                            <div key={index} className="relative flex gap-2">
                              <div className="relative flex-1">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <input 
                                  type="text"
                                  required
                                  placeholder={index === 0 ? "e.g. Kyoto, Japan" : "Next stop..."}
                                  className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                  value={dest}
                                  onChange={e => updateDestination(index, e.target.value)}
                                />
                              </div>
                              {inputs.destinations.length > 1 && (
                                <button 
                                  type="button"
                                  onClick={() => removeDestination(index)}
                                  className="p-3 text-stone-400 hover:text-red-500 transition-colors"
                                >
                                  <ChevronRight className="w-5 h-5 rotate-90" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button 
                            type="button"
                            onClick={addDestination}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                          >
                            <Sparkles className="w-3 h-3" />
                            Add another destination
                          </button>
                        </div>
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
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
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
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2 }}
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

                      <div>
                        <label className="text-xs uppercase tracking-widest font-semibold text-stone-400 mb-2 block">Destination</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input 
                            type="text"
                            required
                            placeholder="e.g. Paris, France"
                            className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            value={dealsInputs.destination}
                            onChange={e => setDealsInputs({...dealsInputs, destination: e.target.value})}
                          />
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
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {/* Initial State */}
              {((activeTab === 'itinerary' && !itineraryResult) || (activeTab === 'secrets' && !localSpotsResult) || (activeTab === 'deals' && !dealsResult)) && !loading && !error && (
                <motion.div 
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
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
              )}

              {/* Loading State */}
              {loading && (
                <motion.div 
                  key="loading-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
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
                        ? `We're finding the best spots in ${inputs.destinations[0] || 'your destination'}.`
                        : activeTab === 'secrets'
                        ? `Uncovering hidden ${localInputs.focus} gems in ${localInputs.city || 'your city'}.`
                        : `Finding the best deals for ${dealsInputs.destination || 'your trip'}.`}
                    </p>
                  </div>
                  {/* Progress bar simulation */}
                  <div className="w-64 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500"
                      initial={{ width: "0%" }}
                      animate={{ width: `${progress}%` }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 50, 
                        damping: 15,
                        mass: 0.5
                      }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Error State */}
              {error && (
                <motion.div 
                  key="error-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-6 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-center gap-3"
                >
                  <Info className="w-5 h-5" />
                  {error}
                </motion.div>
              )}

              {/* Itinerary Result */}
              {activeTab === 'itinerary' && itineraryResult && !loading && (
                <motion.div 
                  key="itinerary-result"
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
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
                        alt={inputs.destinations[0]} 
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
                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-stone-400 block mb-2">Route</span>
                        <div className="flex items-center gap-3">
                          <div className="text-xl font-serif">{inputs.origin}</div>
                          <ArrowRight className="w-4 h-4 text-emerald-500" />
                          <div className="text-xl font-serif">{inputs.destinations.join(" → ")}</div>
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
                    <div className="bg-white p-6 rounded-2xl shadow-sm shadow-stone-200/50 border border-stone-100">
                      <div className="flex items-center gap-3 mb-3 text-emerald-600">
                        <Cloud className="w-5 h-5" />
                        <span className="text-xs uppercase tracking-widest font-bold">Weather</span>
                      </div>
                      <p className="text-sm text-stone-600 leading-relaxed">{itineraryResult.logistics.weatherSummary}</p>
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
                                  <div className="flex items-start gap-2 text-xs text-emerald-600 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                    <Gem className="w-3 h-3 mt-0.5 shrink-0" />
                                    <span>{item.hiddenGemNote}</span>
                                  </div>
                                  {item.weatherNote && (
                                    <div className="flex items-start gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded-lg border border-blue-100">
                                      <Cloud className="w-3 h-3 mt-0.5 shrink-0" />
                                      <span>{item.weatherNote}</span>
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
                              <td className="px-6 py-4 align-top text-sm font-medium text-stone-900 whitespace-nowrap">{item.estimatedCost}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Local Spots Result */}
              {activeTab === 'secrets' && localSpotsResult && !loading && (
                <motion.div 
                  key="secrets-result"
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
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
                          <div className="flex items-center gap-3 mb-2">
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
              )}

              {/* Deals Result */}
              {activeTab === 'deals' && dealsResult && !loading && (
                <motion.div 
                  key="deals-result"
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 20 }}
                  className="space-y-12 pb-12"
                >
                  {/* Flights Section */}
                  <section>
                    <h3 className="text-2xl font-serif mb-6 flex items-center gap-3">
                      <Plane className="w-6 h-6 text-emerald-600" />
                      Recommended Flights
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {dealsResult.flights.map((flight, idx) => (
                        <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-stone-100 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="w-12 h-12 bg-stone-50 rounded-full flex items-center justify-center shrink-0">
                              <Tickets className="w-6 h-6 text-stone-400" />
                            </div>
                            <div>
                              <div className="font-bold text-stone-900">{flight.airline}</div>
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
                              <ArrowRight className="w-4 h-4 text-stone-300 absolute" />
                            </div>
                            <div className="text-center">
                              <div className="text-lg font-mono font-bold">{flight.arrivalTime}</div>
                              <div className="text-[10px] text-stone-400 uppercase font-bold">Arrival</div>
                            </div>
                          </div>

                          <div className="text-right w-full md:w-auto flex md:flex-col items-center md:items-end justify-between md:justify-center gap-4">
                            <div className="text-2xl font-serif text-emerald-700">{flight.price}</div>
                            <a 
                              href={flight.bookingUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="px-6 py-2 bg-stone-900 text-white text-sm rounded-xl hover:bg-stone-800 transition-colors flex items-center gap-2"
                            >
                              Book <ExternalLink className="w-3 h-3" />
                            </a>
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
              )}
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
