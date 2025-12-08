const supabase = require('../config/database');

/**
 * Get farmer by phone number (helper function)
 */
async function getFarmerByPhoneNumber(phoneNumber) {
  try {
    // Clean phone number (remove + and format consistently)
    const cleanNumber = phoneNumber.replace(/[\+\s\-\(\)]/g, '');
    
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, mobile_number, stock_waste')
      .or(`mobile_number.eq.${phoneNumber},mobile_number.eq.+${cleanNumber},mobile_number.eq.${cleanNumber}`)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error finding farmer by phone:', error);
    return null;
  }
}

/**
 * Enable waste collection for a farmer by phone number
 * POST /api/waste/enable
 * Body: { phone_number: string }
 */
const enableWasteCollection = async (req, res) => {
  try {
    const phoneNumber = req.body.phone_number || req.body.phoneNumber || req.body.number;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'phone_number is required'
      });
    }

    const farmer = await getFarmerByPhoneNumber(phoneNumber);

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Update stock_waste to true
    const { data, error } = await supabase
      .from('users')
      .update({
        stock_waste: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', farmer.id)
      .select('id, full_name, mobile_number, stock_waste')
      .single();

    if (error) {
      console.error('Error enabling waste collection:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to enable waste collection'
      });
    }

    res.json({
      success: true,
      message: 'Waste collection enabled successfully',
      farmer: {
        id: data.id,
        full_name: data.full_name,
        mobile_number: data.mobile_number,
        stock_waste: data.stock_waste
      }
    });
  } catch (error) {
    console.error('Enable waste collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update waste data for a farmer by phone number
 * POST /api/waste/update
 * Body: {
 *   phone_number: string,
 *   wastes: [
 *     { waste_name: string, amount: number, unit: string (kg|mon|quintal|ton) },
 *     ...
 *   ]
 * }
 */
const updateWasteData = async (req, res) => {
  try {
    const phoneNumber = req.body.phone_number || req.body.phoneNumber || req.body.number;
    const wasteEntries = req.body.wastes || req.body.waste_entries || req.body.wasteEntries;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'phone_number is required'
      });
    }

    if (!Array.isArray(wasteEntries) || wasteEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'wastes must be a non-empty array'
      });
    }

    const allowedUnits = ['kg', 'mon', 'quintal', 'ton'];
    const sanitizedEntries = [];
    for (const entry of wasteEntries) {
      const wasteName = entry?.waste_name || entry?.name || entry?.wasteName;
      const amountNum = Number(entry?.amount);
      const unit = entry?.unit;

      if (!wasteName || String(wasteName).trim().length < 1) {
        return res.status(400).json({
          success: false,
          message: 'Each waste item must include waste_name (min 1 character)'
        });
      }

      if (!Number.isFinite(amountNum) || amountNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Each waste item must include a non-negative amount'
        });
      }

      if (!allowedUnits.includes(String(unit))) {
        return res.status(400).json({
          success: false,
          message: `Each waste item must include unit from: ${allowedUnits.join(', ')}`
        });
      }

      sanitizedEntries.push({
        waste_name: String(wasteName).trim(),
        amount: amountNum,
        unit: unit
      });
    }

    const farmer = await getFarmerByPhoneNumber(phoneNumber);

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Check if waste collection is enabled
    if (!farmer.stock_waste) {
      return res.status(400).json({
        success: false,
        message: 'Waste collection is not enabled for this farmer. Please enable it first.'
      });
    }

    // Remove existing waste entries for the farmer
    const { error: deleteError } = await supabase
      .from('farmer_waste')
      .delete()
      .eq('user_id', farmer.id);

    if (deleteError) {
      console.error('Error deleting existing waste data:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Failed to reset previous waste data'
      });
    }

    // Insert new waste entries
    let inserted = [];
    if (sanitizedEntries.length > 0) {
      const payload = sanitizedEntries.map(entry => ({
        user_id: farmer.id,
        waste_name: entry.waste_name,
        amount: entry.amount,
        unit: entry.unit
      }));

      const { data, error } = await supabase
        .from('farmer_waste')
        .insert(payload)
        .select('id, waste_name, amount, unit, created_at, updated_at');

      if (error) {
        console.error('Error inserting waste data:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to save waste data'
        });
      }

      inserted = data || [];
    }

    res.json({
      success: true,
      message: 'Waste data updated successfully',
      waste: inserted
    });
  } catch (error) {
    console.error('Update waste data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get waste data for a farmer by phone number
 * POST /api/waste/get
 * Body: { phone_number: string }
 */
const getWasteData = async (req, res) => {
  try {
    const phoneNumber = req.body.phone_number || req.body.phoneNumber || req.body.number;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'phone_number is required'
      });
    }

    const farmer = await getFarmerByPhoneNumber(phoneNumber);

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer not found'
      });
    }

    // Get all waste data for this farmer
    const { data: wasteData, error } = await supabase
      .from('farmer_waste')
      .select('id, waste_name, amount, unit, created_at, updated_at')
      .eq('user_id', farmer.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching waste data:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch waste data'
      });
    }

    res.json({
      success: true,
      farmer: {
        id: farmer.id,
        full_name: farmer.full_name,
        mobile_number: farmer.mobile_number,
        stock_waste: farmer.stock_waste
      },
      waste: wasteData || []
    });
  } catch (error) {
    console.error('Get waste data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  enableWasteCollection,
  updateWasteData,
  getWasteData,
  getFarmerByPhoneNumber
};

