import React from 'react'
import SearchableSelect from './SearchableSelect'
import { OTHER_BRAND, VEHICLE_BRAND_OPTIONS } from '../../constants/vehicleBrands'
import { capsInputValue } from '../../utils/textCase'

// "Vehicle Brand" for the registration/edit forms. Controlled by `{ choice, custom }`
// (constants/vehicleBrands.js#vehicleBrandFormValue / resolveVehicleBrand). Renders <label>s so
// it sits in either form grid (.registration-form / .register-form); the custom-brand box
// appears only for "Other", and switching away from Other clears it - no mixed values.
export default function VehicleBrandField({ value, onChange }){
  const { choice = '', custom = '' } = value || {}

  return (
    <>
      <label>
        Vehicle Brand (optional)
        <SearchableSelect
          value={choice}
          options={VEHICLE_BRAND_OPTIONS}
          onChange={(next) => onChange({ choice: next, custom: next === OTHER_BRAND ? custom : '' })}
          placeholder="Search or pick a brand"
          ariaLabel="Vehicle Brand"
          emptyText={`Not listed - choose "${OTHER_BRAND}"`}
          allowClear
        />
      </label>
      {choice === OTHER_BRAND && (
        <label>
          Other Brand
          <input
            value={custom}
            onChange={(e) => onChange({ choice, custom: capsInputValue(e) })}
            placeholder="e.g. CHANGAN"
            maxLength={40}
            aria-label="Other Brand"
          />
        </label>
      )}
    </>
  )
}
