import { supabase } from '../config/supabaseClient.js';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

export const createDonation = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const {
    title,
    description,
    quantity,
    unit,
    pickup_instructions,
    location_lat,
    location_lng,
    available_from,
    expires_at,
    donation_type = 'human',
  } = req.body;

  // Validate donation type
  if (!['human', 'animal'].includes(donation_type)) {
    return res.status(400).json({ message: 'Invalid donation type. Must be "human" or "animal"' });
  }

  try {
    const { data, error } = await supabase
      .from('donations')
      .insert([
        {
          user_id: req.user.id,
          title,
          description,
          quantity,
          unit,
          pickup_instructions,
          location_lat,
          location_lng,
          available_from,
          expires_at,
          donation_type,
          status: 'available',
        },
      ])
      .select('*')
      .single();

    if (error) throw error;

    return res.status(201).json({ message: 'Donation created', donation: data });
  } catch (err) {
    console.error('createDonation error', err);
    return res.status(500).json({ message: 'Failed to create donation', error: err.message });
  }
};

export const listDonations = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { status = 'available', type } = req.query;

  try {
    let query = supabase
      .from('donations')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    // Filter by donation type if specified
    if (type && ['human', 'animal'].includes(type)) {
      query = query.eq('donation_type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ donations: data });
  } catch (err) {
    console.error('listDonations error', err);
    return res.status(500).json({ message: 'Failed to fetch donations', error: err.message });
  }
};

export const getDonation = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { id } = req.params;

  try {
    const { data, error } = await supabase.from('donations').select('*').eq('id', id).single();
    if (error) throw error;
    return res.status(200).json({ donation: data });
  } catch (err) {
    console.error('getDonation error', err);
    return res.status(500).json({ message: 'Failed to fetch donation', error: err.message });
  }
};

export const deleteDonation = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { id } = req.params;

  try {
    // Check if the donation belongs to the user
    const { data: donation, error: fetchError } = await supabase
      .from('donations')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !donation) {
      return res.status(404).json({ message: 'Donation not found or access denied' });
    }

    // Delete the donation
    const { error } = await supabase.from('donations').delete().eq('id', id);

    if (error) throw error;

    return res.status(200).json({ message: 'Donation deleted successfully' });
  } catch (err) {
    console.error('deleteDonation error', err);
    return res.status(500).json({ message: 'Failed to delete donation', error: err.message });
  }
};

export const createRequest = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { id: donationId } = req.params;
  const { message } = req.body;

  try {
    // Insert request
    const { data, error } = await supabase
      .from('donation_requests')
      .insert([
        {
          donation_id: donationId,
          user_id: req.user.id,
          message,
          status: 'pending',
        },
      ])
      .select('*')
      .single();

    if (error) throw error;

    // Create a conversation for messaging
    // Fetch donation to add donor as participant
    const { data: donationRow } = await supabase.from('donations').select('*').eq('id', donationId).single();
    const donorId = donationRow?.user_id;

    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert([
        {
          donation_id: donationId,
          participants: [req.user.id, donorId].filter(Boolean),
        },
      ])
      .select('*')
      .single();

    if (convErr) {
      console.warn('Failed to create conversation for request', convErr.message);
    }

    return res.status(201).json({ message: 'Request created', request: data, conversation: conv ?? null });
  } catch (err) {
    console.error('createRequest error', err);
    return res.status(500).json({ message: 'Failed to create request', error: err.message });
  }
};

export const getMyRequests = async (req, res) => {
  if (!ensureSupabase(res)) return;
  try {
    // First get the requests
    const { data: requests, error: requestsError } = await supabase
      .from('donation_requests')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (requestsError) throw requestsError;

    // Then get donations and conversations separately to avoid join issues
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        try {
          // Get donation details
          const { data: donation } = await supabase
            .from('donations')
            .select('*')
            .eq('id', request.donation_id)
            .single();

          // Get conversation details
          const { data: conversation } = await supabase
            .from('conversations')
            .select('*')
            .eq('donation_id', request.donation_id)
            .single();

          return {
            ...request,
            donations: donation || null,
            conversations: conversation || null,
          };
        } catch (err) {
          console.warn('Error enriching request', request.id, err.message);
          return {
            ...request,
            donations: null,
            conversations: null,
          };
        }
      })
    );

    return res.status(200).json({ requests: enrichedRequests });
  } catch (err) {
    console.error('getMyRequests error', err);
    return res.status(500).json({ message: 'Failed to fetch requests', error: err.message });
  }
};

export const acceptRequest = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { id: requestId } = req.params; // request id

  try {
    // Mark request as accepted
    const { data: reqData, error: reqErr } = await supabase
      .from('donation_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)
      .select('*')
      .single();

    if (reqErr) throw reqErr;

    // Mark donation as claimed
    const { data: donationData, error: donationErr } = await supabase
      .from('donations')
      .update({ status: 'claimed', accepted_by: req.user.id })
      .eq('id', reqData.donation_id)
      .select('*')
      .single();

    if (donationErr) throw donationErr;

    return res.status(200).json({ message: 'Request accepted', request: reqData, donation: donationData });
  } catch (err) {
    console.error('acceptRequest error', err);
    return res.status(500).json({ message: 'Failed to accept request', error: err.message });
  }
};

export const listRequestsForDonation = async (req, res) => {
  if (!ensureSupabase(res)) return;
  const { id: donationId } = req.params;
  try {
    const { data, error } = await supabase
      .from('donation_requests')
      .select('*, user:users(id, full_name)')
      .eq('donation_id', donationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.status(200).json({ requests: data });
  } catch (err) {
    console.error('listRequestsForDonation error', err);
    return res.status(500).json({ message: 'Failed to fetch requests', error: err.message });
  }
};

export default {
  createDonation,
  listDonations,
  getDonation,
  deleteDonation,
  createRequest,
  acceptRequest,
  getMyRequests,
  listRequestsForDonation,
};
