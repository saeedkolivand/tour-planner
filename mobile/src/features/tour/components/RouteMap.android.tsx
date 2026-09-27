// Android: react-native-maps always uses Google Maps there, which needs an API key (app.json
// android.config.googleMaps.apiKey); without one the app crashes as soon as the map draws.
// ponytail: placeholder until there's a key; the stop list and navigation work without the map.
export { RouteMap } from './RouteMap.web';
