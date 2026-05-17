/**
 * @typedef {Object} PracticeFinderResult
 * @property {string} placeId
 * @property {string} name
 * @property {string|null} specialty
 * @property {string} address
 * @property {number} distanceKm
 * @property {number|null} rating
 * @property {number|null} reviewCount
 * @property {string|null} websiteUrl
 * @property {string|null} mapsUrl
 * @property {string|null} routeUrl
 * @property {string|null} phone
 * @property {string|null} openingHoursSummary
 * @property {string[]} languages
 * @property {string|null} bookingUrl
 */

/**
 * @typedef {Object} PracticeFinderSearchParams
 * @property {string} country
 * @property {string} specialty
 * @property {string} postalCode
 * @property {string} city
 * @property {string} addressLine
 * @property {number} radiusKm
 * @property {number|null} latitude
 * @property {number|null} longitude
 * @property {string|null} pageToken
 * @property {string} language
 */

export {};
