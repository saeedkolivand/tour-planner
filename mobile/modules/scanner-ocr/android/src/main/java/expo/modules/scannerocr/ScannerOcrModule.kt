package expo.modules.scannerocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class ScannerOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScannerOcr")

    // Each line with its box: fractions of the upright photo, top-left origin (as on iOS).
    AsyncFunction("recognize") { path: String, promise: Promise ->
      try {
        val uri = if (path.startsWith("content://")) Uri.parse(path) else Uri.fromFile(File(path))
        val image = InputImage.fromFilePath(appContext.reactContext!!, uri)
        // the boxes are in the upright photo: a quarter turn swaps its sides
        val turned = image.rotationDegrees % 180 != 0
        val w = (if (turned) image.height else image.width).toDouble()
        val h = (if (turned) image.width else image.height).toDouble()
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).process(image)
          .addOnSuccessListener { text ->
            promise.resolve(text.textBlocks.flatMap { it.lines }.mapNotNull { line ->
              val b = line.boundingBox ?: return@mapNotNull null
              mapOf("text" to line.text, "x" to b.left / w, "y" to b.top / h, "w" to b.width() / w, "h" to b.height() / h)
            })
          }
          .addOnFailureListener { e -> promise.reject(CodedException("E_OCR", e.message ?: "OCR failed", e)) }
      } catch (e: Exception) {
        promise.reject(CodedException("E_IMAGE", e.message ?: "Cannot read the photo at $path", e))
      }
    }
  }
}
