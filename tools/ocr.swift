// OCR local (Vision d'Apple) : lit le texte de chaque image + détecte la langue.
// Usage : ocr <image> [image…]  →  JSON [{ "path", "text", "lang" }]
import Foundation
import Vision
import NaturalLanguage
import AppKit

struct Out: Codable { let path: String; let text: String; let lang: String }
var results: [Out] = []
for path in CommandLine.arguments.dropFirst() {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        results.append(Out(path: path, text: "", lang: "")); continue
    }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["fr-FR", "en-US"]
    req.usesLanguageCorrection = true
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
    // Lignes triées de haut en bas
    let lines = (req.results ?? [])
        .sorted { $0.boundingBox.minY > $1.boundingBox.minY }
        .compactMap { $0.topCandidates(1).first?.string }
    let text = lines.joined(separator: "\n")
    let rec = NLLanguageRecognizer()
    rec.languageConstraints = [.french, .english]
    rec.processString(text)
    results.append(Out(path: path, text: text, lang: rec.dominantLanguage?.rawValue ?? ""))
}
let enc = JSONEncoder()
FileHandle.standardOutput.write(try! enc.encode(results))
