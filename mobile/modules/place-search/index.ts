// Apple Maps' place search by name (MKLocalSearch), iPhone only: the pharmacy whose address no geocoder finds.
import { requireOptionalNativeModule } from 'expo';

export interface Place { name: string; lat: number; lon: number; postcode: string; street: string }

const M = requireOptionalNativeModule<{ search(q: string, lat: number, lon: number): Promise<Place[]> }>('PlaceSearch');

/** Null where this build has no module (Android, Expo Go, an older app). */
export const searchPlaces = M ? (q: string, lat: number, lon: number) => M.search(q, lat, lon) : null;
