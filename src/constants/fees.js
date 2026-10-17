// Registration/renewal pricing, validity and the documents a guard must check. One place to
// change when the university confirms official numbers.

// How long a paid registration/renewal stays valid. NOT yet confirmed by the university -
// change this single value (used by the Payment page, the registration modal and receipts).
export const REGISTRATION_VALIDITY_MONTHS = 5

// Same fee for a new registration and a renewal. Large EVs (e.g. a Tesla) are registered as
// 'Car' and pay the four-wheel fee.
// database.rules.json (payments/$paymentId .validate) refuses a new payment whose amount
// doesn't match this table - change both together and run `firebase deploy --only database`.
export const VEHICLE_FEES = {
  Motorcycle: 50,
  Tricycle: 75,
  Car: 100,
  Truck: 100,
  'E-Bike': 50, // placeholder - university hasn't set an e-bike/e-scooter fee yet
  'E-Scooter': 50,
}

export const getVehicleFee = (vehicleType) => VEHICLE_FEES[vehicleType] ?? 0

// Documents the guard checks against the originals (verify-only: nothing is scanned or stored).
export const DOCUMENT_LABELS = {
  license: "Driver's license",
  orcr: 'OR/CR',
  validId: 'Valid ID',
}

const MOTOR_VEHICLE_DOCS = ['license', 'orcr']

export const VEHICLE_REQUIRED_DOCS = {
  Motorcycle: MOTOR_VEHICLE_DOCS,
  Tricycle: MOTOR_VEHICLE_DOCS,
  Car: MOTOR_VEHICLE_DOCS,
  Truck: MOTOR_VEHICLE_DOCS,
  'E-Bike': ['validId'],
  'E-Scooter': ['validId'],
}

export const getRequiredDocs = (vehicleType) => VEHICLE_REQUIRED_DOCS[vehicleType] || MOTOR_VEHICLE_DOCS

// Unregistered small e-vehicles usually have no plate.
export const PLATE_OPTIONAL_TYPES = ['E-Bike', 'E-Scooter']

// Bump the version whenever the wording changes; it's stored with each consent.
export const PRIVACY_NOTICE_VERSION = '2026-09'
export const PRIVACY_CONSENT_TEXT =
  "By proceeding, I consent to BulSU verifying my driver's license, vehicle registration (OR/CR) or valid ID, " +
  'and recording my vehicle and contact details, solely for campus gate access and security verification, ' +
  'in compliance with R.A. 10173 (Data Privacy Act of 2012). Copies of my documents are not kept.'
