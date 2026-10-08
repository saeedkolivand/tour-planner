import ExpoModulesCore
import ImageIO
import UIKit
import Vision

public class ScannerOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScannerOcr")

    // Each line with its box: fractions of the upright photo, top-left origin (Vision's own is bottom-left).
    AsyncFunction("recognize") { (path: String, promise: Promise) in
      guard let image = UIImage(contentsOfFile: path), let cg = image.cgImage else {
        return promise.reject("E_IMAGE", "Cannot read the photo at \(path)")
      }
      let request = VNRecognizeTextRequest { request, error in
        if let error = error { return promise.reject("E_OCR", error.localizedDescription) }
        let lines: [[String: Any]] = (request.results as? [VNRecognizedTextObservation] ?? []).compactMap { o in
          guard let text = o.topCandidates(1).first?.string else { return nil }
          let b = o.boundingBox
          return ["text": text, "x": Double(b.minX), "y": Double(1 - b.maxY), "w": Double(b.width), "h": Double(b.height)]
        }
        promise.resolve(lines)
      }
      request.recognitionLevel = .accurate
      // German first: "Köln", "Klingelpütz" (English-only read them as "Köin", "Klingelputz")
      request.recognitionLanguages = ["de-DE", "en-US"]
      // a camera photo is stored sideways with an EXIF turn: Vision reads it upright only when told
      let handler = VNImageRequestHandler(cgImage: cg, orientation: CGImagePropertyOrientation(image.imageOrientation))
      DispatchQueue.global(qos: .userInitiated).async {
        do { try handler.perform([request]) } catch { promise.reject("E_OCR", error.localizedDescription) }
      }
    }
  }
}

extension CGImagePropertyOrientation {
  init(_ o: UIImage.Orientation) {
    switch o {
    case .up: self = .up
    case .upMirrored: self = .upMirrored
    case .down: self = .down
    case .downMirrored: self = .downMirrored
    case .left: self = .left
    case .leftMirrored: self = .leftMirrored
    case .right: self = .right
    case .rightMirrored: self = .rightMirrored
    @unknown default: self = .up
    }
  }
}
