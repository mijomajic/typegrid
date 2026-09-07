import AppKit
import Foundation
let directory = CommandLine.arguments[1]
try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
for size in [16,32,128,256,512] {
    for scale in [1,2] {
        let pixels = size * scale
        let rep = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:pixels,pixelsHigh:pixels,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep:rep)
        let p = CGFloat(pixels)
        NSColor(calibratedRed:0.055,green:0.075,blue:0.043,alpha:1).setFill()
        NSBezierPath(roundedRect:NSRect(x:0,y:0,width:p,height:p),xRadius:p*0.21,yRadius:p*0.21).fill()
        for x in 0..<3 { for y in 0..<3 {
            NSColor(calibratedRed:0.71,green:0.96,blue:0.45,alpha: (x==0 && y==0) || (x==2 && y==2) ? 0.4 : 1).setFill()
            NSBezierPath(roundedRect:NSRect(x:p*(0.2+CGFloat(x)*0.22),y:p*(0.2+CGFloat(y)*0.22),width:p*0.16,height:p*0.16),xRadius:p*0.02,yRadius:p*0.02).fill()
        }}
        NSGraphicsContext.restoreGraphicsState()
        let suffix = scale == 2 ? "@2x" : ""
        try rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"\(directory)/icon_\(size)x\(size)\(suffix).png"))
    }
}
