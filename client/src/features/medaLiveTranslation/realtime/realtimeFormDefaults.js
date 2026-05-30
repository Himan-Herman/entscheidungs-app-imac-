/**
 * Prefill hook for the Meda Realtime setup form.
 *
 * Fetches the current user's profile from the existing /api/account/patient-settings
 * endpoint (no new server route). Returns mapped field values for the form.
 *
 * All data stays in component state — nothing is persisted here.
 */
import { useState, useEffect } from 'react';
import { authFetch } from '../../../api/authFetch.js';
import { REALTIME_LANGUAGES } from './realtimeLanguages.js';

const SUPPORTED_LANG_CODES = new Set(REALTIME_LANGUAGES.map(l => l.code));

// Gender values stored in the profile are free-text; only prefill if they
// exactly match one of the dropdown options.
const GENDER_OPTIONS = new Set(['weiblich', 'männlich', 'divers']);

// insuranceType (API) → insuranceStatus (form dropdown)
const INSURANCE_MAP = {
  statutory: 'gesetzlich',
  private:   'privat',
  self_pay:  'Selbstzahler',
};

function formatDateDe(isoDate) {
  if (!isoDate) return '';
  const parts = String(isoDate).split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

/**
 * Hook: fetches /api/account/patient-settings once and maps the response
 * to the Meda form field shape. Returns null if fetch fails.
 *
 * @returns {{ profileData: object|null, loading: boolean }}
 */
export function usePatientProfilePrefill() {
  const [profileData, setProfileData] = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    let active = true;

    authFetch('/api/account/patient-settings')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(j => {
        if (!active) return;
        const u = j?.user    || {};
        const p = j?.profile || {};

        const firstName  = String(u.firstName  || '').trim();
        const lastName   = String(u.lastName   || '').trim();
        const name       = [firstName, lastName].filter(Boolean).join(' ');

        // genderOrSalutation is free-text — only use if it matches a known option
        const gender     = GENDER_OPTIONS.has(p.genderOrSalutation)
          ? p.genderOrSalutation : '';

        const insuranceStatus = INSURANCE_MAP[p.insuranceType] || '';

        // Build address from profile fields
        const addrParts = [
          String(p.addressLine || '').trim(),
          [String(p.postalCode || '').trim()].filter(Boolean).join(' '),
        ].filter(Boolean);
        const address = addrParts.join(', ');

        // Language prefill — only use if the code is in SUPPORTED_LANGUAGES
        const patientLang  = SUPPORTED_LANG_CODES.has(p.preferredPatientLanguage)
          ? p.preferredPatientLanguage : null;
        const practiceLang = SUPPORTED_LANG_CODES.has(p.preferredDoctorLanguage)
          ? p.preferredDoctorLanguage : null;

        setProfileData({
          name,
          dateOfBirth:     formatDateDe(u.dateOfBirth),
          gender,
          insuranceStatus,
          email:           String(u.email    || '').trim(),
          phone:           String(p.phone    || '').trim(),
          address,
          patientLang,
          practiceLang,
        });
      })
      .catch(() => {
        if (active) setProfileData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  return { profileData, loading };
}

/** Empty patient info shape — use as useState initial value. */
export const EMPTY_PATIENT_INFO = {
  name:            '',
  dateOfBirth:     '',
  gender:          '',
  insuranceStatus: '',
  insuranceNumber: '',
  email:           '',
  phone:           '',
  address:         '',
  relationship:    '',
};

/** Empty practice info shape — use as useState initial value. */
export const EMPTY_PRACTICE_INFO = {
  practiceName: '',
  doctorName:   '',
  department:   '',
  email:        '',
  phone:        '',
  address:      '',
};
