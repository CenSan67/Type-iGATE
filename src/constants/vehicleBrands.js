// Vehicle brand (make) on rfidUsers/{id}/vehicleBrand - registered owners and visitor passes.
// Stored in CAPS like plate/color (LTO convention): a listed brand ("TOYOTA"), a custom one
// typed under "Other", or NO_VEHICLE_VALUE. Optional - a record without it shows "Not specified".
//
// Forms hold `{ choice, custom }` (see VehicleBrandField) and turn it into the stored value with
// resolveVehicleBrand(), so a form can never save "Toyota" together with a different custom name.

export const VEHICLE_BRANDS = [
  // cars / trucks
  'Toyota', 'Honda', 'Mitsubishi', 'Nissan', 'Suzuki', 'Ford', 'Hyundai', 'Kia', 'Isuzu', 'Mazda',
  'BMW', 'Mercedes-Benz', 'Chevrolet', 'Subaru', 'Geely', 'MG', 'Chery', 'BYD', 'Foton',
  // motorcycles / tricycles / e-bikes
  'Yamaha', 'Kawasaki', 'Kymco', 'Rusi', 'Motorstar', 'SYM', 'TVS', 'Vespa',
]

export const OTHER_BRAND = 'Other'
export const NO_VEHICLE = 'No Vehicle'
export const NO_VEHICLE_VALUE = 'NO VEHICLE'
export const BRAND_NOT_SPECIFIED = 'Not specified'

// Dropdown options, in display spelling.
export const VEHICLE_BRAND_OPTIONS = [...VEHICLE_BRANDS, OTHER_BRAND, NO_VEHICLE]

// Letters/numbers plus space . & ' - /, 2-40 characters, starting with a letter or number.
const CUSTOM_BRAND_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .&'/-]{1,39}$/

const cleanText = (value) => (value || '').toString().trim().replace(/\s+/g, ' ')
const listedBrand = (text) => VEHICLE_BRANDS.find((b) => b.toLowerCase() === text.toLowerCase())

export function isValidVehicleBrand(stored) {
  const text = cleanText(stored)
  return !text || text === NO_VEHICLE_VALUE || CUSTOM_BRAND_PATTERN.test(text)
}

// Stored value -> normalized stored value (CAPS, single spaces). Used by the rfidUser model.
export function normalizeVehicleBrand(stored) {
  return cleanText(stored).toUpperCase()
}

// Stored value -> form state for VehicleBrandField.
export function vehicleBrandFormValue(stored) {
  const text = cleanText(stored)
  if (!text) return { choice: '', custom: '' }
  if (text.toUpperCase() === NO_VEHICLE_VALUE) return { choice: NO_VEHICLE, custom: '' }
  const listed = listedBrand(text)
  return listed ? { choice: listed, custom: '' } : { choice: OTHER_BRAND, custom: text }
}

// Form state -> { value } to store ('' = not specified), or { error } to show.
export function resolveVehicleBrand({ choice, custom } = {}) {
  if (!choice) return { value: '' }
  if (choice === NO_VEHICLE) return { value: NO_VEHICLE_VALUE }
  if (choice !== OTHER_BRAND) return { value: choice.toUpperCase() }
  const text = cleanText(custom)
  if (!text) return { error: 'Enter the vehicle brand, or pick it from the list.' }
  if (!CUSTOM_BRAND_PATTERN.test(text)) return { error: 'Vehicle brand: 2-40 letters or numbers (spaces, . & \' - / allowed).' }
  // "toyota" typed under Other is just Toyota.
  return { value: (listedBrand(text) || text).toUpperCase() }
}

// For tables/details: the stored brand, or "Not specified" for records saved before brands existed.
export const formatVehicleBrand = (stored) => cleanText(stored) || BRAND_NOT_SPECIFIED
