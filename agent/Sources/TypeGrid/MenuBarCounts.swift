import AppKit

/// Template rendering preserves contrast on light and dark menu bars.
/// Inputs are formatted aggregate totals only. A hidden count still tracks.
enum MenuBarCounts {
    static func image(keystrokes: String?, clicks: String?, goalPercent: Int? = nil, indicator: String? = nil) -> NSImage {
        let font = NSFont.monospacedDigitSystemFont(ofSize: 10.5, weight: .medium)
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.black]
        struct Segment { let symbol: String?; let iconWidth: CGFloat; let label: NSAttributedString; let progress: Int? }
        var segments: [Segment] = []
        if let keystrokes { segments.append(Segment(symbol: "keyboard", iconWidth: 17, label: NSAttributedString(string: keystrokes, attributes: attributes), progress: nil)) }
        if let clicks { segments.append(Segment(symbol: "computermouse", iconWidth: 11, label: NSAttributedString(string: clicks, attributes: attributes), progress: nil)) }
        if let goalPercent {
            let percent = max(0, min(100, goalPercent))
            segments.append(Segment(symbol: nil, iconWidth: 15, label: NSAttributedString(string: "\(percent)%", attributes: attributes), progress: percent))
        }
        let fallback = segments.isEmpty
        let state = NSAttributedString(string: indicator ?? "", attributes: attributes)
        let contentWidth: CGFloat = fallback ? 18 : segments.reduce(0) { $0 + $1.iconWidth + 4 + $1.label.size().width } + CGFloat(max(0, segments.count - 1)) * 10
        let width = ceil(contentWidth + (indicator == nil ? 0 : 6 + state.size().width))
        let image = NSImage(size: NSSize(width: width, height: 18), flipped: false) { _ in
            if fallback { NSColor.black.setFill(); BrandMark.path(in: NSRect(x: 0, y: 0, width: 18, height: 18)).fill() }
            var x: CGFloat = 0
            for segment in segments {
                if let percent = segment.progress {
                    let center = NSPoint(x: x + 7.5, y: 9)
                    let track = NSBezierPath(ovalIn: NSRect(x: x + 1, y: 2.5, width: 13, height: 13))
                    NSColor.black.withAlphaComponent(0.22).setStroke(); track.lineWidth = 1.8; track.stroke()
                    if percent > 0 {
                        let arc = NSBezierPath()
                        arc.appendArc(withCenter: center, radius: 6.5, startAngle: 90, endAngle: 90 - CGFloat(percent) * 3.6, clockwise: true)
                        NSColor.black.setStroke(); arc.lineWidth = 1.8; arc.lineCapStyle = .round; arc.stroke()
                    }
                    if percent == 100 {
                        let check = NSBezierPath(); check.move(to: NSPoint(x: x + 4.5, y: 9)); check.line(to: NSPoint(x: x + 6.5, y: 7)); check.line(to: NSPoint(x: x + 10.5, y: 11))
                        check.lineWidth = 1.3; check.lineCapStyle = .round; NSColor.black.setStroke(); check.stroke()
                    }
                } else if let symbol = segment.symbol, let glyph = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?.withSymbolConfiguration(.init(pointSize: 13, weight: .regular)) {
                    let scale = min(segment.iconWidth / glyph.size.width, 13 / glyph.size.height)
                    let size = NSSize(width: glyph.size.width * scale, height: glyph.size.height * scale)
                    glyph.draw(in: NSRect(x: x + (segment.iconWidth - size.width) / 2, y: (18 - size.height) / 2, width: size.width, height: size.height))
                }
                segment.label.draw(at: NSPoint(x: x + segment.iconWidth + 4, y: (18 - segment.label.size().height) / 2))
                x += segment.iconWidth + 4 + segment.label.size().width + 10
            }
            if indicator != nil { state.draw(at: NSPoint(x: contentWidth + 6, y: (18 - state.size().height) / 2)) }
            return true
        }
        image.isTemplate = true
        return image
    }
}
