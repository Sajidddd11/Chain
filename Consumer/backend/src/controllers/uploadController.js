import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import OpenAI from 'openai';
import { supabase } from '../config/supabaseClient.js';

const UPLOADS_TABLE = 'uploads';
const USER_INVENTORY_TABLE = 'user_inventory';
const FOOD_ITEMS_TABLE = 'food_items';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

// AI-powered expiry date determination
const determineExpiryDate = async (itemName, category) => {
  if (!openai) {
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a food safety expert. Based on the item name and category, suggest a realistic expiry date in days from today. Consider typical shelf life for that type of food. Return only a number representing days until expiry.',
        },
        {
          role: 'user',
          content: `Item: "${itemName}", Category: "${category}". How many days until this item typically expires? Return only the number of days.`,
        },
      ],
      max_tokens: 10,
    });

    const content = response.choices[0].message.content?.trim();
    const days = parseInt(content);

    if (isNaN(days) || days < 1 || days > 3650) {
      return null; // Invalid response
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    return expiryDate.toISOString().slice(0, 10); // Return YYYY-MM-DD format
  } catch (error) {
    console.error('AI expiry determination error:', error);
    return null;
  }
};

export const handleFileUpload = async (req, res) => {
  if (!ensureSupabase(res)) return;

  if (!req.file) {
    return res.status(400).json({ message: 'File is required' });
  }

  const { inventoryItemId, consumptionLogId } = req.body;

  try {
    const { data, error } = await supabase
      .from(UPLOADS_TABLE)
      .insert({
        user_id: req.user.id,
        file_path: req.file.path.replace(/\\/g, '/'),
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size_in_bytes: req.file.size,
        inventory_item_id: inventoryItemId,
        consumption_log_id: consumptionLogId,
      })
      .select('*')
      .single();

    if (error) throw error;

    return res.status(201).json({
      upload: {
        id: data.id,
        storedAt: data.file_path,
        filename: path.basename(data.file_path),
        originalName: data.original_name,
      },
    });
  } catch (error) {
    console.error('handleFileUpload error', error);
    return res.status(500).json({ message: 'Failed to store upload metadata', error: error.message });
  }
};

export const handleReceiptScan = async (req, res) => {
  if (!ensureSupabase(res)) return;

  if (!openai) {
    return res.status(500).json({ message: 'OpenAI API key not configured' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'File is required' });
  }

  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ message: 'File must be an image' });
  }

  try {
    // Resize image to 512x512 for OpenAI
    const resizedBuffer = await sharp(req.file.path)
      .resize(512, 512, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
    const base64Image = resizedBuffer.toString('base64');

    // Call OpenAI Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all grocery items from this receipt. For each item, provide: name, quantity, unit, category, and price in Bangladeshi Taka (numeric). Return a JSON array of objects. Return ONLY raw JSON. No markdown formatting, no code blocks.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content?.trim();
    if (!content) {
      return res.status(500).json({ message: 'Failed to process receipt image' });
    }

    let extractedItems;
    try {
      // Clean up markdown code blocks if present
      const jsonString = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      extractedItems = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      return res.status(500).json({ message: 'Failed to parse extracted items from receipt' });
    }

    if (!Array.isArray(extractedItems)) {
      return res.status(500).json({ message: 'Extracted data is not an array' });
    }

    // Add expiry dates to extracted items and normalize price values
    for (const item of extractedItems) {
      if (item.price !== undefined && item.price !== null && item.price !== '') {
        const parsedPrice = Number(item.price);
        item.price = Number.isNaN(parsedPrice) ? null : parsedPrice;
      } else {
        item.price = null;
      }

      if (!item.expiresAt) {
        item.expiresAt = await determineExpiryDate(item.name, item.category);
      }
    }

    // Store the upload
    const { data: uploadData, error: uploadError } = await supabase
      .from(UPLOADS_TABLE)
      .insert({
        user_id: req.user.id,
        file_path: req.file.path.replace(/\\/g, '/'),
        original_name: req.file.originalname,
        mime_type: req.file.mimetype,
        size_in_bytes: req.file.size,
      })
      .select('*')
      .single();

    if (uploadError) throw uploadError;

    return res.status(200).json({
      message: 'Receipt processed successfully',
      items: extractedItems,
      upload: {
        id: uploadData.id,
        filename: path.basename(uploadData.file_path),
      },
    });
  } catch (error) {
    console.error('handleReceiptScan error', error);
    return res.status(500).json({ message: 'Failed to scan receipt', error: error.message });
  }
};

export const handleLeftoverScan = async (req, res) => {
  if (!ensureSupabase(res)) return;

  if (!openai) {
    return res.status(500).json({ message: 'OpenAI API key not configured' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'File is required' });
  }

  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ message: 'File must be an image' });
  }

  try {
    // Resize image to 512x512 for OpenAI
    const resizedBuffer = await sharp(req.file.path)
      .resize(512, 512, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toBuffer();
    const base64Image = resizedBuffer.toString('base64');

    // Call OpenAI Vision
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Identify the food items in this image. Return a simple comma-separated list of ingredients (e.g. "rice, chicken, broccoli"). Do not include quantities or extra text.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 100,
    });

    const ingredients = response.choices[0].message.content?.trim();

    return res.status(200).json({
      message: 'Leftovers scanned successfully',
      ingredients
    });
  } catch (error) {
    console.error('handleLeftoverScan error', error);
    return res.status(500).json({ message: 'Failed to scan leftovers', error: error.message });
  }
};

export { determineExpiryDate };

