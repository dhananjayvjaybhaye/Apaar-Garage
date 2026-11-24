import mongoose from 'mongoose';
import { storeSettingsId } from '../config/store-policy.js';
import { settingsInput } from '../utils/store-settings-input.js';

export const StoreSettings = mongoose.model(
  'StoreSettings',
  new mongoose.Schema(
    {
      _id: { type: String, enum: [storeSettingsId], default: storeSettingsId },
      value: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        validate: (value) => settingsInput.safeParse(value).success,
      },
    },
    { timestamps: true },
  ),
);
