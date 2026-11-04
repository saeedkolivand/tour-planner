import ExpoModulesCore
import MapKit

public class PlaceSearchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PlaceSearch")

    // What typing a name into Apple Maps does (CLGeocoder, behind expo-location, only knows addresses): the places
    // it finds around the tour, with their postcode so the caller can check it's the right one.
    AsyncFunction("search") { (query: String, lat: Double, lon: Double, promise: Promise) in
      let request = MKLocalSearch.Request()
      request.naturalLanguageQuery = query
      request.region = MKCoordinateRegion(center: CLLocationCoordinate2D(latitude: lat, longitude: lon), latitudinalMeters: 60_000, longitudinalMeters: 60_000)
      DispatchQueue.main.async {
        MKLocalSearch(request: request).start { response, error in
          if let error = error {
            if (error as NSError).code == MKError.placemarkNotFound.rawValue { return promise.resolve([[String: Any]]()) }
            return promise.reject("E_SEARCH", error.localizedDescription)
          }
          promise.resolve((response?.mapItems ?? []).map { item -> [String: Any] in
            let p = item.placemark
            return ["name": item.name ?? "", "lat": p.coordinate.latitude, "lon": p.coordinate.longitude, "postcode": p.postalCode ?? "", "street": p.thoroughfare ?? ""]
          })
        }
      }
    }
  }
}
