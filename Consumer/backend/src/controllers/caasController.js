import { supabase } from '../config/supabaseClient.js';
import { requestChargingOTP, verifyChargingOTP, queryBalance, subscribeUser } from '../services/applinkService.js';
import { v4 as uuidv4 } from 'uuid';

const USERS_TABLE = 'users';
const PREMIUM_PRICE = '49.00'; // ৳49 per month

const ensureSupabase = (res) => {
    if (!supabase) {
        res.status(500).json({ message: 'Supabase client is not configured' });
        return false;
    }
    return true;
};

/**
 * Request OTP for premium subscription charging
 */
export const requestPremiumOTP = async (req, res) => {
    if (!ensureSupabase(res)) return;

    const userId = req.user.id;

    try {
        // Get user's phone number
        const { data: user, error: userError } = await supabase
            .from(USERS_TABLE)
            .select('phone, applink_subscribed')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        if (!user?.phone) {
            return res.status(400).json({
                message: 'Phone number is required. Please add your phone number first.',
            });
        }

        // Check if phone is Banglalink
        const phoneDigits = user.phone.replace(/^\+?880/, '');
        if (!phoneDigits.match(/^(017|013|019)/)) {
            return res.status(400).json({
                message: 'Premium subscription via carrier billing is only available for Banglalink numbers (017, 013, 019).',
                isBanglalink: false,
            });
        }

        // Generate unique transaction ID
        const externalTrxId = `PREMIUM_${userId}_${Date.now()}`;

        // Request OTP from AppLink
        const otpResponse = await requestChargingOTP(user.phone, PREMIUM_PRICE, externalTrxId);

        if (!otpResponse.success) {
            return res.status(400).json({
                message: otpResponse.statusDetail || 'Failed to request OTP',
                statusCode: otpResponse.statusCode,
            });
        }

        // Store transaction reference in database
        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update({
                charging_reference_no: otpResponse.requestCorrelator,
                charging_status: 'OTP_REQUESTED',
                charging_amount: PREMIUM_PRICE,
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Failed to store charging reference:', updateError);
        }

        return res.json({
            success: true,
            message: 'OTP sent to your mobile number',
            referenceNo: otpResponse.requestCorrelator,
            externalTrxId: otpResponse.externalTrxId,
            amount: PREMIUM_PRICE,
        });
    } catch (error) {
        console.error('requestPremiumOTP error:', error);
        return res.status(500).json({
            message: 'Failed to request OTP',
            error: error.message,
        });
    }
};

/**
 * Verify OTP and complete premium subscription payment
 */
export const verifyPremiumOTP = async (req, res) => {
    if (!ensureSupabase(res)) return;

    const userId = req.user.id;
    const { otp, referenceNo } = req.body;

    if (!otp || !referenceNo) {
        return res.status(400).json({
            message: 'OTP and reference number are required',
        });
    }

    try {
        // Get user data
        const { data: user, error: userError } = await supabase
            .from(USERS_TABLE)
            .select('phone, charging_reference_no, charging_status')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        // Verify reference matches
        if (user.charging_reference_no !== referenceNo) {
            return res.status(400).json({
                message: 'Invalid reference number',
            });
        }

        // Verify OTP with AppLink
        const verifyResponse = await verifyChargingOTP(referenceNo, otp, user.phone);

        if (!verifyResponse.success) {
            return res.status(400).json({
                message: verifyResponse.statusDetail || 'Invalid OTP',
                statusCode: verifyResponse.statusCode,
            });
        }

        // OTP verified successfully - update user to premium (will be confirmed via webhook)
        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update({
                charging_status: 'OTP_VERIFIED',
                last_charge_date: new Date().toISOString(),
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Failed to update charging status:', updateError);
        }

        // Subscribe user to AppLink if not already subscribed
        if (!user.applink_subscribed) {
            try {
                await subscribeUser(user.phone);
            } catch (subscribeError) {
                console.error('Failed to subscribe user after payment:', subscribeError);
            }
        }

        return res.json({
            success: true,
            message: 'Payment verified! Your premium subscription will be activated shortly.',
            statusCode: verifyResponse.statusCode,
        });
    } catch (error) {
        console.error('verifyPremiumOTP error:', error);
        return res.status(500).json({
            message: 'Failed to verify OTP',
            error: error.message,
        });
    }
};

/**
 * Handle charging notification webhook from AppLink
 */
export const handleChargingNotification = async (req, res) => {
    // Handle OPTIONS for CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Handle empty POST requests (validation)
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(200).json({
            statusCode: 'S1000',
            statusDetail: 'Request was successfully processed',
        });
    }

    if (!ensureSupabase(res)) return;

    try {
        const {
            timeStamp,
            TotalAmount,
            externalTrxId,
            balanceDue,
            statusDetail,
            currency,
            version,
            internalTrxId,
            paidAmount,
            referenceId,
            statusCode,
        } = req.body;

        console.log('📥 Charging notification received:', {
            externalTrxId,
            statusCode,
            paidAmount,
            TotalAmount,
        });

        // Extract user ID from external transaction ID (format: PREMIUM_{userId}_{timestamp})
        const userIdMatch = externalTrxId?.match(/PREMIUM_(.+?)_\d+/);
        if (!userIdMatch) {
            console.warn('Could not extract user ID from externalTrxId:', externalTrxId);
            return res.json({
                statusCode: 'S1000',
                statusDetail: 'Notification received',
            });
        }

        const userId = userIdMatch[1];

        // Check if payment was successful
        const isSuccess = statusCode === 'S1000' && parseFloat(paidAmount) > 0;

        // Update user subscription status
        const updateData = {
            charging_status: isSuccess ? 'COMPLETED' : 'FAILED',
            last_charge_date: isSuccess ? new Date().toISOString() : undefined,
        };

        if (isSuccess) {
            // Activate premium subscription
            updateData.applink_subscribed = true;
            updateData.applink_subscription_status = 'REGISTERED';
            updateData.applink_subscribed_at = new Date().toISOString();
            updateData.subscription_tier = 'premium'; // Using existing column
        }

        const { error: updateError } = await supabase
            .from(USERS_TABLE)
            .update(updateData)
            .eq('id', userId);

        if (updateError) {
            console.error('Failed to update user after charging notification:', updateError);
        } else {
            console.log(`✅ User ${userId} premium status updated:`, isSuccess ? 'ACTIVATED' : 'FAILED');
        }

        // Always return success to AppLink
        return res.json({
            statusCode: 'S1000',
            statusDetail: 'Request was successfully processed',
        });
    } catch (error) {
        console.error('handleChargingNotification error:', error);
        // Always return success to prevent retries
        return res.json({
            statusCode: 'S1000',
            statusDetail: 'Request was successfully processed',
        });
    }
};

/**
 * Query subscriber balance
 */
export const getSubscriberBalance = async (req, res) => {
    if (!ensureSupabase(res)) return;

    const userId = req.user.id;

    try {
        const { data: user, error: userError } = await supabase
            .from(USERS_TABLE)
            .select('phone')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        if (!user?.phone) {
            return res.status(400).json({
                message: 'Phone number is required',
            });
        }

        const balanceResponse = await queryBalance(user.phone);

        return res.json({
            success: balanceResponse.success,
            accountStatus: balanceResponse.accountStatus,
            accountType: balanceResponse.accountType,
            accountBalance: balanceResponse.accountBalance,
            statusCode: balanceResponse.statusCode,
            statusDetail: balanceResponse.statusDetail,
        });
    } catch (error) {
        console.error('getSubscriberBalance error:', error);
        return res.status(500).json({
            message: 'Failed to get balance',
            error: error.message,
        });
    }
};
