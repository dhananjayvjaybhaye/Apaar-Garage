import { z } from 'zod';
import { indianPhone } from './indian-phone.js';
import { deliveryRule } from '../services/delivery.js';

const optional = (schema) => schema.nullable().default(null);
const text = z.string().trim().min(1).max(500);
const paise = z.int().nonnegative();
const email = z.email().max(254);
const policyText = optional(z.string().trim().min(1).max(1000));

export const settingsInput = z
  .strictObject({
    seller: z.strictObject({
      legalName: optional(text),
      tradeName: text,
      address: optional(text),
      state: text,
      gstin: optional(
        z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[0-9A-Z]{15}$/),
      ),
    }),
    gstRegistered: z.boolean(),
    customerCare: z.strictObject({
      phone: optional(indianPhone),
      email: optional(email),
      hours: optional(text),
    }),
    grievanceOfficer: z.strictObject({
      name: optional(text),
      designation: optional(text),
      email: optional(email),
      phone: optional(indianPhone),
      address: optional(text),
    }),
    policyDetails: z
      .strictObject({
        returnConditions: policyText,
        nonReturnableItems: policyText,
        refundTimeline: policyText,
        exchangeTerms: policyText,
        warrantyTerms: policyText,
        otherDataRetention: policyText,
      })
      .prefault({}),
    defaultReturnWindowDays: z.int().min(0).max(365),
    codFeePaise: paise,
    codMinPaise: paise,
    codMaxPaise: optional(paise),
    deliveryFeePaise: paise,
    freeDeliveryThresholdPaise: optional(paise),
    deliveryEstimate: text,
    serviceablePincodeRules: z.array(deliveryRule).max(500),
    invoicePrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,5}$/),
    firstOrderDiscountPercent: z.int().min(0).max(100),
    risk: z.strictObject({
      openPerPhone: optional(z.int().positive()),
      openPerAddress: optional(z.int().positive()),
      firstOrderMaxPaise: optional(paise),
      confirmationAbovePaise: optional(paise),
      undeliveredThreshold: optional(z.int().positive()),
      undeliveredLookbackDays: z.int().min(1).max(365),
      repeatedUndeliveredAction: z.enum(['flag', 'block']),
    }),
  })
  .superRefine((value, context) => {
    if (value.codMaxPaise !== null && value.codMaxPaise < value.codMinPaise)
      context.addIssue({
        code: 'custom',
        path: ['codMaxPaise'],
        message: 'The COD maximum must cover the minimum.',
      });
    if (
      value.gstRegistered &&
      (!value.seller.legalName || !value.seller.gstin || !value.seller.address)
    )
      context.addIssue({
        code: 'custom',
        path: ['seller'],
        message: 'Registered sellers need a legal name, GSTIN and address.',
      });
    if (
      new Set(value.serviceablePincodeRules.map(({ prefix }) => prefix)).size !==
      value.serviceablePincodeRules.length
    )
      context.addIssue({
        code: 'custom',
        path: ['serviceablePincodeRules'],
        message: 'Pincode prefixes must be unique.',
      });
  });
