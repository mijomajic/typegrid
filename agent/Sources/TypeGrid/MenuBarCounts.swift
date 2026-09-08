import AppKit

/// A template image lets macOS choose the correct contrast for the menu bar.
/// Only already-aggregated, formatted totals enter this renderer.
enum MenuBarCounts {
    static func image(keystrokes: String, clicks: String, indicator: String? = nil) -> NSImage {
        let font = NSFont.monospacedDigitSystemFont(ofSize: 10.5, weight: .medium)
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.black]
        let keys = NSAttributedString(string: keystrokes, attributes: attributes)
        let mouse = NSAttributedString(string: clicks, attributes: attributes)
        let state = NSAttributedString(string: indicator ?? "", attributes: attributes)
        let width = ceil(14 + 4 + keys.size().width + 10 + 9 + 4 + mouse.size().width + (indicator == nil ? 0 : 6 + state.size().width))
        let image = NSImage(size: NSSize(width: width, height: 18), flipped: false) { _ in
            func symbol(_ name: String, fallback: String, x: CGFloat, width: CGFloat) {
                if let glyph = NSImage(systemSymbolName: name, accessibilityDescription: nil)?
                    .withSymbolConfiguration(.init(pointSize: 11, weight: .regular)) {
                    let scale = min(width / glyph.size.width, 11 / glyph.size.height)
                    let size = NSSize(width: glyph.size.width * scale, height: glyph.size.height * scale)
                    glyph.draw(in: NSRect(x: x + (width - size.width) / 2, y: (18 - size.height) / 2, width: size.width, height: size.height))
                } else {
                    let label = NSAttributedString(string: fallback, attributes: attributes)
                    label.draw(at: NSPoint(x: x, y: (18 - label.size().height) / 2))
                }
            }
            func text(_ value: NSAttributedString, x: CGFloat) {
                value.draw(at: NSPoint(x: x, y: (18 - value.size().height) / 2))
            }
            symbol("keyboard", fallback: "K", x: 0, width: 14)
            text(keys, x: 18)
            let mouseX = 18 + keys.size().width + 10
            symbol("computermouse", fallback: "M", x: mouseX, width: 9)
            text(mouse, x: mouseX + 13)
            if indicator != nil { text(state, x: mouseX + 13 + mouse.size().width + 6) }
            return true
        }
        image.isTemplate = true
        return image
    }
}
