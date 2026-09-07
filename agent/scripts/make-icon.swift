import AppKit
import Foundation

@main
struct MakeIcon {
    static func main() throws {
        let directory = CommandLine.arguments[1]
        try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
        for size in [16, 32, 128, 256, 512] {
            for scale in [1, 2] {
                let pixels = size * scale
                let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
                                           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                                           colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
                NSGraphicsContext.saveGraphicsState()
                NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
                let p = CGFloat(pixels)
                let face = NSRect(x: p * 0.075, y: p * 0.075, width: p * 0.85, height: p * 0.85)
                let tile = NSBezierPath(roundedRect: face, xRadius: p * 0.19, yRadius: p * 0.19)
                NSGraphicsContext.saveGraphicsState()
                let shadow = NSShadow()
                shadow.shadowColor = NSColor.black.withAlphaComponent(0.3)
                shadow.shadowBlurRadius = p * 0.025
                shadow.shadowOffset = NSSize(width: 0, height: -p * 0.012)
                shadow.set()
                NSColor(calibratedWhite: 0.07, alpha: 1).setFill(); tile.fill()
                NSGraphicsContext.restoreGraphicsState()
                NSGradient(starting: NSColor(calibratedWhite: 0.065, alpha: 1),
                           ending: NSColor(calibratedWhite: 0.18, alpha: 1))!.draw(in: tile, angle: 110)
                NSColor.white.withAlphaComponent(0.16).setStroke()
                tile.lineWidth = max(0.5, p * 0.002); tile.stroke()
                let mark = BrandMark.path(in: NSRect(x: p * 0.20, y: p * 0.20, width: p * 0.60, height: p * 0.60))
                NSGradient(starting: NSColor(calibratedWhite: 0.87, alpha: 1),
                           ending: NSColor.white)!.draw(in: mark, angle: 90)
                NSGraphicsContext.restoreGraphicsState()
                let suffix = scale == 2 ? "@2x" : ""
                try rep.representation(using: .png, properties: [:])!.write(
                    to: URL(fileURLWithPath: "\(directory)/icon_\(size)x\(size)\(suffix).png"))
            }
        }
    }
}
