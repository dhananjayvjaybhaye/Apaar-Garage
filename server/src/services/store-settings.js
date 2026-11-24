import { defaultReturnDays, invoicePrefix } from '../config/business.js';
import { readSellerOptions } from '../config/seller.js';
import {
  acknowledgementMs,
  codRiskDefaults,
  readOrderRetentionDays,
  resolutionMonths,
  settingsCacheMs,
  storeSettingsId,
} from '../config/store-policy.js';
import { StoreSettings } from '../models/store-settings.js';
import { recordAudit } from './audit.js';
import { settingsChanges } from './audit-summaries.js';
import { transaction } from './transaction.js';
import { settingsInput } from '../utils/store-settings-input.js';

export function settingsDefaults(payment, env = process.env) {
  const seller = readSellerOptions(env);
  const contact = (name) => env[name]?.trim() || null;
  const number = (name, fallback, convert = Number) => {
    const value = contact(name);
    if (value === 'off') return null;
    return value === null ? fallback : convert(value);
  };
  return settingsInput.parse({
    seller: {
      legalName: contact('SELLER_NAME'),
      tradeName: contact('SELLER_TRADE_NAME') ?? seller.name,
      state: seller.state,
      address: seller.address ?? null,
      gstin: seller.gstin ?? null,
    },
    gstRegistered: seller.gstRegistered,
    customerCare: {
      phone: contact('CUSTOMER_CARE_PHONE'),
      email: contact('CUSTOMER_CARE_EMAIL'),
      hours: contact('CUSTOMER_CARE_HOURS'),
    },
    grievanceOfficer: {
      name: contact('GRIEVANCE_NAME'),
      designation: contact('GRIEVANCE_DESIGNATION'),
      email: contact('GRIEVANCE_EMAIL'),
      phone: contact('GRIEVANCE_PHONE'),
      address: contact('GRIEVANCE_ADDRESS'),
    },
    defaultReturnWindowDays: number('DEFAULT_RETURN_WINDOW_DAYS', defaultReturnDays),
    codFeePaise: payment.fee,
    codMinPaise: payment.minimum,
    codMaxPaise: payment.maximum,
    deliveryFeePaise: payment.deliveryFee,
    freeDeliveryThresholdPaise: payment.freeDeliveryMinimum,
    deliveryEstimate: payment.deliveryEstimate,
    serviceablePincodeRules: payment.deliveryRules,
    invoicePrefix: contact('INVOICE_PREFIX'),
    firstOrderDiscountPercent: payment.firstOrderPercent,
    risk: {
      openPerPhone: number('COD_OPEN_PER_PHONE', codRiskDefaults.openPerPhone),
      openPerAddress: number('COD_OPEN_PER_ADDRESS', codRiskDefaults.openPerAddress),
      firstOrderMaxPaise: number(
        'COD_FIRST_ORDER_MAX',
        codRiskDefaults.firstOrderMaxPaise,
        (value) => Math.round(Number(value) * 100),
      ),
      confirmationAbovePaise: number(
        'COD_CONFIRM_ABOVE',
        codRiskDefaults.confirmationAbovePaise,
        (value) => Math.round(Number(value) * 100),
      ),
      undeliveredThreshold: number(
        'COD_UNDELIVERED_THRESHOLD',
        codRiskDefaults.undeliveredThreshold,
      ),
      undeliveredLookbackDays: number(
        'COD_UNDELIVERED_LOOKBACK_DAYS',
        codRiskDefaults.undeliveredLookbackDays,
      ),
      repeatedUndeliveredAction: contact('COD_UNDELIVERED_ACTION') ?? 'flag',
    },
  });
}

export function createSettingsService(defaults) {
  let cache;
  let expires = 0;
  let refreshing;
  let generation = 0;

  async function load() {
    try {
      return await StoreSettings.findOneAndUpdate(
        { _id: storeSettingsId },
        {
          $setOnInsert: { value: defaults },
        },
        { upsert: true, returnDocument: 'after', timestamps: false },
      ).lean();
    } catch (error) {
      if (error.code !== 11000) throw error;
      return StoreSettings.findById(storeSettingsId).lean();
    }
  }

  return {
    async read() {
      if (Date.now() < expires) return cache;
      const readGeneration = generation;
      refreshing ??= load()
        .then((row) => {
          if (readGeneration === generation) {
            cache = settingsInput.parse(row.value);
            expires = Date.now() + settingsCacheMs;
          }
          return cache;
        })
        .finally(() => {
          refreshing = undefined;
        });
      return refreshing;
    },
    async write(value, audit) {
      const parsed = settingsInput.parse(value);
      await transaction(async (session) => {
        const previous = await StoreSettings.findOneAndUpdate(
          { _id: storeSettingsId },
          { $set: { value: parsed } },
          { upsert: true, runValidators: true, returnDocument: 'before', session },
        ).lean();
        const change = settingsChanges(previous?.value ?? {}, parsed);
        if (Object.keys(change.after).length) {
          await recordAudit(
            'settings.updated',
            { ...audit, target: storeSettingsId, ...change },
            session,
          );
        }
      });
      generation++;
      cache = parsed;
      expires = Date.now() + settingsCacheMs;
      return cache;
    },
  };
}

export async function commerceOptions(options) {
  const settings = await options.settings.read();
  return {
    ...options,
    seller: {
      name: settings.seller.legalName ?? settings.seller.tradeName,
      tradeName: settings.seller.tradeName,
      state: settings.seller.state,
      address: settings.seller.address ?? undefined,
      gstin: settings.seller.gstin ?? undefined,
      gstRegistered: settings.gstRegistered,
      invoicePrefix: settings.invoicePrefix ?? invoicePrefix,
    },
    risk: settings.risk,
    defaultReturnWindowDays: settings.defaultReturnWindowDays,
    firstOrderPercent: settings.firstOrderDiscountPercent,
    deliveryRules: [...settings.serviceablePincodeRules].sort(
      (a, b) => b.prefix.length - a.prefix.length,
    ),
    deliveryEstimate: settings.deliveryEstimate,
    fee: settings.codFeePaise,
    minimum: settings.codMinPaise,
    maximum: settings.codMaxPaise,
    deliveryFee: settings.deliveryFeePaise,
    freeDeliveryMinimum: settings.freeDeliveryThresholdPaise,
  };
}

export function publicStoreInfo(settings, orderRetentionDays = readOrderRetentionDays()) {
  const {
    seller,
    gstRegistered,
    customerCare,
    grievanceOfficer,
    policyDetails,
    defaultReturnWindowDays,
    codFeePaise,
    codMinPaise,
    codMaxPaise,
    deliveryFeePaise,
    freeDeliveryThresholdPaise,
    serviceablePincodeRules,
    deliveryEstimate,
  } = settings;
  return {
    seller: { ...seller, gstin: gstRegistered ? seller.gstin : null },
    gstRegistered,
    customerCare,
    grievanceOfficer,
    policyDetails,
    orderRetentionDays,
    complaints: { acknowledgementHours: acknowledgementMs / (60 * 60 * 1000), resolutionMonths },
    defaultReturnWindowDays,
    codFeePaise,
    codMinPaise,
    codMaxPaise,
    deliveryFeePaise,
    freeDeliveryThresholdPaise,
    serviceablePincodeRules,
    deliveryEstimate,
  };
}
