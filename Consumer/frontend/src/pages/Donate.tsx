import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useToast } from '../components/ToastContext';
import ChatOverlay from '../components/ChatOverlay';
import { LocationSelector } from '../components/LocationSelector';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Calendar,
  Plus,
  Package,
  Navigation,
  Leaf,
  MessageCircle,
  Trash2
} from 'lucide-react';

import type { CreateDonationPayload } from '../types';

// Fix for default markers in react-leaflet
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
    const data = await response.json();
    if (data && data.display_name) {
      const address = data.address || {};
      const locationParts = [];

      if (address.road) locationParts.push(address.road);
      if (address.suburb || address.neighbourhood) locationParts.push(address.suburb || address.neighbourhood);
      if (address.city || address.town || address.village) locationParts.push(address.city || address.town || address.village);

      return locationParts.length > 0 ? locationParts.join(', ') : data.display_name.split(',')[0];
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// Component to display location name and handle clicks
function LocationNameComponent({
  donationId,
  lat,
  lng,
  onLocationClick,
  getLocationName
}: {
  donationId: string;
  lat: number;
  lng: number;
  onLocationClick: (lat: number, lng: number) => void;
  getLocationName: (donationId: string, lat: number, lng: number) => Promise<string>;
}) {
  const [locationName, setLocationName] = useState<string>('Loading...');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getLocationName(donationId, lat, lng).then(name => {
      setLocationName(name);
      setLoaded(true);
    });
  }, [donationId, lat, lng, getLocationName]);

  return (
    <button
      onClick={() => onLocationClick(lat, lng)}
      className="location-link-btn"
      style={{
        background: 'none',
        border: 'none',
        color: '#1f7a4d',
        textDecoration: 'none',
        cursor: 'pointer',
        fontSize: '0.75rem',
        padding: 0,
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        textAlign: 'left'
      }}
      title="Click to view location on map"
    >
      <MapPin size={12} />
      {loaded ? locationName : 'Loading...'}
    </button>
  );
}

export function Donate() {
  const { token, user } = useAuth();
  const [donations, setDonations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [activeConversation, setActiveConversation] = useState<any | null>(null);
  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  const [requestConversations, setRequestConversations] = useState<Record<string, any>>({});
  const { showToast } = useToast();
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);

  // Filter and sort states
  const [filters, setFilters] = useState({
    location: '',
    dateFrom: '',
    dateTo: '',
    timeFrom: '',
    timeTo: '',
    maxDistance: '',
    donationType: 'all' // 'all', 'human', 'animal'
  });
  const [sortBy, setSortBy] = useState<'distance' | 'date' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [donationLocationNames, setDonationLocationNames] = useState<Record<string, string>>({});
  const [showInbox, setShowInbox] = useState(false);

  const [form, setForm] = useState<CreateDonationPayload & { title: string; description: string }>({
    title: '',
    description: '',
    quantity: 1,
    unit: 'pcs',
    pickup_instructions: '',
    location_lat: 0,
    location_lng: 0,
    available_from: new Date().toISOString().slice(0, 10),
    expires_at: '',
    donation_type: 'human',
  });

  useEffect(() => {
    // Try to grab user geolocation
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setLocation({ lat, lng });
          // Get location name for initial location
          const name = await reverseGeocode(lat, lng);
          setLocationName(name);
        },
        () => setLocation(null),
      );
    }
  }, []);

  const loadDonations = async () => {
    setLoading(true);
    try {
      const [humanResp, animalResp] = await Promise.all([
        api.listDonations(token ?? undefined, 'human'),
        api.listDonations(token ?? undefined, 'animal')
      ]);

      const allDonations = [
        ...(humanResp.donations || []),
        ...(animalResp.donations || [])
      ];

      setDonations(allDonations);

      if (token) {
        try {
          const rresp = await api.getMyDonationRequests(token);
          const ids: string[] = [];
          const convMap: Record<string, any> = {};
          (rresp.requests || []).forEach((r: any) => {
            if (r.donation_id) {
              ids.push(r.donation_id);
              if (r.conversations) {
                convMap[r.donation_id] = r.conversations;
              }
            }
          });
          setRequestedIds(ids);
          setRequestConversations(convMap);
        } catch (err) {
          // ignore errors here
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDonations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const intervalMs = 90000; // 90 seconds
    const id = setInterval(() => loadDonations(), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [managingDonationId, setManagingDonationId] = useState<string | null>(null);
  const [donationRequestsList, setDonationRequestsList] = useState<any[]>([]);
  const [showManageDonations, setShowManageDonations] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setError(null);
    try {
      const payload = {
        ...form,
        location_lat: location?.lat || form.location_lat,
        location_lng: location?.lng || form.location_lng,
      };
      await api.createDonation(token as string, payload);
      setForm({ ...form, title: '', description: '', donation_type: 'human' });
      setSuccess('Donation posted successfully');
      showToast('success', 'Donation posted');
      loadDonations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create donation');
    } finally {
      setTimeout(() => setSuccess(null), 4000);
      setCreating(false);
    }
  };

  const requestDonation = async (donationId: string) => {
    if (!token) {
      setError('Please login to request donations');
      return;
    }
    setRequestingId(donationId);
    try {
      const resp = await api.createDonationRequest(token as string, donationId, 'I would like to pick this up, please');
      if (resp?.request) {
        setError(null);
        setRequestedIds((p) => [...new Set([...p, donationId])]);
        if (resp.conversation) {
          setRequestConversations((prev) => ({ ...prev, [donationId]: resp.conversation }));
        }
  showToast('success', 'Request sent');
        if (resp.conversation) {
          setActiveConversation(resp.conversation);
        }
        if (resp.conversation) {
          setActiveConversation(resp.conversation);
        }
        loadDonations();
      } else {
        setError(resp?.message || 'Request failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to request donation');
    } finally {
      setRequestingId(null);
    }
  };

  const openManageRequests = async (donationId: string) => {
    if (!token) return;
    try {
      const resp = await api.getDonationRequests(token, donationId);
      setDonationRequestsList(resp.requests || []);
      setManagingDonationId(donationId);
    } catch (err) {
      showToast('error', 'Failed to load requests');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!token) return;
    try {
      await api.acceptDonationRequest(token, requestId);
      showToast('success', 'Request accepted');
      // refresh
      setDonationRequestsList((p) => p.filter((r) => r.id !== requestId));
      loadDonations();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to accept request');
    }
  };

  const handleDeleteDonation = async (donationId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to delete this donation?')) return;
    
    try {
      await api.deleteDonation(token, donationId);
      showToast('success', 'Donation deleted');
      loadDonations();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete donation');
    }
  };

  const startConversationWithDonor = async (donationId: string, donorId: string) => {
    if (!token) {
      setError('Please login to send messages');
      return;
    }

    try {
      // Fetch all conversations to check for existing ones with this donor
      const { conversations: allConversations } = await api.getConversations(token);

      // Check if conversation already exists with this donor (across all conversations)
      const existingConversation = allConversations.find(
        (conv: any) => {
          // Check if this conversation includes the donor as a participant
          return conv?.participants?.includes(donorId) && conv?.participants?.includes(user?.id);
        }
      );

      if (existingConversation) {
        // Open existing conversation directly in floating box
        setActiveConversation(existingConversation);
        return;
      }

      // Create supabase client
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(import.meta.env.VITE_SUPABASE_URL as string, import.meta.env.VITE_SUPABASE_ANON_KEY as string);

      // Create a new conversation
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert([
          {
            donation_id: donationId,
            participants: [user?.id, donorId].filter(Boolean),
          },
        ])
        .select('*')
        .single();

      if (convErr) throw convErr;

      // Open the new conversation directly in floating box
      setActiveConversation(conv);
      showToast('success', 'Started conversation with donor');
    } catch (err: any) {
      console.error('Error starting conversation:', err);
      showToast('error', 'Failed to start conversation');
    }
  };

  const handleLocationSelect = async (lat: number, lng: number) => {
    setLocation({ lat, lng });
    // Get location name using reverse geocoding
    const name = await reverseGeocode(lat, lng);
    setLocationName(name);
  };

  const closeConversation = () => {
    setActiveConversation(null);
  };

  // Filter and sort donations
  const filterAndSortDonations = (donations: any[]) => {
    let filtered = donations.filter(d => {
      // Donation type filter
      if (filters.donationType !== 'all' && d.donation_type !== filters.donationType) {
        return false;
      }

      // Date filters
      if (filters.dateFrom && new Date(d.available_from) < new Date(filters.dateFrom)) {
        return false;
      }
      if (filters.dateTo && new Date(d.expires_at) > new Date(filters.dateTo)) {
        return false;
      }

      // Location/distance filter
      if (filters.maxDistance && location && d.location_lat && d.location_lng) {
        const distance = haversineDistance(location.lat, location.lng, d.location_lat, d.location_lng);
        if (distance > parseFloat(filters.maxDistance)) {
          return false;
        }
      }

      return true;
    });

    // Sort donations
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'distance':
          if (location && a.location_lat && a.location_lng && b.location_lat && b.location_lng) {
            aValue = haversineDistance(location.lat, location.lng, a.location_lat, a.location_lng);
            bValue = haversineDistance(location.lat, location.lng, b.location_lat, b.location_lng);
          } else {
            aValue = 0;
            bValue = 0;
          }
          break;
        case 'date':
          aValue = new Date(a.created_at || a.available_from).getTime();
          bValue = new Date(b.created_at || b.available_from).getTime();
          break;
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  };

  const handleLocationClick = async (lat: number, lng: number) => {
    // Open Google Maps directly with route from user's location to donation location
    if (location) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${location.lat},${location.lng}&destination=${lat},${lng}&travelmode=driving`;
      window.open(url, '_blank');
    } else {
      // If no user location, just open the destination
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(url, '_blank');
    }
  };

  // Get location name for a donation
  const getDonationLocationName = async (donationId: string, lat: number, lng: number) => {
    if (donationLocationNames[donationId]) {
      return donationLocationNames[donationId];
    }

    try {
      const name = await reverseGeocode(lat, lng);
      setDonationLocationNames(prev => ({ ...prev, [donationId]: name }));
      return name;
    } catch (error) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  return (
    <div className="donate-page-container animate-fade-in">
      <div className="donate-header">
        <h2>Donate Leftovers</h2>
        <span>Post or claim leftover food in your local area</span>
      </div>

      {error && <div className="error-message-modern compact-error">{error}</div>}
      {success && <div className="success-message-modern compact-badge" style={{ background: '#d1fae5', color: '#065f46' }}>{success}</div>}

      <div className="donate-layout-grid">
        {/* Left Column: Form */}
        <div className="donate-form-card">
          <h3><Plus size={20} color="#1f7a4d" /> Post a Donation</h3>
          <form onSubmit={handleCreate} className="compact-form-grid">
            <input
              required
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((p: any) => ({ ...p, title: e.target.value }))}
              className="compact-input"
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((p: any) => ({ ...p, description: e.target.value }))}
              className="compact-textarea"
            />

            <div className="form-row">
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#718096', marginBottom: '0.25rem', display: 'block' }}>TYPE</label>
                <select
                  value={form.donation_type || 'human'}
                  onChange={(e) => setForm((p: any) => ({ ...p, donation_type: e.target.value }))}
                  className="compact-select"
                >
                  <option value="human">Human Food</option>
                  <option value="animal">Animal Feed</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <input
                placeholder="Qty"
                value={String(form.quantity)}
                onChange={(e) => setForm((p: any) => ({ ...p, quantity: Number(e.target.value) }))}
                className="compact-input"
              />
              <input
                placeholder="Unit (pcs/kg)"
                value={String(form.unit)}
                onChange={(e) => setForm((p: any) => ({ ...p, unit: e.target.value }))}
                className="compact-input"
              />
            </div>

            <input
              placeholder="Pickup instructions"
              value={String(form.pickup_instructions)}
              onChange={(e) => setForm((p: any) => ({ ...p, pickup_instructions: e.target.value }))}
              className="compact-input"
            />

            <div className="form-row">
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#718096', marginBottom: '0.25rem', display: 'block' }}>AVAILABLE</label>
                <input
                  type="date"
                  value={form.available_from || ''}
                  onChange={(e) => setForm((p: any) => ({ ...p, available_from: e.target.value }))}
                  className="compact-input"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#718096', marginBottom: '0.25rem', display: 'block' }}>EXPIRES</label>
                <input
                  type="date"
                  value={form.expires_at || ''}
                  onChange={(e) => setForm((p: any) => ({ ...p, expires_at: e.target.value }))}
                  className="compact-input"
                />
              </div>
            </div>

            <button type="button" className="location-btn-compact" onClick={() => setIsLocationSelectorOpen(true)}>
              <MapPin size={16} />
              {locationName || 'Select Location'}
            </button>

            <button className="primary-btn-modern" type="submit" disabled={creating} style={{ marginTop: '0.5rem' }}>
              {creating ? 'Posting...' : 'Post Donation'}
            </button>
          </form>
        </div>

        {/* Right Column: Filters & List */}
        <div className="donate-content-column">
          {/* Filters */}
          <div className="filters-section">
            <div className="filters-grid">
              <div className="filter-group">
                <label>TYPE</label>
                <select
                  value={filters.donationType}
                  onChange={(e) => setFilters(f => ({ ...f, donationType: e.target.value }))}
                  className="compact-select"
                >
                  <option value="all">All Types</option>
                  <option value="human">Human</option>
                  <option value="animal">Animal</option>
                </select>
              </div>
              <div className="filter-group">
                <label>MAX DISTANCE (KM)</label>
                <input
                  type="number"
                  placeholder="Any"
                  value={filters.maxDistance}
                  onChange={(e) => setFilters(f => ({ ...f, maxDistance: e.target.value }))}
                  className="compact-input"
                />
              </div>
              <div className="filter-group">
                <label>SORT BY</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="compact-select"
                >
                  <option value="date">Date</option>
                  <option value="distance">Distance</option>
                  <option value="title">Title</option>
                </select>
              </div>
              <div className="filter-group">
                <label>ORDER</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="compact-select"
                >
                  <option value="desc">Newest</option>
                  <option value="asc">Oldest</option>
                </select>
              </div>
            </div>
          </div>

          {/* Donations List */}
          <div className="donations-list-container">
            {loading ? (
              <div className="loading-state-modern">
                <div className="spinner-modern"></div>
                <p>Loading donations...</p>
              </div>
            ) : (() => {
              const filteredDonations = filterAndSortDonations(donations);
              return filteredDonations.length ? (
                <div className="donations-grid">
                  {filteredDonations.map((d) => (
                    <div key={d.id} className="donation-item-container" style={{ position: 'relative' }}>
                      <div className="donation-card-compact" style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: 'white',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        overflow: 'hidden',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                        e.currentTarget.style.borderColor = '#1f7a4d';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                      >
                        {/* Status indicator */}
                        <div style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: d.donation_type === 'animal' ? '#f59e0b' : '#10b981',
                          boxShadow: '0 0 0 1.5px white'
                        }}></div>

                        <div className="donation-card-header" style={{
                          padding: '0.75rem 0.875rem 0.5rem',
                          background: '#fafbfc'
                        }}>
                          <div className="donation-title-group" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            marginBottom: '0.5rem'
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{
                                margin: 0,
                                fontSize: '0.9rem',
                                fontWeight: '700',
                                color: '#1e293b',
                                lineHeight: '1.3',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>{d.title}</h4>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                marginTop: '0.375rem'
                              }}>
                                <span style={{
                                  backgroundColor: d.donation_type === 'animal' ? '#fef3c7' : '#dcfce7',
                                  color: d.donation_type === 'animal' ? '#92400e' : '#166534',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '10px',
                                  fontSize: '0.625rem',
                                  fontWeight: '600',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.025em'
                                }}>
                                  {d.donation_type === 'animal' ? 'Animal' : 'Human'}
                                </span>
                                {location && d.location_lat && d.location_lng && (
                                  <span style={{
                                    backgroundColor: '#dbeafe',
                                    color: '#1e40af',
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '10px',
                                    fontSize: '0.625rem',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.2rem'
                                  }}>
                                    <Navigation size={9} />
                                    {haversineDistance(location.lat, location.lng, d.location_lat, d.location_lng).toFixed(1)} km
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="donation-card-body" style={{
                          padding: '0.625rem 0.875rem'
                        }}>
                          {d.description && (
                            <p className="donation-desc" style={{
                              margin: '0 0 0.625rem 0',
                              color: '#64748b',
                              fontSize: '0.8rem',
                              lineHeight: '1.4',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>{d.description}</p>
                          )}

                          <div className="donation-meta-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.375rem',
                            marginBottom: '0.625rem'
                          }}>
                            <div className="meta-item" style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.375rem 0.5rem',
                              backgroundColor: '#f8fafc',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0'
                            }}>
                              <Package size={12} color="#64748b" />
                              <div>
                                <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Qty</div>
                                <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: '600' }}>{d.quantity} {d.unit}</div>
                              </div>
                            </div>
                            <div className="meta-item" style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.375rem 0.5rem',
                              backgroundColor: '#f8fafc',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0'
                            }}>
                              <Calendar size={12} color="#64748b" />
                              <div>
                                <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Available</div>
                                <div style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: '600' }}>{new Date(d.available_from).toLocaleDateString()}</div>
                              </div>
                            </div>
                          </div>

                          {d.location_lat && d.location_lng && (
                            <div className="meta-item" style={{
                              padding: '0.375rem 0.5rem',
                              backgroundColor: '#f0f9ff',
                              borderRadius: '6px',
                              border: '1px solid #bae6fd',
                              marginBottom: '0.625rem'
                            }}>
                              <LocationNameComponent
                                donationId={d.id}
                                lat={d.location_lat}
                                lng={d.location_lng}
                                onLocationClick={handleLocationClick}
                                getLocationName={getDonationLocationName}
                              />
                            </div>
                          )}
                        </div>

                        {d.pickup_instructions && (
                          <div style={{
                            backgroundColor: '#fefefe',
                            padding: '0.5rem 0.875rem',
                            borderTop: '1px solid #e2e8f0'
                          }}>
                            <div style={{
                              fontSize: '0.65rem',
                              fontWeight: '600',
                              color: '#374151',
                              marginBottom: '0.2rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.025em'
                            }}>
                              Pickup Instructions
                            </div>
                            <div style={{
                              color: '#6b7280',
                              fontSize: '0.75rem',
                              lineHeight: '1.3',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {d.pickup_instructions}
                            </div>
                          </div>
                        )}

                        <div className="donation-card-footer" style={{
                          padding: '0.625rem 0.875rem',
                          backgroundColor: '#fafbfc',
                          borderTop: '1px solid #e2e8f0'
                        }}>
                          {d.user_id === user?.id ? (
                            <div style={{
                              padding: '0.375rem 0.75rem',
                              background: '#dcfce7',
                              color: '#166534',
                              fontWeight: '600',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              textAlign: 'center',
                              display: 'inline-block',
                              border: '1px solid #86efac'
                            }}>
                              Your donation
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <button
                                onClick={() => startConversationWithDonor(d.id, d.user_id)}
                                style={{
                                  padding: '0.5rem',
                                  borderRadius: '8px',
                                  border: '1px solid #1f7a4d',
                                  backgroundColor: '#f0fdf4',
                                  color: '#166534',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 1px 2px rgba(31, 122, 77, 0.08)'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#dcfce7';
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f0fdf4';
                                  e.currentTarget.style.transform = 'scale(1)';
                                }}
                                title="Message donor"
                              >
                                <MessageCircle size={14} />
                              </button>

                              <button
                                className={`action-btn-compact ${requestedIds.includes(d.id) ? 'btn-disabled' : 'btn-request'}`}
                                onClick={() => requestDonation(d.id)}
                                disabled={requestingId === d.id || requestedIds.includes(d.id)}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem 0.875rem',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: requestedIds.includes(d.id)
                                    ? '#9ca3af'
                                    : '#1f7a4d',
                                  color: 'white',
                                  fontWeight: '600',
                                  fontSize: '0.8rem',
                                  cursor: requestedIds.includes(d.id) ? 'default' : 'pointer',
                                  transition: 'all 0.2s ease',
                                  boxShadow: requestedIds.includes(d.id) ? 'none' : '0 1px 3px rgba(31, 122, 77, 0.15)',
                                  position: 'relative',
                                  overflow: 'hidden'
                                }}
                                onMouseEnter={(e) => {
                                  if (!requestedIds.includes(d.id) && requestingId !== d.id) {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(31, 122, 77, 0.2)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!requestedIds.includes(d.id) && requestingId !== d.id) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(31, 122, 77, 0.15)';
                                  }
                                }}
                              >
                                {requestingId === d.id ? (
                                  <>
                                    <div style={{
                                      position: 'absolute',
                                      top: '50%',
                                      left: '50%',
                                      width: '14px',
                                      height: '14px',
                                      border: '2px solid rgba(255,255,255,0.3)',
                                      borderTop: '2px solid white',
                                      borderRadius: '50%',
                                      animation: 'spin 1s linear infinite',
                                      transform: 'translate(-50%, -50%)'
                                    }}></div>
                                    <span style={{ opacity: 0 }}>Requesting...</span>
                                  </>
                                ) : requestedIds.includes(d.id) ? 'Requested' : 'Request Pickup'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {requestedIds.includes(d.id) && requestConversations[d.id] && (
                        <div
                          onClick={() => setActiveConversation(requestConversations[d.id])}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '32px',
                            background: '#1f7a4d',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(31, 122, 77, 0.2)',
                            zIndex: 10,
                            transition: 'all 0.2s ease',
                            border: '1.5px solid white'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.08)';
                            e.currentTarget.style.boxShadow = '0 3px 8px rgba(31, 122, 77, 0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(31, 122, 77, 0.2)';
                          }}
                          title="Open messages"
                        >
                          <MessageCircle size={14} color="white" />
                          <div style={{
                            position: 'absolute',
                            top: '-1px',
                            right: '-1px',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            borderRadius: '50%',
                            width: '12px',
                            height: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.55rem',
                            fontWeight: 'bold',
                            border: '1px solid white'
                          }}>
                            !
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-donations">
                  <Leaf size={40} color="#cbd5e0" style={{ marginBottom: '0.75rem' }} />
                  <p style={{ fontSize: '0.9rem' }}>No donations found matching your filters.</p>
                  <button
                    className="primary-btn-modern"
                    onClick={() => setFilters({ location: '', dateFrom: '', dateTo: '', timeFrom: '', timeTo: '', maxDistance: '', donationType: 'all' })}
                    style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.625rem 1rem' }}
                  >
                    Clear Filters
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Top Right Corner - Manage Button */}
      {donations.some(d => d.user_id === user?.id) && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000
        }}>
          <button
            onClick={() => {
              setShowManageDonations(true);
            }}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '25px',
              border: '1px solid #1f7a4d',
              backgroundColor: '#1f7a4d',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(31, 122, 77, 0.2)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#166534';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1f7a4d';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Package size={16} />
            Manage Donations
          </button>
        </div>
      )}

      {activeConversation && <ChatOverlay conversation={activeConversation} onClose={closeConversation} />}

      <LocationSelector
        isOpen={isLocationSelectorOpen}
        onClose={() => setIsLocationSelectorOpen(false)}
        onLocationSelect={handleLocationSelect}
        initialLocation={location || undefined}
      />

      {managingDonationId && (
        <div style={{ position: 'fixed', right: '1.5rem', bottom: '1.5rem', width: 400, maxWidth: 'calc(100% - 3rem)', zIndex: 100 }}>
          <div className="donate-form-card" style={{ border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <strong style={{ color: '#1a202c' }}>Requests</strong>
              <button className="compact-btn" onClick={() => setManagingDonationId(null)}><span style={{ fontSize: '1.2rem' }}>×</span></button>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {donationRequestsList.length === 0 && <div style={{ color: '#718096', textAlign: 'center', padding: '1rem' }}>No requests yet.</div>}
              {donationRequestsList.map((r) => (
                <div key={r.id} style={{ padding: '0.75rem', borderRadius: 8, background: '#f7fafc', marginBottom: '0.5rem', border: '1px solid #edf2f7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.user?.full_name ?? `User ${r.user_id}`}</div>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#4a5568', marginBottom: '0.75rem' }}>{r.message}</div>
                  <div style={{ textAlign: 'right' }}>
                    {r.status === 'pending' ? (
                      <button className="primary-btn-modern" style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }} onClick={() => handleAcceptRequest(r.id)}>Accept Request</button>
                    ) : (
                      <span style={{ color: '#1f7a4d', fontWeight: 700, fontSize: '0.8rem', background: '#d1fae5', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{r.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Global Floating Message Icon */}
      {Object.keys(requestConversations).length > 0 && (
        <div 
          onClick={() => setShowInbox(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#1f7a4d',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            transition: 'all 0.2s ease'
          }}
          title="Open Inbox"
        >
          <MessageCircle size={24} color="white" />
          {Object.keys(requestConversations).length > 0 && (
            <div style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              backgroundColor: '#ef4444',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              fontWeight: 'bold'
            }}>
              {Object.keys(requestConversations).length}
            </div>
          )}
        </div>
      )}

      {/* Inbox Modal */}
      {showInbox && (
        <div style={{ position: 'fixed', right: '20px', bottom: '90px', width: 350, maxWidth: 'calc(100% - 40px)', zIndex: 1000 }}>
          <div className="donate-form-card" style={{ border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <strong style={{ color: '#1a202c' }}>Messages</strong>
              <button className="compact-btn" onClick={() => setShowInbox(false)}><span style={{ fontSize: '1.2rem' }}>×</span></button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {Object.keys(requestConversations).length === 0 ? (
                <div style={{ color: '#718096', textAlign: 'center', padding: '2rem' }}>No messages yet.</div>
              ) : (
                Object.entries(requestConversations).map(([donationId, conversation]) => {
                  // Find the donation to get its title
                  const donation = donations.find(d => d.id === donationId);
                  return (
                    <div 
                      key={donationId} 
                      onClick={() => {
                        setActiveConversation(conversation);
                        setShowInbox(false);
                      }}
                      style={{ 
                        padding: '0.75rem', 
                        borderRadius: 8, 
                        background: '#f7fafc', 
                        marginBottom: '0.5rem', 
                        border: '1px solid #edf2f7',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#edf2f7'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#f7fafc'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1f7a4d' }}>
                          {donation?.title || 'Donation'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#718096' }}>
                          {conversation?.messages?.length ? new Date(conversation.messages[conversation.messages.length - 1].created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#4a5568', marginBottom: '0.5rem' }}>
                        {conversation?.messages?.length ? 
                          conversation.messages[conversation.messages.length - 1].content : 
                          'No messages yet'
                        }
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MessageCircle size={14} color="#1f7a4d" />
                        <span style={{ fontSize: '0.75rem', color: '#718096' }}>
                          {conversation?.messages?.length || 0} messages
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage Donations Modal */}
      {showManageDonations && (
        <div style={{ position: 'fixed', right: '20px', top: '80px', width: 450, maxWidth: 'calc(100% - 40px)', zIndex: 1000 }}>
          <div className="donate-form-card" style={{ border: '1px solid #e2e8f0', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <strong style={{ color: '#1a202c' }}>My Donations</strong>
              <button className="compact-btn" onClick={() => setShowManageDonations(false)}><span style={{ fontSize: '1.2rem' }}>×</span></button>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {donations.filter(d => d.user_id === user?.id).length === 0 ? (
                <div style={{ color: '#718096', textAlign: 'center', padding: '2rem' }}>No donations yet.</div>
              ) : (
                donations.filter(d => d.user_id === user?.id).map((donation) => (
                  <div 
                    key={donation.id} 
                    style={{ 
                      padding: '1rem', 
                      borderRadius: 8, 
                      background: '#f7fafc', 
                      marginBottom: '0.75rem', 
                      border: '1px solid #edf2f7'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1f7a4d', marginBottom: '0.25rem' }}>
                          {donation.title}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                          {donation.quantity} {donation.unit} • {donation.donation_type === 'animal' ? 'Animal Feed' : 'Human Food'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#374151' }}>
                          Available: {new Date(donation.available_from).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDonation(donation.id)}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid #ef4444',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fee2e2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                        }}
                        title="Delete donation"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <button
                        onClick={() => {
                          openManageRequests(donation.id);
                          setShowManageDonations(false);
                        }}
                        style={{
                          flex: 1,
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #1f7a4d',
                          backgroundColor: '#f0fdf4',
                          color: '#166534',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#dcfce7';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f0fdf4';
                        }}
                      >
                        Manage Requests
                      </button>
                    </div>
                    
                    {donation.description && (
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb' }}>
                        {donation.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Donate;
