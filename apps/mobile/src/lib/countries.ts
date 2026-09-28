/** ISO 3166-1 alpha-2 codes offered in onboarding (names via Intl.DisplayNames). */
export const COUNTRIES = [
  'ID',
  'SG',
  'MY',
  'PH',
  'TH',
  'VN',
  'IN',
  'JP',
  'KR',
  'AU',
  'NZ',
  'AE',
  'SA',
  'TR',
  'DE',
  'FR',
  'NL',
  'ES',
  'IT',
  'PT',
  'GB',
  'IE',
  'CH',
  'SE',
  'NO',
  'DK',
  'FI',
  'PL',
  'CZ',
  'AT',
  'BE',
  'US',
  'CA',
  'MX',
  'BR',
  'AR',
  'CL',
  'CO',
  'PE',
  'NG',
  'KE',
  'ZA',
  'EG',
  'MA',
  'HK',
  'TW',
  'PK',
  'BD',
  'LK',
  'KH',
];

export function countryName(code: string, language: string): string {
  try {
    const names = new Intl.DisplayNames([language === 'id' ? 'id' : 'en'], { type: 'region' });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}
